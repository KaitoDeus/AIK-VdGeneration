"""
Stock Visual Asset Integration & Background Caching Service (Milestone M2.3).
Fetches high-resolution slide background photography from Unsplash and Pexels APIs
with timeout/retry protection, magic-header image validation, local caching,
and immediate graceful fallback to CSS gradients when APIs are unavailable.
"""

import hashlib
import logging
import os
from pathlib import Path
import time
from typing import Dict, List, Literal, Optional, Tuple

from dotenv import load_dotenv
import httpx

from ..schemas import (
    AssetSearchResponse,
    PresentationScript,
    RemotionCompositionProps,
    StockImageCandidate,
)

load_dotenv()

logger = logging.getLogger(__name__)

MIN_IMAGE_BYTES = 1024
UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"
PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search"


def validate_image_bytes(data: bytes) -> str:
    """
    Verifies downloaded bytes represent a valid JPEG, PNG, or WebP image above minimum size.

    Returns:
        str: Canonical file extension ('.jpg', '.png', or '.webp').
    """
    if not data or len(data) < MIN_IMAGE_BYTES:
        raise ValueError(
            f"Downloaded image payload too small ({len(data) if data else 0} bytes < {MIN_IMAGE_BYTES} bytes)."
        )

    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"

    raise ValueError("Downloaded asset does not match JPEG, PNG, or WebP magic headers.")


def _is_configured_key(value: Optional[str], placeholder_prefix: str) -> bool:
    if not value:
        return False
    cleaned = value.strip()
    if not cleaned or cleaned.startswith(placeholder_prefix):
        return False
    return True


class StockAssetService:
    """Searches, downloads, validates, and caches background stock photography for slides."""

    def __init__(
        self,
        output_base_dir: Optional[Path] = None,
        cache_dir: Optional[Path] = None,
        unsplash_access_key: Optional[str] = None,
        pexels_api_key: Optional[str] = None,
        provider_mode: Optional[str] = None,
        timeout_seconds: int = 10,
        max_retries: int = 2,
    ) -> None:
        gateway_root = Path(__file__).resolve().parent.parent.parent
        self.output_base_dir = output_base_dir or (gateway_root / ".temp" / "jobs")
        self.cache_dir = cache_dir or (gateway_root / ".temp" / "asset_cache")

        self.unsplash_access_key = (
            unsplash_access_key
            if unsplash_access_key is not None
            else os.getenv("UNSPLASH_ACCESS_KEY", "").strip()
        )
        self.pexels_api_key = (
            pexels_api_key
            if pexels_api_key is not None
            else os.getenv("PEXELS_API_KEY", "").strip()
        )
        self.provider_mode = (
            provider_mode or os.getenv("STOCK_IMAGE_PROVIDER", "auto")
        ).strip().lower()
        self.timeout_seconds = timeout_seconds
        self.max_retries = max_retries

    @staticmethod
    def _aspect_to_orientation(aspect_ratio: str) -> Literal["landscape", "portrait"]:
        return "portrait" if aspect_ratio == "9:16" else "landscape"

    def _active_providers(self) -> List[Literal["unsplash", "pexels"]]:
        if self.provider_mode == "disabled":
            return []

        has_unsplash = _is_configured_key(self.unsplash_access_key, "your_unsplash")
        has_pexels = _is_configured_key(self.pexels_api_key, "your_pexels")

        if self.provider_mode == "unsplash":
            return ["unsplash"] if has_unsplash else []
        if self.provider_mode == "pexels":
            return ["pexels"] if has_pexels else []

        providers: List[Literal["unsplash", "pexels"]] = []
        if has_unsplash:
            providers.append("unsplash")
        if has_pexels:
            providers.append("pexels")
        return providers

    def _search_unsplash(
        self,
        query: str,
        orientation: Literal["landscape", "portrait"],
        limit: int,
    ) -> List[StockImageCandidate]:
        headers = {
            "Authorization": f"Client-ID {self.unsplash_access_key}",
            "Accept-Version": "v1",
        }
        params = {
            "query": query,
            "per_page": limit,
            "orientation": orientation,
            "content_filter": "high",
        }
        with httpx.Client(timeout=self.timeout_seconds) as client:
            resp = client.get(UNSPLASH_SEARCH_URL, headers=headers, params=params)
            resp.raise_for_status()
            payload = resp.json()

        candidates: List[StockImageCandidate] = []
        for item in payload.get("results", []):
            urls = item.get("urls") or {}
            full_url = urls.get("regular") or urls.get("full")
            if not full_url:
                continue
            user = item.get("user") or {}
            links = item.get("links") or {}
            candidates.append(
                StockImageCandidate(
                    provider="unsplash",
                    image_id=str(item.get("id", "")),
                    url=full_url,
                    preview_url=urls.get("small") or full_url,
                    width=int(item.get("width") or 1920),
                    height=int(item.get("height") or 1080),
                    photographer=str(user.get("name") or "Unsplash Contributor"),
                    attribution_url=links.get("html"),
                )
            )
        return candidates

    def _search_pexels(
        self,
        query: str,
        orientation: Literal["landscape", "portrait"],
        limit: int,
    ) -> List[StockImageCandidate]:
        headers = {"Authorization": self.pexels_api_key}
        params = {
            "query": query,
            "per_page": limit,
            "orientation": orientation,
        }
        with httpx.Client(timeout=self.timeout_seconds) as client:
            resp = client.get(PEXELS_SEARCH_URL, headers=headers, params=params)
            resp.raise_for_status()
            payload = resp.json()

        candidates: List[StockImageCandidate] = []
        for item in payload.get("photos", []):
            src = item.get("src") or {}
            full_url = src.get("large2x") or src.get("large") or src.get("original")
            if not full_url:
                continue
            candidates.append(
                StockImageCandidate(
                    provider="pexels",
                    image_id=str(item.get("id", "")),
                    url=full_url,
                    preview_url=src.get("medium") or full_url,
                    width=int(item.get("width") or 1920),
                    height=int(item.get("height") or 1080),
                    photographer=str(item.get("photographer") or "Pexels Contributor"),
                    attribution_url=item.get("url"),
                )
            )
        return candidates

    def search_stock_images(
        self,
        query: str,
        aspect_ratio: str = "16:9",
        limit: int = 4,
    ) -> AssetSearchResponse:
        """
        Queries active stock photography providers with retries & fallback.
        Never raises on upstream network/key errors; returns `fallback_to_gradient=True`.
        """
        clean_query = query.strip()
        orientation = self._aspect_to_orientation(aspect_ratio)
        providers = self._active_providers()

        if not providers or not clean_query:
            return AssetSearchResponse(
                query=clean_query,
                provider_used=None,
                fallback_to_gradient=True,
                results=[],
            )

        for provider in providers:
            for attempt in range(1, self.max_retries + 1):
                try:
                    if provider == "unsplash":
                        results = self._search_unsplash(clean_query, orientation, limit)
                    else:
                        results = self._search_pexels(clean_query, orientation, limit)

                    if results:
                        return AssetSearchResponse(
                            query=clean_query,
                            provider_used=provider,
                            fallback_to_gradient=False,
                            results=results,
                        )
                    break
                except Exception as exc:
                    logger.warning(
                        "Stock image search failed on '%s' (attempt %d/%d) for query '%s': %s",
                        provider,
                        attempt,
                        self.max_retries,
                        clean_query,
                        exc,
                    )
                    if attempt < self.max_retries:
                        time.sleep(0.5)

        return AssetSearchResponse(
            query=clean_query,
            provider_used=None,
            fallback_to_gradient=True,
            results=[],
        )

    def _download_and_cache(self, image_url: str) -> Tuple[bytes, str]:
        """Downloads an image URL (with local disk cache) and validates its magic headers."""
        url_hash = hashlib.sha256(image_url.encode("utf-8")).hexdigest()[:16]
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        for ext in (".jpg", ".png", ".webp"):
            cached = self.cache_dir / f"{url_hash}{ext}"
            if cached.exists() and cached.stat().st_size >= MIN_IMAGE_BYTES:
                return cached.read_bytes(), ext

        last_err: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                with httpx.Client(timeout=self.timeout_seconds, follow_redirects=True) as client:
                    resp = client.get(image_url)
                    resp.raise_for_status()
                    ext = validate_image_bytes(resp.content)
                    cached_file = self.cache_dir / f"{url_hash}{ext}"
                    cached_file.write_bytes(resp.content)
                    return resp.content, ext
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "Image download failed (attempt %d/%d) for '%s': %s",
                    attempt,
                    self.max_retries,
                    image_url,
                    exc,
                )
                if attempt < self.max_retries:
                    time.sleep(0.5)

        raise RuntimeError(f"Unable to download valid image from '{image_url}': {last_err}")

    def resolve_slide_asset(
        self,
        slide_index: int,
        visual_keywords: str,
        job_id: str,
        aspect_ratio: str = "16:9",
        explicit_image_url: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Resolves and persists a slide background image asset locally for Remotion.
        Falls back gracefully to `(None, None, None)` if fetching or validation fails.

        Returns:
            Tuple[Optional[str], Optional[str], Optional[str]]:
                (relative_url, absolute_local_path, provider_used)
        """
        target_url: Optional[str] = explicit_image_url
        provider_used: Optional[str] = "custom-url" if explicit_image_url else None

        if not target_url:
            search_res = self.search_stock_images(
                query=visual_keywords,
                aspect_ratio=aspect_ratio,
                limit=3,
            )
            if search_res.fallback_to_gradient or not search_res.results:
                return None, None, None
            # Rotate index across multiple returned candidates so slides don't repeat identical photos
            candidate = search_res.results[(slide_index - 1) % len(search_res.results)]
            target_url = candidate.url
            provider_used = candidate.provider

        try:
            image_bytes, ext = self._download_and_cache(target_url)
            digest = hashlib.sha256(target_url.encode("utf-8")).hexdigest()[:8]
            filename = f"slide_{slide_index}_{digest}{ext}"
            assets_dir = self.output_base_dir / job_id / "assets"
            assets_dir.mkdir(parents=True, exist_ok=True)
            local_file = assets_dir / filename
            local_file.write_bytes(image_bytes)

            relative_url = f"/assets/{job_id}/{filename}"
            return relative_url, str(local_file.resolve()), provider_used
        except Exception as exc:
            logger.warning(
                "Falling back to CSS gradient for slide %d ('%s'): %s",
                slide_index,
                visual_keywords,
                exc,
            )
            return None, None, None

    def enrich_remotion_props(
        self,
        props: RemotionCompositionProps,
        script: PresentationScript,
        job_id: str,
        aspect_ratio: str = "16:9",
        slide_backgrounds: Optional[Dict[int, str]] = None,
    ) -> RemotionCompositionProps:
        """
        Populates `background_image_url`, `background_image_path`, and `background_asset_provider`
        for every slide in a compiled RemotionCompositionProps object.
        """
        keywords_by_index = {s.slide_index: s.visual_keywords for s in script.slides}
        overrides = slide_backgrounds or {}

        updated_slides = []
        for slide in props.slides:
            keywords = keywords_by_index.get(slide.slide_index, slide.heading)
            explicit_url = overrides.get(slide.slide_index)
            rel_url, local_path, provider = self.resolve_slide_asset(
                slide_index=slide.slide_index,
                visual_keywords=keywords,
                job_id=job_id,
                aspect_ratio=aspect_ratio,
                explicit_image_url=explicit_url,
            )
            updated_slides.append(
                slide.model_copy(
                    update={
                        "background_image_url": rel_url,
                        "background_image_path": local_path,
                        "background_asset_provider": provider,
                    }
                )
            )

        return props.model_copy(update={"slides": updated_slides})
