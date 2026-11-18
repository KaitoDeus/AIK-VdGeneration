"""
Cloud Object Storage & Signed CDN Delivery Service (Milestone M2.4).
Supports uploading rendered `.mp4` videos to AWS S3 or S3-compatible Cloudflare R2,
generating SigV4 presigned download URLs with optional CDN base URLs,
and gracefully degrading to local FastAPI media streaming when offline/unconfigured.
"""

import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, Optional

from dotenv import load_dotenv

from ..schemas import StorageProviderType, VideoDeliveryResponse

load_dotenv()

logger = logging.getLogger(__name__)

MIN_SIGNED_TTL_SECONDS = 60
MAX_SIGNED_TTL_SECONDS = 7 * 24 * 3600  # 604800s (AWS SigV4 7-day maximum)


def _clean_setting(value: Optional[str]) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if cleaned.lower().startswith("your_"):
        return ""
    return cleaned


def _clamp_ttl(ttl_seconds: Optional[int], default_ttl: int = 3600) -> int:
    raw = default_ttl if ttl_seconds is None else int(ttl_seconds)
    return max(MIN_SIGNED_TTL_SECONDS, min(MAX_SIGNED_TTL_SECONDS, raw))


class CloudStorageService:
    """Handles `.mp4` cloud persistence (AWS S3 / Cloudflare R2) and signed download URL delivery."""

    def __init__(
        self,
        provider_mode: Optional[str] = None,
        bucket_name: Optional[str] = None,
        region_name: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        r2_account_id: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        cdn_public_base_url: Optional[str] = None,
        key_prefix: Optional[str] = None,
        default_expiry_seconds: Optional[int] = None,
        max_retries: int = 2,
        timeout_seconds: int = 30,
        s3_client: Optional[Any] = None,
    ) -> None:
        self.provider_mode = (
            provider_mode if provider_mode is not None else os.getenv("STORAGE_PROVIDER", "auto")
        ).strip().lower()

        self.bucket_name = _clean_setting(
            bucket_name
            if bucket_name is not None
            else (os.getenv("AWS_S3_BUCKET") or os.getenv("R2_BUCKET"))
        )
        self.r2_account_id = _clean_setting(
            r2_account_id if r2_account_id is not None else os.getenv("R2_ACCOUNT_ID")
        )
        self.endpoint_url = _clean_setting(
            endpoint_url
            if endpoint_url is not None
            else (os.getenv("S3_ENDPOINT_URL") or os.getenv("R2_ENDPOINT_URL"))
        )
        if not self.endpoint_url and self.r2_account_id:
            self.endpoint_url = f"https://{self.r2_account_id}.r2.cloudflarestorage.com"

        self.access_key_id = _clean_setting(
            access_key_id
            if access_key_id is not None
            else (os.getenv("AWS_ACCESS_KEY_ID") or os.getenv("R2_ACCESS_KEY_ID"))
        )
        self.secret_access_key = _clean_setting(
            secret_access_key
            if secret_access_key is not None
            else (os.getenv("AWS_SECRET_ACCESS_KEY") or os.getenv("R2_SECRET_ACCESS_KEY"))
        )

        default_region = "auto" if (self.r2_account_id or self.provider_mode == "r2") else "us-east-1"
        self.region_name = _clean_setting(
            region_name if region_name is not None else os.getenv("AWS_REGION")
        ) or default_region

        self.cdn_public_base_url = _clean_setting(
            cdn_public_base_url
            if cdn_public_base_url is not None
            else os.getenv("CDN_PUBLIC_BASE_URL")
        ).rstrip("/")

        raw_prefix = (
            key_prefix if key_prefix is not None else os.getenv("STORAGE_KEY_PREFIX", "videos")
        )
        self.key_prefix = raw_prefix.strip().strip("/")

        env_expiry = int(os.getenv("SIGNED_URL_EXPIRY_SECONDS", "3600") or "3600")
        self.default_expiry_seconds = _clamp_ttl(
            default_expiry_seconds if default_expiry_seconds is not None else env_expiry
        )
        self.max_retries = max(1, max_retries)
        self.timeout_seconds = max(5, timeout_seconds)
        self._injected_client = s3_client

    def _has_cloud_credentials(self) -> bool:
        if not self.bucket_name:
            return False
        return bool((self.access_key_id and self.secret_access_key) or self._injected_client is not None)

    def resolve_provider(self) -> StorageProviderType:
        """Determines active storage backend: 'local', 's3', or 'r2' with safe fallback to 'local'."""
        if self.provider_mode == "local":
            return "local"

        if not self._has_cloud_credentials():
            return "local"

        if self.provider_mode == "r2":
            return "r2" if self.endpoint_url else "local"
        if self.provider_mode == "s3":
            return "s3"

        # 'auto' mode detects Cloudflare R2 endpoint vs native AWS S3
        if self.r2_account_id or (self.endpoint_url and "r2.cloudflarestorage.com" in self.endpoint_url):
            return "r2"
        return "s3"

    def _get_client(self) -> Any:
        if self._injected_client is not None:
            return self._injected_client

        try:
            import boto3
            from botocore.config import Config
        except ImportError as exc:
            raise RuntimeError(
                "boto3 package is required for S3/R2 storage integration. Run `pip install boto3`."
            ) from exc

        boto_config = Config(
            signature_version="s3v4",
            connect_timeout=self.timeout_seconds,
            read_timeout=self.timeout_seconds,
            retries={"max_attempts": self.max_retries, "mode": "standard"},
        )
        client_kwargs: Dict[str, Any] = {
            "service_name": "s3",
            "region_name": self.region_name,
            "aws_access_key_id": self.access_key_id,
            "aws_secret_access_key": self.secret_access_key,
            "config": boto_config,
        }
        if self.endpoint_url:
            client_kwargs["endpoint_url"] = self.endpoint_url

        return boto3.client(**client_kwargs)

    def build_object_key(self, job_id: str, filename: Optional[str] = None) -> str:
        """Builds a clean S3/R2 object key such as `videos/{job_id}/{job_id}.mp4`."""
        safe_job = Path(job_id).name
        safe_name = Path(filename or f"{safe_job}.mp4").name
        if self.key_prefix:
            return f"{self.key_prefix}/{safe_job}/{safe_name}"
        return f"{safe_job}/{safe_name}"

    def build_cdn_url(self, object_key: str) -> Optional[str]:
        """Formats public CDN URL when `CDN_PUBLIC_BASE_URL` is configured."""
        if not self.cdn_public_base_url:
            return None
        clean_key = object_key.lstrip("/")
        return f"{self.cdn_public_base_url}/{clean_key}"

    @staticmethod
    def _local_delivery(job_id: str, file_size_bytes: Optional[int] = None) -> VideoDeliveryResponse:
        return VideoDeliveryResponse(
            job_id=job_id,
            storage_provider="local",
            download_url=f"/api/v1/jobs/{job_id}/video",
            object_key=None,
            cdn_url=None,
            expires_in_seconds=None,
            file_size_bytes=file_size_bytes,
        )

    def create_presigned_download_url(
        self,
        job_id: str,
        object_key: Optional[str] = None,
        expires_in_seconds: Optional[int] = None,
        filename: Optional[str] = None,
        file_size_bytes: Optional[int] = None,
    ) -> VideoDeliveryResponse:
        """Mints a fresh time-limited S3/R2 presigned GET URL or falls back to local streaming path."""
        provider = self.resolve_provider()
        if provider == "local":
            return self._local_delivery(job_id, file_size_bytes=file_size_bytes)

        ttl = _clamp_ttl(expires_in_seconds, default_ttl=self.default_expiry_seconds)
        key = object_key or self.build_object_key(job_id, filename=filename)
        safe_filename = Path(filename or f"{job_id}.mp4").name

        client = self._get_client()
        presigned_url = client.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": self.bucket_name,
                "Key": key,
                "ResponseContentType": "video/mp4",
                "ResponseContentDisposition": f'attachment; filename="{safe_filename}"',
            },
            ExpiresIn=ttl,
        )
        return VideoDeliveryResponse(
            job_id=job_id,
            storage_provider=provider,
            download_url=presigned_url,
            object_key=key,
            cdn_url=self.build_cdn_url(key),
            expires_in_seconds=ttl,
            file_size_bytes=file_size_bytes,
        )

    def upload_video(
        self,
        local_mp4_path: Path,
        job_id: str,
        expires_in_seconds: Optional[int] = None,
        strict_cloud: bool = False,
        delete_local_after_upload: Optional[bool] = None,
    ) -> VideoDeliveryResponse:
        """
        Uploads a verified MP4 artifact to AWS S3 / Cloudflare R2 with retry protection
        and returns a signed download URL. Falls back to local serving on cloud failure
        unless `strict_cloud=True`.
        """
        mp4_path = Path(local_mp4_path)
        if not mp4_path.exists():
            raise FileNotFoundError(f"Rendered MP4 file does not exist for upload: {mp4_path}")

        file_size = mp4_path.stat().st_size
        if file_size <= 0:
            raise ValueError(f"Rendered MP4 file is empty: {mp4_path}")

        provider = self.resolve_provider()
        if provider == "local":
            logger.info("Job %s [Storage] Using local delivery (%d bytes).", job_id, file_size)
            return self._local_delivery(job_id, file_size_bytes=file_size)

        object_key = self.build_object_key(job_id, filename=f"{job_id}.mp4")
        extra_args = {
            "ContentType": "video/mp4",
            "ContentDisposition": f'attachment; filename="{job_id}.mp4"',
            "CacheControl": "public, max-age=31536000",
        }

        last_err: Optional[Exception] = None
        for attempt in range(1, self.max_retries + 1):
            try:
                client = self._get_client()
                client.upload_file(
                    str(mp4_path),
                    self.bucket_name,
                    object_key,
                    ExtraArgs=extra_args,
                )
                delivery = self.create_presigned_download_url(
                    job_id=job_id,
                    object_key=object_key,
                    expires_in_seconds=expires_in_seconds,
                    filename=f"{job_id}.mp4",
                    file_size_bytes=file_size,
                )
                logger.info(
                    "Job %s [Storage:%s] Uploaded %d bytes -> s3://%s/%s",
                    job_id,
                    provider,
                    file_size,
                    self.bucket_name,
                    object_key,
                )

                should_delete = (
                    delete_local_after_upload
                    if delete_local_after_upload is not None
                    else os.getenv("STORAGE_DELETE_LOCAL_AFTER_UPLOAD", "false").strip().lower() == "true"
                )
                if should_delete:
                    mp4_path.unlink(missing_ok=True)
                    logger.info("Job %s [Storage] Removed local temp MP4 after cloud upload.", job_id)

                return delivery
            except Exception as exc:
                last_err = exc
                logger.warning(
                    "Cloud upload attempt %d/%d failed for job '%s' (%s): %s",
                    attempt,
                    self.max_retries,
                    job_id,
                    provider,
                    exc,
                )
                if attempt < self.max_retries:
                    time.sleep(0.5)

        if strict_cloud:
            raise RuntimeError(
                f"Failed to upload MP4 for job '{job_id}' to '{provider}' after {self.max_retries} attempts: {last_err}"
            )

        logger.warning(
            "Job %s [Storage] Falling back gracefully to local MP4 serving after cloud upload error: %s",
            job_id,
            last_err,
        )
        return self._local_delivery(job_id, file_size_bytes=file_size)
