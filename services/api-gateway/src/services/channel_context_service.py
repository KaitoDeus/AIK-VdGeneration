"""
TikTok Channel Context Service.
Extracts public channel metadata from a TikTok profile URL (`https://www.tiktok.com/@handle`
or `@handle`) using SSR rehydration JSON / OpenGraph meta tags and synthesizes creator niche,
target audience, tone of voice, content pillars, and prompt suggestions.
Never bypasses anti-bot or CAPTCHA challenges; surfaces clear feedback cleanly.
"""

from html.parser import HTMLParser
import json
import logging
import re
import unicodedata
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import httpx

from ..schemas import (
    ChannelContextProfile,
    SupportedLanguage,
    TikTokChannelAnalysisInsight,
)
from .llm_service import LLMScriptGenerator

logger = logging.getLogger(__name__)

ALLOWED_TIKTOK_HOSTS = frozenset({"tiktok.com", "www.tiktok.com", "m.tiktok.com"})
HANDLE_PATTERN = re.compile(r"^[A-Za-z0-9._]{2,32}$")
HASHTAG_PATTERN = re.compile(r"#([A-Za-z0-9_\u00C0-\u1EF9]+)")
VI_DIACRITICS_PATTERN = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)

CAPTCHA_MARKERS = (
    "captcha-disable-scroll",
    "tt_captcha",
    "verify-bar",
    "verifycenter",
    "secsdk-captcha",
    "drag the puzzle",
)

CHANNEL_ANALYST_SYSTEM_INSTRUCTION = (
    "You are an expert creator strategist and video producer. "
    "Analyze a TikTok creator profile's name, bio, hashtags, and recent captions to distill "
    "their exact niche, target audience, tone and storytelling style, core content pillars, "
    "best matching visual theme preset ('modern_tech', 'corporate', or 'minimal'), "
    "preferred format ('short' or 'presentation'), and a high-converting presentation/video prompt "
    "written cleanly in the requested language. Return strict JSON matching the provided schema."
)

DEFAULT_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
}


class TikTokProfileError(ValueError):
    """Raised when the provided URL is not a valid public TikTok profile."""


class TikTokProfileBlockedError(RuntimeError):
    """Raised when TikTok gates access behind CAPTCHA/anti-bot verification or blocks scraping."""


class _MetaAndRehydrationParser(HTMLParser):
    """Lightweight stdlib HTML parser capturing OpenGraph meta tags and SSR JSON script blobs."""

    def __init__(self) -> None:
        super().__init__()
        self.meta: Dict[str, str] = {}
        self.title: str = ""
        self._in_title = False
        self._capture_script_id: Optional[str] = None
        self._script_chunks: List[str] = []
        self.scripts: Dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: List[Tuple[str, Optional[str]]]) -> None:
        attr_map = {k.lower(): (v or "") for k, v in attrs}
        if tag == "meta":
            key = (attr_map.get("property") or attr_map.get("name") or "").lower().strip()
            content = attr_map.get("content", "").strip()
            if key and content:
                self.meta[key] = content
        elif tag == "title":
            self._in_title = True
        elif tag == "script":
            script_id = attr_map.get("id", "").strip()
            if script_id in ("__UNIVERSAL_DATA_FOR_REHYDRATION__", "SIGI_STATE"):
                self._capture_script_id = script_id
                self._script_chunks = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._capture_script_id:
            self.scripts[self._capture_script_id] = "".join(self._script_chunks)
            self._capture_script_id = None
            self._script_chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._capture_script_id:
            self._script_chunks.append(data)


def _nfc(text: str) -> str:
    return unicodedata.normalize("NFC", (text or "").strip())


def normalize_tiktok_profile_url(raw_input: str) -> Tuple[str, str]:
    """
    Validates and normalizes a TikTok profile link or @handle into `(@handle, canonical_url)`.
    Strictly rejects non-TikTok domains, credentials, custom ports, and non-profile routes.
    """
    raw = (raw_input or "").strip()
    if not raw:
        raise TikTokProfileError("TikTok profile URL or @handle cannot be empty.")

    if raw.startswith("@") and "/" not in raw and " " not in raw:
        handle = raw.lstrip("@")
        if not HANDLE_PATTERN.match(handle):
            raise TikTokProfileError(
                f"Invalid TikTok handle '@{handle}'. Expected 2-32 letters, digits, dots, or underscores."
            )
        return f"@{handle}", f"https://www.tiktok.com/@{handle}"

    if raw.startswith(("tiktok.com/", "www.tiktok.com/", "m.tiktok.com/")):
        raw = f"https://{raw}"

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise TikTokProfileError(
            "Only http/https TikTok profile URLs or @handles are supported."
        )
    if parsed.username or parsed.password or parsed.port:
        raise TikTokProfileError("URL must not contain credentials or custom ports.")

    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_TIKTOK_HOSTS:
        raise TikTokProfileError(
            f"Unsupported host '{host}'. Please provide a valid tiktok.com/@username profile link."
        )

    segments = [seg for seg in parsed.path.split("/") if seg]
    if not segments or not segments[0].startswith("@"):
        raise TikTokProfileError(
            "URL must point to a TikTok profile (e.g., https://www.tiktok.com/@username)."
        )
    if len(segments) > 1 and segments[1] in ("video", "photo"):
        raise TikTokProfileError(
            "Please enter a TikTok profile link (https://www.tiktok.com/@username), not an individual video link."
        )

    handle = segments[0].lstrip("@")
    if not HANDLE_PATTERN.match(handle):
        raise TikTokProfileError(
            f"Invalid TikTok handle '@{handle}' in profile URL."
        )
    return f"@{handle}", f"https://www.tiktok.com/@{handle}"


def _parse_compact_count(raw: str) -> Optional[int]:
    """Parses compact social metric strings such as '12.5K', '1.4M', or '850' into integers."""
    cleaned = raw.strip().upper().replace(",", "")
    match = re.match(r"^(\d+(?:\.\d+)?)\s*([KMB]?)$", cleaned)
    if not match:
        return None
    val = float(match.group(1))
    suffix = match.group(2)
    multiplier = {"": 1, "K": 1_000, "M": 1_000_000, "B": 1_000_000_000}[suffix]
    return int(round(val * multiplier))


def _contains_captcha_gate(html_text: str) -> bool:
    lowered = html_text.lower()
    return any(marker in lowered for marker in CAPTCHA_MARKERS)


def _extract_hashtags(texts: List[str]) -> List[str]:
    seen = set()
    ordered: List[str] = []
    for txt in texts:
        for match in HASHTAG_PATTERN.findall(txt or ""):
            tag = f"#{match}"
            low = tag.lower()
            if low not in seen:
                seen.add(low)
                ordered.append(tag)
    return ordered[:10]


def _extract_recent_post_captions(payload: Any) -> Tuple[List[str], List[str]]:
    """Scans optional post item lists embedded inside TikTok SSR payloads cleanly."""
    titles: List[str] = []
    extra_tags: List[str] = []

    def _walk(node: Any, depth: int = 0, in_item_collection: bool = False) -> None:
        if depth > 6 or len(titles) >= 8:
            return
        if isinstance(node, dict):
            has_item_fields = (
                "video" in node
                or "aweme_id" in node
                or "stats" in node
                or "textExtra" in node
                or "createTime" in node
            )
            if "desc" in node and isinstance(node.get("desc"), str) and (
                in_item_collection or has_item_fields
            ):
                desc = _nfc(node["desc"])
                if desc and desc not in titles:
                    titles.append(desc[:180])
            text_extra = node.get("textExtra")
            if isinstance(text_extra, list):
                for item in text_extra:
                    if isinstance(item, dict) and item.get("hashtagName"):
                        extra_tags.append(f"#{item['hashtagName']}")
            for k, v in node.items():
                is_collection = in_item_collection or k in ("itemList", "ItemModule", "item_list")
                _walk(v, depth + 1, is_collection)
        elif isinstance(node, list):
            for elem in node[:20]:
                _walk(elem, depth + 1, in_item_collection)

    _walk(payload)
    return titles, extra_tags


def _parse_ssr_and_meta(html_text: str, handle: str) -> Dict[str, Any]:
    """Parses TikTok SSR JSON blobs and OpenGraph metadata into normalized raw profile fields."""
    parser = _MetaAndRehydrationParser()
    parser.feed(html_text)

    data: Dict[str, Any] = {
        "display_name": handle.lstrip("@"),
        "bio": "",
        "avatar_url": parser.meta.get("og:image") or None,
        "follower_count": None,
        "following_count": None,
        "likes_count": None,
        "video_count": None,
        "verified": False,
        "recent_video_titles": [],
        "hashtags": [],
        "extraction_source": None,
    }

    rehydration_raw = parser.scripts.get("__UNIVERSAL_DATA_FOR_REHYDRATION__") or parser.scripts.get(
        "SIGI_STATE"
    )
    if rehydration_raw:
        try:
            blob = json.loads(rehydration_raw)
            default_scope = blob.get("__DEFAULT_SCOPE__", {}) if isinstance(blob, dict) else {}
            user_detail = default_scope.get("webapp.user-detail") or {}
            user_info = user_detail.get("userInfo") or {}
            user = user_info.get("user") or {}
            stats = user_info.get("stats") or {}

            # SIGI_STATE fallback shape
            if not user and isinstance(blob, dict) and isinstance(blob.get("UserModule"), dict):
                users_map = blob["UserModule"].get("users") or {}
                stats_map = blob["UserModule"].get("stats") or {}
                if users_map:
                    first_key = next(iter(users_map.keys()))
                    user = users_map.get(first_key) or {}
                    stats = stats_map.get(first_key) or {}

            if user:
                data["display_name"] = _nfc(
                    str(user.get("nickname") or user.get("uniqueId") or data["display_name"])
                )
                data["bio"] = _nfc(str(user.get("signature") or ""))
                data["avatar_url"] = (
                    user.get("avatarLarger")
                    or user.get("avatarMedium")
                    or user.get("avatarThumb")
                    or data["avatar_url"]
                )
                data["verified"] = bool(user.get("verified", False))
                data["extraction_source"] = "tiktok_ssr"

            if stats:
                for key, target in (
                    ("followerCount", "follower_count"),
                    ("followingCount", "following_count"),
                    ("heartCount", "likes_count"),
                    ("heart", "likes_count"),
                    ("videoCount", "video_count"),
                ):
                    if isinstance(stats.get(key), (int, float)) and data[target] is None:
                        data[target] = int(stats[key])

            recent_titles, extra_tags = _extract_recent_post_captions(blob)
            data["recent_video_titles"] = recent_titles
            data["hashtags"] = extra_tags
        except json.JSONDecodeError:
            logger.debug("Unable to decode TikTok SSR JSON blob cleanly; falling back to OpenGraph.")

    og_title = _nfc(parser.meta.get("og:title") or parser.title or "")
    og_desc = _nfc(parser.meta.get("og:description") or parser.meta.get("description") or "")

    if og_title and data["display_name"] == handle.lstrip("@"):
        clean_og_title = re.sub(r"\s*\(@[^)]+\)\s*.*$", "", og_title).strip()
        if clean_og_title and "tiktok" not in clean_og_title.lower():
            data["display_name"] = clean_og_title

    if og_desc:
        likes_match = re.search(r"([\d.,]+[KMB]?)\s+Likes\b", og_desc, re.IGNORECASE)
        followers_match = re.search(r"([\d.,]+[KMB]?)\s+Followers\b", og_desc, re.IGNORECASE)
        if likes_match and data["likes_count"] is None:
            data["likes_count"] = _parse_compact_count(likes_match.group(1))
        if followers_match and data["follower_count"] is None:
            data["follower_count"] = _parse_compact_count(followers_match.group(1))

        if not data["bio"]:
            stripped = re.sub(
                r"^.*?(?:on TikTok\s*\|\s*(?:[\d.,]+[KMB]?\s*Likes\.\s*)?(?:[\d.,]+[KMB]?\s*Followers\.\s*)?)",
                "",
                og_desc,
                flags=re.IGNORECASE,
            )
            stripped = re.sub(r"Watch the latest video from .*$", "", stripped, flags=re.IGNORECASE).strip(" .|")
            if stripped and len(stripped) >= 3:
                data["bio"] = _nfc(stripped)

    has_specific_og_profile = bool(
        (og_desc and ("followers" in og_desc.lower() or "likes" in og_desc.lower() or handle.lower() in og_desc.lower()))
        or (og_title and handle.lstrip("@").lower() in og_title.lower() and "@" in og_title)
        or (data["bio"] and len(data["bio"]) >= 4)
    )
    if data["extraction_source"] is None and has_specific_og_profile:
        data["extraction_source"] = "tiktok_og_meta"

    combined_texts = [data["bio"], og_desc] + list(data["recent_video_titles"])
    data["hashtags"] = _extract_hashtags(combined_texts + data["hashtags"])
    return data


def _detect_language(text: str, preferred_language: Optional[SupportedLanguage]) -> SupportedLanguage:
    if VI_DIACRITICS_PATTERN.search(text or ""):
        return "vi"
    if preferred_language in ("vi", "en"):
        return preferred_language
    lowered = (text or "").lower()
    if any(tok in lowered for tok in ("kênh", "chia sẻ", "công nghệ", "hướng dẫn", "kinh doanh", "kiếm tiền")):
        return "vi"
    return "en"


def _classify_niche_and_style(
    combined_text: str, output_lang: SupportedLanguage
) -> Tuple[str, str, str, str, str]:
    """Deterministic niche, audience, tone, and visual preset classification."""
    lower = combined_text.lower()
    is_vi = output_lang == "vi"

    if any(k in lower for k in ("ai", "tech", "code", "dev", "software", "công nghệ", "lập trình", "tool", "automation")):
        return (
            "Công nghệ & Ứng dụng AI" if is_vi else "Technology, AI & Productivity Tools",
            "Người đi làm trẻ, lập trình viên và người muốn tối ưu hiệu suất bằng công nghệ"
            if is_vi
            else "Creators, developers, and professionals adopting practical AI workflows",
            "Nhịp nhanh, trực diện, mở đầu bằng kết quả thực tế và hướng dẫn từng bước"
            if is_vi
            else "Fast-paced, hands-on, hook-driven demos with clear actionable takeaways",
            "modern_tech",
            "short",
        )
    if any(k in lower for k in ("marketing", "business", "b2b", "sales", "kinh doanh", "thương hiệu", "khởi nghiệp", "tài chính", "startup")):
        return (
            "Kinh doanh, Marketing & Thương hiệu" if is_vi else "Business Strategy, B2B Growth & Marketing",
            "Chủ doanh nghiệp, marketer và người xây dựng thương hiệu cá nhân"
            if is_vi
            else "Founders, growth marketers, and B2B decision makers",
            "Chuyên nghiệp, sắc bén theo case study thực tế và số liệu thuyết phục"
            if is_vi
            else "Authoritative, metric-focused, case-study driven storytelling",
            "corporate",
            "short",
        )
    if any(k in lower for k in ("học", "education", "study", "english", "review", "kiến thức", "sách", "tối giản", "design", "thiết kế")):
        return (
            "Giáo dục & Chia sẻ Kiến thức" if is_vi else "Education, Learning & Visual Insights",
            "Học sinh, sinh viên và người học kỹ năng mới mỗi ngày"
            if is_vi
            else "Lifelong learners, students, and knowledge seekers",
            "Gần gũi, mạch lạc, giải thích khái niệm phức tạp theo cách dễ hiểu"
            if is_vi
            else "Clear, approachable explanations turning dense concepts into concise visual lessons",
            "minimal",
            "short",
        )
    return (
        "Sáng tạo Nội dung Đa chủ đề" if is_vi else "Creator Storytelling & Digital Media",
        "Khán giả trẻ quan tâm câu chuyện thực tế và mẹo ứng dụng nhanh"
        if is_vi
        else "General digital audience looking for crisp stories and practical tips",
        "Tự nhiên, súc tích, tập trung giữ nhịp người xem trong 30-45 giây"
        if is_vi
        else "Conversational, concise short-form storytelling built around strong hooks",
        "modern_tech",
        "short",
    )


class TikTokChannelContextService:
    """Fetches public TikTok creator profile context and summarizes actionable script persona."""

    def __init__(
        self,
        llm_generator: Optional[LLMScriptGenerator] = None,
        timeout_seconds: float = 15.0,
        http_client_factory: Optional[Callable[[], httpx.Client]] = None,
    ) -> None:
        self.llm_generator = llm_generator or LLMScriptGenerator()
        self.timeout_seconds = timeout_seconds
        self.http_client_factory = http_client_factory

    def _fetch_html(self, profile_url: str) -> Tuple[int, str]:
        if self.http_client_factory is not None:
            client = self.http_client_factory()
            with client:
                resp = client.get(profile_url, headers=DEFAULT_REQUEST_HEADERS, follow_redirects=True)
                return resp.status_code, resp.text
        with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
            resp = client.get(profile_url, headers=DEFAULT_REQUEST_HEADERS)
            return resp.status_code, resp.text

    def _fallback_analysis(
        self,
        handle: str,
        display_name: str,
        bio: str,
        recent_titles: List[str],
        hashtags: List[str],
        manual_notes: Optional[str],
        preferred_language: Optional[SupportedLanguage],
    ) -> TikTokChannelAnalysisInsight:
        combined = " | ".join(
            part for part in [display_name, bio, manual_notes or "", " ".join(recent_titles), " ".join(hashtags)] if part
        )
        detected_lang = _detect_language(combined, preferred_language)
        output_lang = preferred_language or detected_lang

        niche, audience, tone, rec_theme, rec_format = _classify_niche_and_style(
            combined, output_lang
        )

        clean_tags = [tag.lstrip("#") for tag in hashtags[:4]]
        raw_pillars: List[str] = []
        if bio:
            for chunk in re.split(r"[,|•·/\n]+", bio):
                cleaned = _nfc(chunk).strip(" -.")
                if len(cleaned) >= 4 and len(cleaned.split()) <= 10:
                    raw_pillars.append(cleaned)
        if not raw_pillars and recent_titles:
            for title in recent_titles[:3]:
                trimmed = _nfc(re.sub(r"#\S+", "", title)).strip(" -.")
                if len(trimmed) >= 5:
                    raw_pillars.append(trimmed[:60])
        if not raw_pillars and clean_tags:
            raw_pillars = [f"Chủ đề #{t}" if output_lang == "vi" else f"Topic #{t}" for t in clean_tags[:3]]
        if not raw_pillars:
            raw_pillars = (
                ["Chia sẻ kinh nghiệm thực tế", "Giải thích nhanh xu hướng mới", "Mẹo ứng dụng hàng ngày"]
                if output_lang == "vi"
                else ["Practical step-by-step breakdowns", "Trend analysis", "Actionable daily tips"]
            )
        pillars = raw_pillars[:4]

        keywords = list(dict.fromkeys(clean_tags + [display_name.strip(), niche]))[:8]
        focus_phrase = pillars[0] if pillars else niche
        if output_lang == "vi":
            context_summary = (
                f"Kênh {display_name} ({handle}) tập trung vào mảng {niche}, hướng tới {audience.lower()} "
                f"với phong cách {tone.lower()}."
            )
            suggested_prompt = (
                f"Tạo video ngắn cuốn hút đúng phong cách kênh {handle} ({display_name}) về chủ đề {focus_phrase}, "
                f"nhấn mạnh các điểm chính dễ áp dụng cho {audience.lower()}."
            )
        else:
            context_summary = (
                f"Creator {display_name} ({handle}) focuses on {niche}, reaching {audience.lower()} "
                f"through {tone.lower()}."
            )
            suggested_prompt = (
                f"Create a punchy short presentation tailored to {handle} ({display_name}) covering {focus_phrase}, "
                f"built for {audience.lower()} with an engaging opening hook."
            )

        return TikTokChannelAnalysisInsight(
            niche_category=_nfc(niche),
            content_pillars=[_nfc(p) for p in pillars],
            target_audience=_nfc(audience),
            tone_and_style=_nfc(tone),
            detected_language=detected_lang,
            recommended_theme=rec_theme,  # type: ignore[arg-type]
            recommended_format=rec_format,  # type: ignore[arg-type]
            keywords=[_nfc(k) for k in keywords if k],
            context_summary=_nfc(context_summary),
            suggested_prompt=_nfc(suggested_prompt),
        )

    def _synthesize_insights(
        self,
        handle: str,
        profile_url: str,
        raw_meta: Dict[str, Any],
        manual_notes: Optional[str],
        preferred_language: Optional[SupportedLanguage],
        model_override: Optional[str],
    ) -> TikTokChannelAnalysisInsight:
        fallback = self._fallback_analysis(
            handle=handle,
            display_name=raw_meta["display_name"],
            bio=raw_meta["bio"],
            recent_titles=raw_meta["recent_video_titles"],
            hashtags=raw_meta["hashtags"],
            manual_notes=manual_notes,
            preferred_language=preferred_language,
        )

        if not self.llm_generator.api_key or self.llm_generator.api_key == "your_gemini_api_key_here":
            return fallback

        target_lang = preferred_language or fallback.detected_language
        lang_instruction = (
            "Write niche_category, content_pillars, target_audience, tone_and_style, context_summary, "
            "and suggested_prompt in natural Vietnamese."
            if target_lang == "vi"
            else "Write all descriptive fields and suggested_prompt in clear English."
        )
        llm_prompt = (
            "Analyze the following public TikTok creator profile to extract actionable channel context "
            "for generating matched video scripts.\n"
            f"Profile URL: {profile_url}\n"
            f"Handle: {handle}\n"
            f"Display Name: {raw_meta['display_name']}\n"
            f"Bio / Signature: {raw_meta['bio'] or 'N/A'}\n"
            f"Followers: {raw_meta.get('follower_count') or 'Unknown'} | "
            f"Videos: {raw_meta.get('video_count') or 'Unknown'}\n"
            f"Hashtags: {', '.join(raw_meta.get('hashtags') or []) or 'None'}\n"
            f"Recent Public Video Captions: {json.dumps(raw_meta.get('recent_video_titles') or [], ensure_ascii=False)}\n"
            f"User Supplemental Notes: {manual_notes or 'None'}\n\n"
            f"Language Rule: {lang_instruction}\n"
            "Return strict JSON matching the TikTokChannelAnalysisInsight schema."
        )
        try:
            insight, _ = self.llm_generator._invoke_gemini_structured_json(
                user_input=llm_prompt,
                response_schema_model=TikTokChannelAnalysisInsight,
                model_override=model_override,
                system_instruction=CHANNEL_ANALYST_SYSTEM_INSTRUCTION,
            )
            return insight
        except Exception as exc:
            logger.warning(
                "Gemini channel insight synthesis failed (%s). Using deterministic profile fallback.",
                exc,
            )
            return fallback

    def analyze_profile(
        self,
        profile_url: str,
        language: Optional[SupportedLanguage] = None,
        manual_notes: Optional[str] = None,
        model_override: Optional[str] = None,
    ) -> ChannelContextProfile:
        """
        Fetches public metadata for a TikTok creator profile link and returns rich
        ChannelContextProfile insights ready to condition script generation.
        """
        handle, canonical_url = normalize_tiktok_profile_url(profile_url)
        cleaned_notes = _nfc(manual_notes) if manual_notes and manual_notes.strip() else None

        blocked_by_captcha = False
        fetch_warning: Optional[str] = None
        raw_meta: Dict[str, Any] = {
            "display_name": handle.lstrip("@"),
            "bio": "",
            "avatar_url": None,
            "follower_count": None,
            "following_count": None,
            "likes_count": None,
            "video_count": None,
            "verified": False,
            "recent_video_titles": [],
            "hashtags": [],
            "extraction_source": None,
        }

        try:
            status_code, html_text = self._fetch_html(canonical_url)
            if status_code >= 400 or _contains_captcha_gate(html_text):
                blocked_by_captcha = True
                fetch_warning = (
                    "TikTok gated direct automated profile access behind verification (HTTP/anti-bot check)."
                )
            else:
                parsed = _parse_ssr_and_meta(html_text, handle)
                raw_meta.update(parsed)
        except httpx.HTTPError as exc:
            blocked_by_captcha = True
            fetch_warning = f"Unable to fetch public TikTok profile directly ({exc})."

        if raw_meta["extraction_source"] is None:
            if cleaned_notes:
                raw_meta["extraction_source"] = "manual_notes"
                raw_meta["bio"] = cleaned_notes[:400]
                raw_meta["hashtags"] = _extract_hashtags([cleaned_notes])
            else:
                msg = (
                    fetch_warning
                    or "TikTok returned empty public profile metadata (anti-bot protection or private account)."
                )
                raise TikTokProfileBlockedError(
                    f"{msg} Please paste the channel bio or sample video topics into Channel Notes to analyze without bypassing protection."
                )

        insights = self._synthesize_insights(
            handle=handle,
            profile_url=canonical_url,
            raw_meta=raw_meta,
            manual_notes=cleaned_notes,
            preferred_language=language,
            model_override=model_override,
        )

        return ChannelContextProfile(
            handle=handle,
            profile_url=canonical_url,
            display_name=_nfc(raw_meta["display_name"]),
            bio=_nfc(raw_meta["bio"]),
            avatar_url=raw_meta["avatar_url"],
            follower_count=raw_meta["follower_count"],
            following_count=raw_meta["following_count"],
            likes_count=raw_meta["likes_count"],
            video_count=raw_meta["video_count"],
            verified=raw_meta["verified"],
            recent_video_titles=[_nfc(t) for t in raw_meta["recent_video_titles"]],
            hashtags=raw_meta["hashtags"],
            niche_category=_nfc(insights.niche_category),
            content_pillars=[_nfc(p) for p in insights.content_pillars],
            target_audience=_nfc(insights.target_audience),
            tone_and_style=_nfc(insights.tone_and_style),
            detected_language=insights.detected_language,
            recommended_theme=insights.recommended_theme,
            recommended_format=insights.recommended_format,
            keywords=[_nfc(k) for k in insights.keywords],
            context_summary=_nfc(insights.context_summary),
            suggested_prompt=_nfc(insights.suggested_prompt),
            extraction_source=raw_meta["extraction_source"],
            blocked_by_captcha=blocked_by_captcha,
            fetch_warning=fetch_warning,
        )
