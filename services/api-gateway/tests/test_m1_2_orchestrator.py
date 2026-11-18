"""
Automated Verification & Test Suite for Milestone M1.2:
Orchestrator & Gemini 3.8 Flash LLM Script Generation.
"""

import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest
from pydantic import ValidationError

from src.main import JOBS_STORE, TEMP_JOBS_DIR, app
from src.schemas import PresentationScript, SlideScriptItem
from src.services.llm_service import LLMScriptGenerator


client = TestClient(app)


def _sample_valid_script_dict(language: str = "vi") -> dict:
    return {
        "title": "Cloud Computing Explained",
        "language": language,
        "theme": "modern_tech",
        "slides": [
            {
                "slide_index": 10,  # Intentionally non-sequential to test normalization
                "layout": "title_intro",
                "heading": "What is Cloud Computing?",
                "bullet_points": [
                    "On-demand computing resources",
                    "Pay-as-you-go scalability",
                ],
                "voiceover_script": "Welcome to our guide on cloud computing. Let us explore how it works.",
                "visual_keywords": "cloud servers data center",
            },
            {
                "slide_index": 20,
                "layout": "bullet_list",
                "heading": "Core Service Models",
                "bullet_points": [
                    "Infrastructure as a Service (IaaS)",
                    "Platform as a Service (PaaS)",
                    "Software as a Service (SaaS)",
                ],
                "voiceover_script": "Cloud computing is divided into three main service models for different needs.",
                "visual_keywords": "software architecture layers diagram",
            },
            {
                "slide_index": 30,
                "layout": "conclusion_cta",
                "heading": "Start Building in the Cloud",
                "bullet_points": [
                    "Deploy globally in minutes",
                    "Scale effortlessly with traffic",
                ],
                "voiceover_script": "You are now ready to deploy your first cloud workload today.",
                "visual_keywords": "global network rocket launch",
            },
        ],
    }


class TestSchemaContracts:
    """Verifies strict adherence to docs/API_SPEC.md and video-prompt-engineering SKILL.md."""

    def test_valid_presentation_script_passes(self):
        data = _sample_valid_script_dict("en")
        script = PresentationScript.model_validate(data)
        assert script.title == "Cloud Computing Explained"
        assert script.language == "en"
        assert len(script.slides) == 3

    def test_rejects_fewer_than_3_slides(self):
        data = _sample_valid_script_dict("en")
        data["slides"] = data["slides"][:2]
        with pytest.raises(ValidationError):
            PresentationScript.model_validate(data)

    def test_rejects_more_than_5_bullet_points(self):
        with pytest.raises(ValidationError):
            SlideScriptItem(
                slide_index=1,
                layout="bullet_list",
                heading="Too Many Bullets",
                bullet_points=["One", "Two", "Three", "Four", "Five", "Six"],
                voiceover_script="This slide has six bullets which violates the max 5 rule.",
                visual_keywords="crowded slide text",
            )

    def test_rejects_blank_heading_or_voiceover(self):
        with pytest.raises(ValidationError):
            SlideScriptItem(
                slide_index=1,
                layout="title_intro",
                heading="   ",
                bullet_points=["Valid point"],
                voiceover_script="Valid voiceover script.",
                visual_keywords="valid keywords",
            )

    def test_rejects_invalid_layout_enum(self):
        with pytest.raises(ValidationError):
            SlideScriptItem(
                slide_index=1,
                layout="unknown_layout",  # type: ignore
                heading="Valid Heading",
                bullet_points=["Point 1"],
                voiceover_script="Valid voiceover.",
                visual_keywords="keywords",
            )


class TestLLMScriptGenerator:
    """Verifies Gemini 3.8 Flash Interactions API integration, retry logic, and model fallback."""

    @patch("src.services.llm_service.genai.Client")
    def test_gemini_3_8_flash_interactions_api_structured_output(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        raw_json = json.dumps(_sample_valid_script_dict("vi"))
        mock_client.interactions.create.return_value = SimpleNamespace(output_text=raw_json)

        generator = LLMScriptGenerator(
            api_key="test-live-gemini-key",
            default_model="gemini-3.8-flash",
            fallback_model="gemini-4-hydrogen",
        )
        script, model_used = generator.generate_script(
            prompt="Explain cloud computing for beginners",
            language="vi",
            target_duration_seconds=45,
            theme="modern_tech",
        )

        assert model_used == "gemini-3.8-flash"
        assert isinstance(script, PresentationScript)
        assert script.language == "vi"
        # Verify slide indices were normalized to 1, 2, 3
        assert [s.slide_index for s in script.slides] == [1, 2, 3]

        # Verify Interactions API call parameters
        call_kwargs = mock_client.interactions.create.call_args.kwargs
        assert call_kwargs["model"] == "gemini-3.8-flash"
        assert call_kwargs["response_format"]["type"] == "text"
        assert call_kwargs["response_format"]["mime_type"] == "application/json"
        assert "slides" in call_kwargs["response_format"]["schema"]["properties"]

    @patch("src.services.llm_service.genai.Client")
    def test_automatic_fallback_on_404_model_not_found(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        raw_json = json.dumps(_sample_valid_script_dict("en"))
        mock_client.interactions.create.side_effect = [
            RuntimeError("404 NOT_FOUND: Model gemini-3.8-flash not found"),
            SimpleNamespace(output_text=raw_json),
        ]

        generator = LLMScriptGenerator(
            api_key="test-live-gemini-key",
            default_model="gemini-3.8-flash",
            fallback_model="gemini-4-hydrogen",
            max_retries=2,
        )
        script, model_used = generator.generate_script(
            prompt="Cloud architecture",
            language="en",
        )

        assert model_used == "gemini-4-hydrogen"
        assert len(script.slides) == 3
        assert mock_client.interactions.create.call_count == 2

    @patch("src.services.llm_service.time.sleep", return_value=None)
    @patch("src.services.llm_service.genai.Client")
    def test_retry_on_malformed_json_then_succeed(self, mock_client_cls, _mock_sleep):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        raw_json = json.dumps(_sample_valid_script_dict("en"))
        mock_client.interactions.create.side_effect = [
            SimpleNamespace(output_text="{invalid json"),
            SimpleNamespace(output_text=raw_json),
        ]

        generator = LLMScriptGenerator(
            api_key="test-live-gemini-key",
            default_model="gemini-3.8-flash",
            max_retries=3,
        )
        script, model_used = generator.generate_script(prompt="Retry test", language="en")

        assert model_used == "gemini-3.8-flash"
        assert len(script.slides) == 3
        assert mock_client.interactions.create.call_count == 2

    def test_local_mock_fallback_when_api_key_missing(self):
        generator = LLMScriptGenerator(api_key="", default_model="gemini-3.8-flash")
        script, model_used = generator.generate_script(
            prompt="AI Video Generation Architecture",
            language="en",
        )
        assert "mock-fallback" in model_used
        assert len(script.slides) == 3
        assert script.slides[0].layout == "title_intro"

    def test_local_mock_fallback_vietnamese_uses_pure_vietnamese_and_clean_trim(self):
        generator = LLMScriptGenerator(api_key="", default_model="gemini-3.8-flash")
        long_prompt = (
            "Giải thích nguyên lý hoạt động của Điện toán Đám mây (Cloud Computing) "
            "và ba mô hình IaaS, PaaS, SaaS cho người mới bắt đầu."
        )
        script, model_used = generator.generate_script(
            prompt=long_prompt,
            language="vi",
        )
        assert "mock-fallback" in model_used
        assert script.language == "vi"
        assert script.title.startswith("Chuyên đề:")
        # Ensures word-boundary truncation leaves no dangling open parenthesis like "(Cloud"
        assert "(Cloud" not in script.title
        joined_voiceovers = " ".join(s.voiceover_script for s in script.slides)
        assert "Chào mừng bạn" in joined_voiceovers
        assert "Welcome to this presentation" not in joined_voiceovers
        assert "primary pillars" not in joined_voiceovers
        for slide in script.slides:
            assert "Welcome" not in slide.heading
            assert "Overview" not in slide.heading


class TestAPIGatewayEndpoints:
    """Verifies FastAPI Orchestrator HTTP endpoints and background job persistence."""

    def test_health_endpoint(self):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "healthy"
        assert body["default_llm_model"] == "gemini-3.8-flash"
        assert body["fallback_llm_model"] == "gemini-4-hydrogen"

    def test_synchronous_script_generate_endpoint(self):
        response = client.post(
            "/api/v1/scripts/generate",
            json={
                "prompt": "Introduction to Microservices Architecture",
                "language": "en",
                "target_duration_seconds": 45,
                "theme": "modern_tech",
            },
        )
        assert response.status_code == 200
        data = response.json()
        validated = PresentationScript.model_validate(data)
        assert len(validated.slides) >= 3
        assert validated.language == "en"

    def test_async_video_generate_and_job_status_persistence(self):
        response = client.post(
            "/api/v1/videos/generate",
            json={
                "prompt": "Explain Kubernetes in 60 seconds",
                "language": "vi",
                "aspect_ratio": "16:9",
                "target_duration_seconds": 60,
            },
        )
        assert response.status_code == 202
        job_data = response.json()
        job_id = job_data["job_id"]
        assert job_id.startswith("job_")
        assert job_data["status"] == "queued"

        # Query job status after BackgroundTasks completion
        status_resp = client.get(f"/api/v1/jobs/{job_id}")
        assert status_resp.status_code == 200
        status_body = status_resp.json()
        assert status_body["status"] in ("script_ready", "audio_ready")
        assert status_body["progress_percentage"] >= 40
        assert status_body["script"] is not None
        assert len(status_body["script"]["slides"]) >= 3

        # Verify artifact file was persisted on disk
        persisted_file: Path = TEMP_JOBS_DIR / job_id / "script.json"
        assert persisted_file.exists()
        disk_script = PresentationScript.model_validate_json(
            persisted_file.read_text(encoding="utf-8")
        )
        assert disk_script.language == "vi"

        # Clean up test artifact directory
        import shutil
        shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)
        JOBS_STORE.pop(job_id, None)

    def test_generate_and_expand_plus_10_slides_vietnamese_and_capacity_guard(self):
        # 1. Start with a 3-slide Vietnamese deck
        gen_resp = client.post(
            "/api/v1/scripts/generate",
            json={
                "prompt": "Kiến trúc Microservices hiện đại",
                "language": "vi",
                "target_duration_seconds": 60,
                "theme": "modern_tech",
            },
        )
        assert gen_resp.status_code == 200
        initial_script = PresentationScript.model_validate(gen_resp.json())
        assert len(initial_script.slides) == 3

        # 2. Auto-expand +10 continuation slides -> total 13 sequential Vietnamese slides
        expand_resp = client.post(
            "/api/v1/scripts/expand",
            json={
                "script": initial_script.model_dump(),
                "additional_slides": 10,
                "topic_hint": "Microservices patterns",
            },
        )
        assert expand_resp.status_code == 200
        expanded = PresentationScript.model_validate(expand_resp.json())
        assert len(expanded.slides) == 13
        assert [s.slide_index for s in expanded.slides] == list(range(1, 14))
        # New deep-dive slides stay positioned before trailing CTA slide
        assert expanded.slides[-1].layout == "conclusion_cta"
        assert len({s.heading for s in expanded.slides}) == 13

        # 3. Direct generation with target_slides=13 also works cleanly
        direct_13 = client.post(
            "/api/v1/scripts/generate",
            json={
                "prompt": "Cloud-Native Observability",
                "language": "en",
                "target_slides": 13,
            },
        )
        assert direct_13.status_code == 200
        assert len(direct_13.json()["slides"]) == 13

        # 4. Deck at max 30 slides returns clear 400 error if expanded further
        full_deck = PresentationScript(
            title=expanded.title,
            language="vi",
            theme="modern_tech",
            slides=[
                SlideScriptItem(
                    slide_index=i,
                    layout="bullet_list",
                    heading=f"Slide {i}",
                    bullet_points=["Chi tiết 1", "Chi tiết 2"],
                    voiceover_script=f"Nội dung thuyết trình cho slide số {i}.",
                    visual_keywords="abstract minimal slide",
                )
                for i in range(1, 31)
            ],
        )
        capped_resp = client.post(
            "/api/v1/scripts/expand",
            json={"script": full_deck.model_dump(), "additional_slides": 10},
        )
        assert capped_resp.status_code == 400

    @patch("src.services.llm_service.genai.Client")
    def test_expand_script_with_gemini_structured_outputs(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        batch_payload = {
            "slides": [
                {
                    "slide_index": i,
                    "layout": "split_card" if i % 2 else "bullet_list",
                    "heading": f"Deep Dive Concept {i}",
                    "bullet_points": ["Detailed insight", "Architecture benefit"],
                    "voiceover_script": f"Exploring advanced concept number {i} in detail.",
                    "visual_keywords": "modern tech diagram",
                }
                for i in range(1, 11)
            ]
        }
        mock_client.interactions.create.return_value = SimpleNamespace(
            output_text=json.dumps(batch_payload)
        )

        generator = LLMScriptGenerator(api_key="test-live-gemini-key", default_model="gemini-3.8-flash")
        base_script = PresentationScript.model_validate(_sample_valid_script_dict("en"))
        expanded, model_used = generator.expand_script(base_script, additional_slides=10)

        assert model_used == "gemini-3.8-flash"
        assert len(expanded.slides) == 13
        assert expanded.slides[-1].layout == "conclusion_cta"
        assert [s.slide_index for s in expanded.slides] == list(range(1, 14))
