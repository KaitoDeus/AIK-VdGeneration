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
import os
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
ALLOWED_TIKTOK_VIDEO_HOSTS = frozenset(
    {"tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"}
)
HANDLE_PATTERN = re.compile(r"^[A-Za-z0-9._]{2,32}$")
SHORT_VIDEO_CODE_PATTERN = re.compile(r"^[A-Za-z0-9_-]{4,32}$")
UNVERIFIED_CHANNEL_MARKER = "UNVERIFIED_CHANNEL_DATA"
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
    "slardarwaf",
    "slardar_us_waf",
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


def normalize_tiktok_video_url(raw_input: str) -> str:
    """
    Validates and normalizes a creator TikTok video/photo URL for official TikTok oEmbed lookup.
    Rejects non-TikTok domains, credentials, custom ports, and profile-only URLs to prevent SSRF.
    """
    raw = (raw_input or "").strip()
    if not raw:
        raise TikTokProfileError("TikTok video URL cannot be empty.")

    if raw.startswith("@"):
        raw = f"https://www.tiktok.com/{raw}"
    elif raw.startswith(("tiktok.com/", "www.tiktok.com/", "m.tiktok.com/", "vm.tiktok.com/", "vt.tiktok.com/")):
        raw = f"https://{raw}"

    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https"):
        raise TikTokProfileError("Only http/https TikTok video URLs are supported.")
    if parsed.username or parsed.password or parsed.port:
        raise TikTokProfileError("Video URL must not contain credentials or custom ports.")

    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_TIKTOK_VIDEO_HOSTS:
        raise TikTokProfileError(
            f"Unsupported host '{host}' in video URL. Expected tiktok.com video link."
        )

    segments = [seg for seg in parsed.path.split("/") if seg]
    if host in ("vm.tiktok.com", "vt.tiktok.com"):
        if len(segments) != 1 or not SHORT_VIDEO_CODE_PATTERN.match(segments[0]):
            raise TikTokProfileError(f"Invalid short TikTok video URL: '{raw_input}'.")
        return f"https://{host}/{segments[0]}"

    if (
        len(segments) < 3
        or not segments[0].startswith("@")
        or not HANDLE_PATTERN.match(segments[0].lstrip("@"))
        or segments[1] not in ("video", "photo")
        or not segments[2].isdigit()
    ):
        raise TikTokProfileError(
            f"Invalid TikTok video URL '{raw_input}'. Expected https://www.tiktok.com/@username/video/<id>."
        )

    return f"https://www.tiktok.com/{segments[0]}/{segments[1]}/{segments[2]}"


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

    if re.search(
        r"(?<![a-z0-9])(ai|tech|code|dev|software|tool|automation|công nghệ|lập trình)(?![a-z0-9])",
        lower,
    ):
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
    if re.search(
        r"(?<![a-z0-9])(marketing|business|b2b|sales|startup|kinh doanh|thương hiệu|khởi nghiệp|tài chính)(?![a-z0-9])",
        lower,
    ):
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
    if re.search(
        r"(?<![a-z0-9])(education|study|english|review|design|học|kiến thức|sách|tối giản|thiết kế)(?![a-z0-9])",
        lower,
    ):
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

    def _build_http_client(self, timeout_seconds: Optional[float] = None) -> httpx.Client:
        if self.http_client_factory is not None:
            return self.http_client_factory()
        return httpx.Client(
            timeout=timeout_seconds or self.timeout_seconds,
            follow_redirects=True,
        )

    def _fetch_html(self, profile_url: str) -> Tuple[int, str]:
        with self._build_http_client() as client:
            resp = client.get(profile_url, headers=DEFAULT_REQUEST_HEADERS, follow_redirects=True)
            return resp.status_code, resp.text

    def _fetch_oembed_payload(self, target_url: str) -> Optional[Dict[str, Any]]:
        """
        Queries TikTok's official documented oEmbed API (`https://www.tiktok.com/oembed`)
        for either a profile URL or a specific public creator video URL.
        """
        oembed_endpoint = "https://www.tiktok.com/oembed"
        try:
            with self._build_http_client() as client:
                resp = client.get(oembed_endpoint, params={"url": target_url}, follow_redirects=True)
            if resp.status_code != 200:
                return None
            payload = resp.json()
            if isinstance(payload, dict) and (payload.get("author_name") or payload.get("title")):
                return payload
        except (httpx.HTTPError, ValueError, TypeError):
            return None
        return None

    def _fetch_oembed_profile(self, profile_url: str) -> Optional[Dict[str, Any]]:
        payload = self._fetch_oembed_payload(profile_url)
        if payload and payload.get("author_name"):
            return payload
        return None

    def _fetch_video_oembed_list(
        self, video_urls: List[str]
    ) -> Tuple[List[str], List[str], Optional[str]]:
        """
        Fetches creator video captions and hashtags from official TikTok oEmbed endpoints
        without bypassing any profile-level WAF or anti-bot gate.
        """
        captions: List[str] = []
        author_name: Optional[str] = None
        for video_url in video_urls:
            payload = self._fetch_oembed_payload(video_url)
            if not payload:
                continue
            if author_name is None and payload.get("author_name"):
                author_name = _nfc(str(payload["author_name"]))
            raw_title = _nfc(str(payload.get("title") or ""))
            if raw_title and raw_title not in captions:
                captions.append(raw_title)
        tags = _extract_hashtags(captions)
        return captions, tags, author_name

    def _fetch_via_apify(self, canonical_url: str, handle: str) -> Optional[Dict[str, Any]]:
        """
        Optional licensed social data fallback using Apify's synchronous TikTok scraper API
        when `APIFY_API_TOKEN` is configured in the environment.
        """
        token = os.getenv("APIFY_API_TOKEN", "").strip()
        if not token:
            return None
        actor_id = os.getenv("APIFY_TIKTOK_ACTOR_ID", "clockworks~tiktok-profile-scraper").strip()
        endpoint = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
        try:
            with self._build_http_client(timeout_seconds=max(self.timeout_seconds, 30.0)) as client:
                resp = client.post(
                    endpoint,
                    params={"token": token},
                    json={
                        "profiles": [handle.lstrip("@")],
                        "profileURLs": [canonical_url],
                        "resultsPerPage": 8,
                    },
                )
            if resp.status_code >= 400:
                logger.warning("Apify TikTok extractor returned status %s.", resp.status_code)
                return None
            items = resp.json()
            if not isinstance(items, list) or not items:
                return None
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning("Apify TikTok extractor failed (%s).", type(exc).__name__)
            return None

        author_meta: Dict[str, Any] = {}
        captions: List[str] = []
        raw_tags: List[str] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            if not author_meta and isinstance(item.get("authorMeta"), dict):
                author_meta = item["authorMeta"]
            caption = _nfc(str(item.get("text") or item.get("desc") or ""))
            if caption and caption not in captions:
                captions.append(caption)
            item_tags = item.get("hashtags") or []
            if isinstance(item_tags, list):
                for tag_obj in item_tags:
                    if isinstance(tag_obj, dict) and tag_obj.get("name"):
                        raw_tags.append(f"#{str(tag_obj['name']).lstrip('#')}")
                    elif isinstance(tag_obj, str) and tag_obj.strip():
                        raw_tags.append(f"#{tag_obj.lstrip('#')}")

        bio = _nfc(str(author_meta.get("signature") or ""))
        display_name = _nfc(str(author_meta.get("nickName") or author_meta.get("name") or ""))
        hashtags = _extract_hashtags(captions + raw_tags)
        if not bio and not captions and not hashtags:
            return None

        return {
            "display_name": display_name or handle.lstrip("@"),
            "bio": bio,
            "avatar_url": author_meta.get("avatar") or None,
            "follower_count": author_meta.get("fans"),
            "following_count": author_meta.get("following"),
            "likes_count": author_meta.get("heart"),
            "video_count": author_meta.get("video"),
            "verified": bool(author_meta.get("verified", False)),
            "recent_video_titles": captions[:8],
            "hashtags": hashtags,
            "extraction_source": "apify_api",
        }

    def _fetch_via_tiktok_display_api(self, handle: str) -> Optional[Dict[str, Any]]:
        """
        Optional official TikTok Display API v2 reader when `TIKTOK_ACCESS_TOKEN`
        (authorized creator OAuth token) is configured in the environment.
        """
        token = os.getenv("TIKTOK_ACCESS_TOKEN", "").strip()
        if not token:
            return None
        headers = {"Authorization": f"Bearer {token}"}
        user_payload: Dict[str, Any] = {}
        captions: List[str] = []
        try:
            with self._build_http_client() as client:
                user_resp = client.get(
                    "https://open.tiktokapis.com/v2/user/info/",
                    params={
                        "fields": (
                            "open_id,display_name,bio_description,avatar_url,"
                            "is_verified,follower_count,following_count,likes_count,video_count"
                        )
                    },
                    headers=headers,
                )
                if user_resp.status_code == 200:
                    user_json = user_resp.json()
                    user_payload = (user_json.get("data") or {}).get("user") or {}

                video_resp = client.post(
                    "https://open.tiktokapis.com/v2/video/list/",
                    params={"fields": "id,title,video_description"},
                    json={"max_count": 10},
                    headers=headers,
                )
                if video_resp.status_code == 200:
                    videos = ((video_resp.json().get("data") or {}).get("videos")) or []
                    for vid in videos:
                        if not isinstance(vid, dict):
                            continue
                        cap = _nfc(str(vid.get("title") or vid.get("video_description") or ""))
                        if cap and cap not in captions:
                            captions.append(cap)
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            logger.warning("TikTok Display API fetch failed (%s).", type(exc).__name__)
            return None

        bio = _nfc(str(user_payload.get("bio_description") or ""))
        display_name = _nfc(str(user_payload.get("display_name") or ""))
        if not bio and not captions:
            return None

        return {
            "display_name": display_name or handle.lstrip("@"),
            "bio": bio,
            "avatar_url": user_payload.get("avatar_url") or None,
            "follower_count": user_payload.get("follower_count"),
            "following_count": user_payload.get("following_count"),
            "likes_count": user_payload.get("likes_count"),
            "video_count": user_payload.get("video_count"),
            "verified": bool(user_payload.get("is_verified", False)),
            "recent_video_titles": captions[:8],
            "hashtags": _extract_hashtags([bio] + captions),
            "extraction_source": "tiktok_display_api",
        }
        return None

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
        has_substantive_data = bool(
            (raw_meta.get("bio") or "").strip()
            or raw_meta.get("recent_video_titles")
            or raw_meta.get("hashtags")
            or (manual_notes or "").strip()
        )
        insufficient_msg = (
            f"Verified creator '{raw_meta['display_name']}' ({handle}) via official TikTok oEmbed, "
            "but TikTok SlardarWAF / anti-bot verification blocked automated reading of the channel bio, stats, and video list — "
            "insufficient real data to infer authentic channel context without fabricating content. "
            "Please paste 1-5 video links from this channel or add channel bio/video notes below "
            "(or configure APIFY_API_TOKEN / TIKTOK_ACCESS_TOKEN / GEMINI_API_KEY)."
        )

        if not has_substantive_data and (
            not self.llm_generator.api_key or self.llm_generator.api_key == "your_gemini_api_key_here"
        ):
            raise TikTokProfileBlockedError(insufficient_msg)

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
        need_search_grounding = not has_substantive_data
        if need_search_grounding:
            llm_prompt += (
                "\nCRITICAL ANTI-HALLUCINATION RULE: Bio, Hashtags, and Recent Public Video Captions above are empty. "
                "You MUST ground your answer strictly in verified Google Search evidence for this exact TikTok handle. "
                f"If Google Search yields no verifiable creator bio or video topics for {handle}, set niche_category "
                f"to exact string '{UNVERIFIED_CHANNEL_MARKER}' instead of guessing or inventing generic topics."
            )
        try:
            insight, _ = self.llm_generator._invoke_gemini_structured_json(
                user_input=llm_prompt,
                response_schema_model=TikTokChannelAnalysisInsight,
                model_override=model_override,
                system_instruction=CHANNEL_ANALYST_SYSTEM_INSTRUCTION,
                use_google_search=need_search_grounding,
            )
            if need_search_grounding and (
                UNVERIFIED_CHANNEL_MARKER in (insight.niche_category or "")
                or not insight.content_pillars
            ):
                raise TikTokProfileBlockedError(insufficient_msg)
            return insight
        except TikTokProfileBlockedError:
            raise
        except Exception as exc:
            if not has_substantive_data:
                raise TikTokProfileBlockedError(insufficient_msg) from exc
            logger.warning(
                "Gemini channel insight synthesis failed (%s). Using deterministic profile analysis from extracted channel data.",
                exc,
            )
            return fallback

    def analyze_profile(
        self,
        profile_url: str,
        language: Optional[SupportedLanguage] = None,
        sample_video_urls: Optional[List[str]] = None,
        manual_notes: Optional[str] = None,
        model_override: Optional[str] = None,
    ) -> ChannelContextProfile:
        """
        Fetches public metadata for a TikTok creator profile link and returns rich
        ChannelContextProfile insights ready to condition script generation.
        Never fabricates channel context when TikTok blocks bio/video access and no
        sample video links, user notes, licensed API data, or live search evidence exist.
        """
        handle, canonical_url = normalize_tiktok_profile_url(profile_url)
        cleaned_notes = _nfc(manual_notes) if manual_notes and manual_notes.strip() else None

        normalized_video_urls: List[str] = []
        for raw_vid in (sample_video_urls or []):
            trimmed_vid = (raw_vid or "").strip()
            if not trimmed_vid:
                continue
            canon_vid = normalize_tiktok_video_url(trimmed_vid)
            if canon_vid not in normalized_video_urls:
                normalized_video_urls.append(canon_vid)
        normalized_video_urls = normalized_video_urls[:10]

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
                    "TikTok gated direct HTML scraping behind verification (SlardarWAF / anti-bot check)."
                )
            else:
                parsed = _parse_ssr_and_meta(html_text, handle)
                raw_meta.update(parsed)
        except httpx.HTTPError as exc:
            blocked_by_captcha = True
            fetch_warning = f"Unable to fetch public TikTok HTML directly ({exc})."

        has_html_content = bool(
            raw_meta["bio"] or raw_meta["recent_video_titles"] or raw_meta["hashtags"]
        )

        # Optional licensed providers when SSR HTML is blocked or incomplete
        if not has_html_content:
            apify_meta = self._fetch_via_apify(canonical_url, handle)
            if apify_meta:
                raw_meta.update(apify_meta)
                blocked_by_captcha = False
                fetch_warning = None

        if not (raw_meta["bio"] or raw_meta["recent_video_titles"]):
            display_api_meta = self._fetch_via_tiktok_display_api(handle)
            if display_api_meta:
                raw_meta.update(display_api_meta)
                blocked_by_captcha = False
                fetch_warning = None

        # Official documented TikTok oEmbed API for verified creator name / identity
        if raw_meta["extraction_source"] is None or raw_meta["display_name"] == handle.lstrip("@"):
            oembed_payload = self._fetch_oembed_profile(canonical_url)
            if oembed_payload:
                raw_meta["display_name"] = _nfc(str(oembed_payload["author_name"]))
                if raw_meta["extraction_source"] is None:
                    raw_meta["extraction_source"] = "tiktok_oembed"
                    fetch_warning = (
                        f"Verified creator '{raw_meta['display_name']}' ({handle}) via official TikTok oEmbed."
                    )

        # Official TikTok video oEmbed extraction for user-supplied creator video URLs
        if normalized_video_urls:
            video_captions, video_tags, video_author = self._fetch_video_oembed_list(normalized_video_urls)
            if video_author and raw_meta["display_name"] == handle.lstrip("@"):
                raw_meta["display_name"] = video_author
            if video_captions:
                raw_meta["recent_video_titles"] = list(
                    dict.fromkeys(raw_meta["recent_video_titles"] + video_captions)
                )[:10]
                raw_meta["hashtags"] = _extract_hashtags(
                    raw_meta["recent_video_titles"] + raw_meta["hashtags"] + video_tags
                )
                if raw_meta["extraction_source"] in (None, "tiktok_oembed", "manual_notes"):
                    raw_meta["extraction_source"] = "tiktok_video_oembed"
                fetch_warning = (
                    f"Extracted {len(video_captions)} video caption(s) for {raw_meta['display_name']} ({handle}) "
                    "via official TikTok oEmbed."
                )

        if cleaned_notes and not raw_meta["bio"]:
            raw_meta["bio"] = cleaned_notes[:400]
            raw_meta["hashtags"] = _extract_hashtags([cleaned_notes] + raw_meta["hashtags"])
            if raw_meta["extraction_source"] in (None, "tiktok_oembed"):
                raw_meta["extraction_source"] = "manual_notes"
                if blocked_by_captcha:
                    fetch_warning = (
                        fetch_warning
                        or "TikTok gated direct HTML scraping behind verification (SlardarWAF / anti-bot check)."
                    )
                else:
                    fetch_warning = None

        if raw_meta["extraction_source"] is None:
            msg = (
                fetch_warning
                or "TikTok returned empty public profile metadata (anti-bot protection or private account)."
            )
            raise TikTokProfileBlockedError(
                f"{msg} Please paste 1-5 video links from this channel or add channel bio/video notes below."
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
