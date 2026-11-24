"""
Automated Verification & Test Suite for TikTok Channel Context Reader.
Covers:
  - URL validation & SSRF protection (host allowlist, @handle normalization, video-link rejection)
  - SSR rehydration JSON & OpenGraph meta parsing
  - Anti-bot / CAPTCHA gate detection (never bypassed) + manual notes fallback
  - Gemini Structured Outputs synthesis & deterministic fallback analysis
  - FastAPI POST /api/v1/channels/tiktok/analyze endpoint & script generation integration
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
import httpx
import pytest

GATEWAY_ROOT = Path(__file__).resolve().parent.parent
if str(GATEWAY_ROOT) not in sys.path:
    sys.path.insert(0, str(GATEWAY_ROOT))

from src.main import app, configure_queue_backend
from src.schemas import ChannelContextProfile
from src.services.channel_context_service import (
    TikTokChannelContextService,
    TikTokProfileBlockedError,
    TikTokProfileError,
    normalize_tiktok_profile_url,
)
from src.services.llm_service import LLMScriptGenerator
from src.services.queue_service import LocalMemoryQueueBackend


def _mock_http_factory(status_code: int, html_body: str):
    def _factory() -> httpx.Client:
        transport = httpx.MockTransport(
            lambda request: httpx.Response(status_code=status_code, text=html_body)
        )
        return httpx.Client(transport=transport)

    return _factory


class TestTikTokUrlValidation:
    def test_normalizes_handles_and_mobile_urls(self):
        assert normalize_tiktok_profile_url("@dattech.ai") == (
            "@dattech.ai",
            "https://www.tiktok.com/@dattech.ai",
        )
        assert normalize_tiktok_profile_url("https://m.tiktok.com/@minh_ai?lang=vi&ref=share") == (
            "@minh_ai",
            "https://www.tiktok.com/@minh_ai",
        )
        assert normalize_tiktok_profile_url("tiktok.com/@builder.vn/") == (
            "@builder.vn",
            "https://www.tiktok.com/@builder.vn",
        )

    @pytest.mark.parametrize(
        "bad_url",
        [
            "",
            "https://localhost:8000/@admin",
            "http://127.0.0.1/@root",
            "https://evil.example.com/@someone",
            "https://user:pass@www.tiktok.com/@someone",
            "https://www.tiktok.com/discover",
            "https://www.tiktok.com/@someone/video/71234567890",
            "ftp://www.tiktok.com/@someone",
        ],
    )
    def test_rejects_ssrf_and_non_profile_urls(self, bad_url: str):
        with pytest.raises(TikTokProfileError):
            normalize_tiktok_profile_url(bad_url)


class TestTikTokProfileExtractionAndSynthesis:
    def test_parses_universal_rehydration_ssr_payload_cleanly(self):
        ssr_payload = {
            "__DEFAULT_SCOPE__": {
                "webapp.user-detail": {
                    "userInfo": {
                        "user": {
                            "uniqueId": "dattech.ai",
                            "nickname": "Đạt Tech & AI",
                            "signature": "Chia sẻ công cụ AI, tự động hóa quy trình làm việc #AI #Automation",
                            "verified": True,
                            "avatarLarger": "https://p16-sign-sg.tiktokcdn.com/avatar.jpeg",
                        },
                        "stats": {
                            "followerCount": 145000,
                            "followingCount": 210,
                            "heartCount": 2400000,
                            "videoCount": 182,
                        },
                    }
                },
                "webapp.user-post": {
                    "itemList": [
                        {
                            "desc": "3 công cụ AI giúp dựng video slide tự động trong 60 giây #AIAgent",
                            "textExtra": [{"hashtagName": "VideoAutomation"}],
                        },
                        {
                            "desc": "Xây dựng workflow n8n và Python tiết kiệm 5 giờ mỗi tuần #Productivity",
                        },
                    ]
                },
            }
        }
        html_doc = f"""
        <html><head><title>Đạt Tech & AI (@dattech.ai) | TikTok</title></head>
        <body>
          <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
            {json.dumps(ssr_payload, ensure_ascii=False)}
          </script>
        </body></html>
        """
        llm = LLMScriptGenerator(api_key="")
        service = TikTokChannelContextService(
            llm_generator=llm,
            http_client_factory=_mock_http_factory(200, html_doc),
        )
        profile = service.analyze_profile("https://www.tiktok.com/@dattech.ai")

        assert profile.handle == "@dattech.ai"
        assert profile.display_name == "Đạt Tech & AI"
        assert profile.verified is True
        assert profile.follower_count == 145000
        assert profile.likes_count == 2400000
        assert profile.video_count == 182
        assert profile.extraction_source == "tiktok_ssr"
        assert profile.detected_language == "vi"
        assert profile.recommended_theme == "modern_tech"
        assert profile.recommended_format == "short"
        assert "#AI" in profile.hashtags
        assert len(profile.recent_video_titles) == 2
        assert "Đạt Tech & AI" in profile.context_summary
        assert len(profile.content_pillars) >= 2

    def test_parses_opengraph_fallback_with_compact_counts(self):
        html_doc = """
        <html><head>
          <meta property="og:title" content="Apex B2B Growth (@apexgrowth) | TikTok" />
          <meta property="og:description" content="Apex B2B Growth (@apexgrowth) on TikTok | 1.4M Likes. 82.5K Followers. Helping SaaS startups scale B2B marketing & revenue workflows #Marketing #SaaS. Watch the latest video from Apex B2B Growth." />
        </head><body></body></html>
        """
        llm = LLMScriptGenerator(api_key="")
        service = TikTokChannelContextService(
            llm_generator=llm,
            http_client_factory=_mock_http_factory(200, html_doc),
        )
        profile = service.analyze_profile("https://www.tiktok.com/@apexgrowth", language="en")

        assert profile.handle == "@apexgrowth"
        assert profile.display_name == "Apex B2B Growth"
        assert profile.extraction_source == "tiktok_og_meta"
        assert profile.follower_count == 82500
        assert profile.likes_count == 1400000
        assert profile.recommended_theme == "corporate"
        assert "B2B" in profile.niche_category or "Marketing" in profile.niche_category

    def test_captcha_gate_never_bypasses_and_supports_manual_notes_fallback(self):
        captcha_html = """
        <html><head><title>TikTok - Make Your Day</title></head>
        <body class="captcha-disable-scroll"><div id="verify-bar">Drag the puzzle</div></body></html>
        """
        llm = LLMScriptGenerator(api_key="")
        service = TikTokChannelContextService(
            llm_generator=llm,
            http_client_factory=_mock_http_factory(200, captcha_html),
        )

        # Without manual notes, explicitly raises TikTokProfileBlockedError (never bypasses)
        with pytest.raises(TikTokProfileBlockedError):
            service.analyze_profile("https://www.tiktok.com/@private.creator")

        # With explicit user manual notes, synthesizes rich channel context transparently
        profile = service.analyze_profile(
            "https://www.tiktok.com/@private.creator",
            manual_notes="Chia sẻ kiến thức thiết kế tối giản và học tiếng Anh mỗi ngày #Education #Design",
        )
        assert profile.blocked_by_captcha is True
        assert profile.extraction_source == "manual_notes"
        assert profile.fetch_warning is not None
        assert profile.recommended_theme == "minimal"
        assert profile.detected_language == "vi"

    def test_slardar_waf_falls_back_to_official_tiktok_oembed_creator_api(self, monkeypatch):
        waf_html = (
            '<!DOCTYPE html><html><head><script id="slardar-config" type="application/json">'
            '{"slardarClient":"SlardarWAF","bid":"slardar_us_waf"}</script></head></html>'
        )
        oembed_json = {
            "version": "1.0",
            "type": "rich",
            "title": "KaitoDeus's Creator Profile",
            "author_url": "https://www.tiktok.com/@kaitodeus",
            "author_name": "KaitoDeus",
            "embed_type": "profile",
        }

        def _routed_http_factory() -> httpx.Client:
            def _handler(request: httpx.Request) -> httpx.Response:
                if "tiktok.com/oembed" in str(request.url):
                    return httpx.Response(status_code=200, json=oembed_json)
                return httpx.Response(status_code=200, text=waf_html)

            return httpx.Client(transport=httpx.MockTransport(_handler))

        llm = LLMScriptGenerator(api_key="")
        service = TikTokChannelContextService(
            llm_generator=llm,
            http_client_factory=_routed_http_factory,
        )
        profile = service.analyze_profile("https://www.tiktok.com/@kaitodeus", language="vi")

        assert profile.handle == "@kaitodeus"
        assert profile.display_name == "KaitoDeus"
        assert profile.extraction_source == "tiktok_oembed"
        assert profile.blocked_by_captcha is True
        assert profile.fetch_warning is not None
        assert "KaitoDeus" in profile.fetch_warning
        assert "@kaitodeus" in profile.context_summary

        # Also verify Gemini Interactions Google Search grounding enables when bio is empty
        monkeypatch.setenv("GEMINI_API_KEY", "test-live-key")
        llm_live = LLMScriptGenerator(api_key="test-live-key")
        mock_interaction = MagicMock()
        mock_interaction.output_text = json.dumps(
            {
                "niche_category": "Gaming & Creative Storytelling",
                "content_pillars": ["Highlights & lore breakdowns", "Fast visual edits"],
                "target_audience": "Gen-Z gamers and anime fans",
                "tone_and_style": "High-energy, punchy edits with quick commentary",
                "detected_language": "vi",
                "recommended_theme": "modern_tech",
                "recommended_format": "short",
                "keywords": ["KaitoDeus", "gaming", "shorts"],
                "context_summary": "Kênh KaitoDeus chia sẻ nội dung giải trí và phân tích nhanh.",
                "suggested_prompt": "Tạo video Short 30s phong cách KaitoDeus với câu hook mở đầu cực nhanh.",
            }
        )
        mock_client = MagicMock()
        mock_client.interactions.create.return_value = mock_interaction
        monkeypatch.setattr("src.services.llm_service.genai.Client", lambda **kwargs: mock_client)

        grounded_service = TikTokChannelContextService(
            llm_generator=llm_live,
            http_client_factory=_routed_http_factory,
        )
        grounded_profile = grounded_service.analyze_profile(
            "https://www.tiktok.com/@kaitodeus",
            language="vi",
        )
        assert grounded_profile.niche_category == "Gaming & Creative Storytelling"
        call_kwargs = mock_client.interactions.create.call_args.kwargs
        assert call_kwargs["tools"] == [{"type": "google_search"}]

    def test_gemini_structured_output_enriches_channel_context(self, monkeypatch):
        ssr_html = """
        <html><body>
          <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">
            {"__DEFAULT_SCOPE__": {"webapp.user-detail": {"userInfo": {"user": {"uniqueId": "founder.lab", "nickname": "Founder Lab", "signature": "Startup systems & engineering"}}}, "stats": {"followerCount": 12000}}}
          </script>
        </body></html>
        """
        monkeypatch.setenv("GEMINI_API_KEY", "test-key")
        llm = LLMScriptGenerator(api_key="test-key")
        mock_interaction = MagicMock()
        mock_interaction.output_text = json.dumps(
            {
                "niche_category": "Startup Systems Engineering",
                "content_pillars": ["Event-driven architecture", "Pragmatic startup scaling"],
                "target_audience": "Technical founders and senior engineers",
                "tone_and_style": "Sharp analytical breakdowns with concrete production lessons",
                "detected_language": "en",
                "recommended_theme": "modern_tech",
                "recommended_format": "short",
                "keywords": ["architecture", "startup", "systems"],
                "context_summary": "Founder Lab breaks down high-scale startup architectures into pragmatic 45s lessons.",
                "suggested_prompt": "Break down 3 event-driven architecture wins every early-stage CTO should adopt.",
            }
        )
        mock_client = MagicMock()
        mock_client.interactions.create.return_value = mock_interaction
        monkeypatch.setattr("src.services.llm_service.genai.Client", lambda **kwargs: mock_client)

        service = TikTokChannelContextService(
            llm_generator=llm,
            http_client_factory=_mock_http_factory(200, ssr_html),
        )
        profile = service.analyze_profile("https://www.tiktok.com/@founder.lab", language="en")

        assert profile.niche_category == "Startup Systems Engineering"
        assert "Technical founders" in profile.target_audience
        assert "event-driven architecture" in profile.suggested_prompt.lower()
        call_kwargs = mock_client.interactions.create.call_args.kwargs
        assert "creator strategist" in call_kwargs["system_instruction"].lower()


class TestTikTokEndpointsAndScriptConditioning:
    def test_analyze_endpoint_and_script_generation_with_channel_context(self, monkeypatch):
        from src import main as main_module

        configure_queue_backend(LocalMemoryQueueBackend(shared_jobs_store=main_module.JOBS_STORE))
        client = TestClient(app)

        mock_profile = ChannelContextProfile(
            handle="@kienthuc.ai",
            profile_url="https://www.tiktok.com/@kienthuc.ai",
            display_name="Kiến Thức AI",
            bio="Ứng dụng AI cho công việc văn phòng #AI",
            niche_category="Công nghệ & Ứng dụng AI",
            content_pillars=["Mẹo ChatGPT & Gemini", "Tự động hóa tài liệu"],
            target_audience="Nhân sự văn phòng trẻ",
            tone_and_style="Gần gũi, thực chiến, ngắn gọn trong 45 giây",
            detected_language="vi",
            recommended_theme="modern_tech",
            recommended_format="short",
            keywords=["AI", "Automation"],
            context_summary="Kênh Kiến Thức AI hướng dẫn tự động hóa công việc thực tế.",
            suggested_prompt="3 cách ứng dụng AI rút ngắn nửa ngày làm việc cho dân văn phòng.",
            extraction_source="tiktok_ssr",
        )

        monkeypatch.setattr(
            main_module.channel_context_service,
            "analyze_profile",
            lambda **kwargs: mock_profile,
        )

        # 1. Analyze channel endpoint succeeds with structured context
        resp = client.post(
            "/api/v1/channels/tiktok/analyze",
            json={"profile_url": "https://www.tiktok.com/@kienthuc.ai", "language": "vi"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["handle"] == "@kienthuc.ai"
        assert body["niche_category"] == "Công nghệ & Ứng dụng AI"

        # 2. Generate script passes channel_context through to script output
        gen_resp = client.post(
            "/api/v1/scripts/generate",
            json={
                "prompt": body["suggested_prompt"],
                "language": "vi",
                "aspect_ratio": "9:16",
                "video_format": "short",
                "target_duration_seconds": 30,
                "channel_context": body,
            },
        )
        assert gen_resp.status_code == 200
        script = gen_resp.json()
        assert len(script["slides"]) >= 3
        assert "Kiến Thức AI" in script["slides"][0]["voiceover_script"]

        # 3. Blocked CAPTCHA endpoint maps cleanly to HTTP 422
        def _raise_blocked(**kwargs):
            raise TikTokProfileBlockedError("Captcha verification required.")

        monkeypatch.setattr(main_module.channel_context_service, "analyze_profile", _raise_blocked)
        blocked_resp = client.post(
            "/api/v1/channels/tiktok/analyze",
            json={"profile_url": "https://www.tiktok.com/@blocked.account"},
        )
        assert blocked_resp.status_code == 422
        assert "Captcha" in blocked_resp.json()["detail"]

        # 4. Invalid URL maps cleanly to HTTP 400
        def _raise_invalid(**kwargs):
            raise TikTokProfileError("Unsupported host 'evil.com'.")

        monkeypatch.setattr(main_module.channel_context_service, "analyze_profile", _raise_invalid)
        invalid_resp = client.post(
            "/api/v1/channels/tiktok/analyze",
            json={"profile_url": "https://evil.com/@bad"},
        )
        assert invalid_resp.status_code == 400
