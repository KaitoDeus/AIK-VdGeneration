"""
Asynchronous Job Queue & Realtime Progress Pub/Sub Backend (Milestone M2.1).
Supports Redis-backed distributed queues (with automatic retry & dead-letter queue)
and an automatic in-memory fallback for zero-dependency local development & testing.
"""

from abc import ABC, abstractmethod
import asyncio
from collections import defaultdict, deque
from datetime import datetime, timezone
import json
import logging
import os
import threading
from typing import Any, AsyncIterator, Deque, Dict, List, Optional, Sequence

import redis

from ..schemas import (
    JobStatusResponse,
    QueueStatsResponse,
    QueueTaskPayload,
    WebSocketProgressEvent,
    WorkerStage,
)

logger = logging.getLogger(__name__)

STAGES_ORDER: tuple[WorkerStage, ...] = ("llm", "tts", "render")


def utc_timestamp() -> str:
    """Returns current UTC timestamp formatted as ISO-8601 string with 'Z' suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_job_terminal(job: JobStatusResponse) -> bool:
    """Returns True when no further pipeline stages are expected for this job."""
    if job.status in ("completed", "failed"):
        return True
    if job.status == "audio_ready" and not job.render_requested:
        return True
    return False


class BaseQueueBackend(ABC):
    """Abstract interface for job state storage, stage queues, DLQ, and progress streaming."""

    backend_name: str = "base"

    @abstractmethod
    def save_job(self, job: JobStatusResponse) -> None:
        """Persists or updates a job's status record."""

    @abstractmethod
    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        """Retrieves a job status record by ID, or None if missing."""

    @abstractmethod
    def delete_job(self, job_id: str) -> None:
        """Deletes a job record and associated progress state."""

    @abstractmethod
    def list_jobs(self, limit: int = 50) -> List[JobStatusResponse]:
        """Lists most recent jobs up to `limit`."""

    @abstractmethod
    def enqueue_task(self, task: QueueTaskPayload) -> None:
        """Pushes a stage task onto its designated stage FIFO queue."""

    @abstractmethod
    def dequeue_task(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        timeout_seconds: int = 1,
    ) -> Optional[QueueTaskPayload]:
        """Pops the next available task from the given stage queues."""

    @abstractmethod
    def push_dead_letter(self, task: QueueTaskPayload, error: str) -> None:
        """Moves an exhausted failed task to the Dead-Letter Queue (DLQ)."""

    @abstractmethod
    def publish_progress(self, event: WebSocketProgressEvent) -> None:
        """Appends progress event to job history and broadcasts to WebSocket subscribers."""

    @abstractmethod
    def get_stats(self) -> QueueStatsResponse:
        """Returns operational telemetry across queues and jobs."""

    @abstractmethod
    async def stream_progress(
        self,
        job_id: str,
        poll_interval: float = 0.05,
        idle_timeout_seconds: float = 300.0,
    ) -> AsyncIterator[WebSocketProgressEvent]:
        """Async generator yielding historical + live WebSocketProgressEvent items."""

    def emit_progress(
        self,
        job_id: str,
        step: str,
        progress_percentage: int,
        message: str,
    ) -> WebSocketProgressEvent:
        """Convenience helper to create and broadcast a timestamped progress event."""
        event = WebSocketProgressEvent(
            job_id=job_id,
            step=step,
            progress_percentage=max(0, min(100, progress_percentage)),
            message=message,
            timestamp=utc_timestamp(),
        )
        self.publish_progress(event)
        return event


class LocalMemoryQueueBackend(BaseQueueBackend):
    """
    Thread-safe in-memory queue & WebSocket broadcaster.
    Used automatically when Redis is unavailable or QUEUE_MODE=memory.
    """

    backend_name = "memory"

    def __init__(self, shared_jobs_store: Optional[Dict[str, JobStatusResponse]] = None) -> None:
        self.jobs_store: Dict[str, JobStatusResponse] = (
            shared_jobs_store if shared_jobs_store is not None else {}
        )
        self._job_order: Deque[str] = deque(maxlen=500)
        self._queues: Dict[WorkerStage, Deque[QueueTaskPayload]] = {
            stage: deque() for stage in STAGES_ORDER
        }
        self._progress_history: Dict[str, List[WebSocketProgressEvent]] = defaultdict(list)
        self._dlq: List[Dict[str, Any]] = []
        self._subscribers: Dict[
            str, List[tuple[asyncio.AbstractEventLoop, asyncio.Queue[WebSocketProgressEvent]]]
        ] = defaultdict(list)
        self._lock = threading.RLock()

    def save_job(self, job: JobStatusResponse) -> None:
        with self._lock:
            history = self._progress_history.get(job.job_id, [])
            if history and len(job.progress_events) < len(history):
                job.progress_events = list(history)
            self.jobs_store[job.job_id] = job
            if job.job_id not in self._job_order:
                self._job_order.appendleft(job.job_id)

    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        with self._lock:
            job = self.jobs_store.get(job_id)
            if job is not None:
                job.progress_events = list(self._progress_history.get(job_id, []))
            return job

    def delete_job(self, job_id: str) -> None:
        with self._lock:
            self.jobs_store.pop(job_id, None)
            self._progress_history.pop(job_id, None)

    def list_jobs(self, limit: int = 50) -> List[JobStatusResponse]:
        with self._lock:
            results: List[JobStatusResponse] = []
            for job_id in list(self._job_order):
                job = self.jobs_store.get(job_id)
                if job is not None:
                    results.append(job)
                if len(results) >= limit:
                    break
            return results

    def enqueue_task(self, task: QueueTaskPayload) -> None:
        with self._lock:
            self._queues[task.stage].append(task)

    def dequeue_task(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        timeout_seconds: int = 1,
    ) -> Optional[QueueTaskPayload]:
        deadline = datetime.now(timezone.utc).timestamp() + max(0, timeout_seconds)
        while True:
            with self._lock:
                for stage in stages:
                    queue = self._queues.get(stage)
                    if queue:
                        return queue.popleft()
            if timeout_seconds <= 0 or datetime.now(timezone.utc).timestamp() >= deadline:
                return None
            threading.Event().wait(0.05)

    def push_dead_letter(self, task: QueueTaskPayload, error: str) -> None:
        with self._lock:
            self._dlq.append(
                {
                    "task": task.model_dump(),
                    "error": error,
                    "failed_at": utc_timestamp(),
                }
            )

    def publish_progress(self, event: WebSocketProgressEvent) -> None:
        with self._lock:
            self._progress_history[event.job_id].append(event)
            job = self.jobs_store.get(event.job_id)
            if job is not None:
                job.progress_events = list(self._progress_history[event.job_id])
            subscribers = list(self._subscribers.get(event.job_id, []))

        for loop, async_q in subscribers:
            try:
                if not loop.is_closed():
                    loop.call_soon_threadsafe(async_q.put_nowait, event)
            except Exception:
                logger.debug("Failed to notify subscriber queue for job %s", event.job_id)

    def get_stats(self) -> QueueStatsResponse:
        with self._lock:
            return QueueStatsResponse(
                backend="memory",
                redis_connected=False,
                queues={stage: len(self._queues[stage]) for stage in STAGES_ORDER},
                dead_letter_count=len(self._dlq),
                total_jobs=len(self.jobs_store),
            )

    async def stream_progress(
        self,
        job_id: str,
        poll_interval: float = 0.05,
        idle_timeout_seconds: float = 300.0,
    ) -> AsyncIterator[WebSocketProgressEvent]:
        loop = asyncio.get_running_loop()
        subscriber_q: asyncio.Queue[WebSocketProgressEvent] = asyncio.Queue()
        entry = (loop, subscriber_q)

        with self._lock:
            self._subscribers[job_id].append(entry)
            job = self.jobs_store.get(job_id)
            history = list(job.progress_events) if job else []

        try:
            for event in history:
                yield event

            current_job = self.get_job(job_id)
            if current_job and is_job_terminal(current_job):
                return

            while True:
                try:
                    event = await asyncio.wait_for(
                        subscriber_q.get(),
                        timeout=idle_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    break

                yield event
                current_job = self.get_job(job_id)
                if current_job and is_job_terminal(current_job):
                    break
        finally:
            with self._lock:
                subs = self._subscribers.get(job_id, [])
                if entry in subs:
                    subs.remove(entry)


class RedisQueueBackend(BaseQueueBackend):
    """
    Distributed Redis-backed queue, state store, DLQ, and Pub/Sub progress broadcaster.
    Compatible with real Redis servers and `fakeredis.FakeRedis` for isolated testing.
    """

    backend_name = "redis"

    def __init__(
        self,
        redis_client: Optional[redis.Redis] = None,
        redis_url: Optional[str] = None,
        key_prefix: str = "aik",
        job_ttl_seconds: int = 86400,
    ) -> None:
        if redis_client is not None:
            self.client = redis_client
        else:
            url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self.client = redis.Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=5,
            )
        self.key_prefix = key_prefix
        self.job_ttl_seconds = job_ttl_seconds

    def _job_key(self, job_id: str) -> str:
        return f"{self.key_prefix}:job:{job_id}"

    def _index_key(self) -> str:
        return f"{self.key_prefix}:jobs:index"

    def _queue_key(self, stage: WorkerStage) -> str:
        return f"{self.key_prefix}:queue:{stage}"

    def _dlq_key(self) -> str:
        return f"{self.key_prefix}:queue:dlq"

    def _progress_channel(self, job_id: str) -> str:
        return f"{self.key_prefix}:progress:{job_id}"

    def _progress_history_key(self, job_id: str) -> str:
        return f"{self.key_prefix}:progress_history:{job_id}"

    def _load_progress_history(self, job_id: str) -> List[WebSocketProgressEvent]:
        raw_events = self.client.lrange(self._progress_history_key(job_id), 0, -1)
        return [WebSocketProgressEvent.model_validate_json(raw) for raw in raw_events]

    def save_job(self, job: JobStatusResponse) -> None:
        # Store job state independently of the atomic progress_history list
        job_copy = job.model_copy(update={"progress_events": []})
        payload = json.dumps(job_copy.model_dump(), ensure_ascii=False)
        pipe = self.client.pipeline()
        pipe.set(self._job_key(job.job_id), payload, ex=self.job_ttl_seconds)
        pipe.lrem(self._index_key(), 0, job.job_id)
        pipe.lpush(self._index_key(), job.job_id)
        pipe.ltrim(self._index_key(), 0, 499)
        pipe.execute()

    def get_job(self, job_id: str) -> Optional[JobStatusResponse]:
        raw = self.client.get(self._job_key(job_id))
        if not raw:
            return None
        job = JobStatusResponse.model_validate_json(raw)
        job.progress_events = self._load_progress_history(job_id)
        return job

    def delete_job(self, job_id: str) -> None:
        pipe = self.client.pipeline()
        pipe.delete(self._job_key(job_id))
        pipe.delete(self._progress_history_key(job_id))
        pipe.lrem(self._index_key(), 0, job_id)
        pipe.execute()

    def list_jobs(self, limit: int = 50) -> List[JobStatusResponse]:
        job_ids = self.client.lrange(self._index_key(), 0, max(0, limit - 1))
        if not job_ids:
            return []
        raw_items = self.client.mget([self._job_key(jid) for jid in job_ids])
        jobs: List[JobStatusResponse] = []
        for raw in raw_items:
            if raw:
                job = JobStatusResponse.model_validate_json(raw)
                job.progress_events = self._load_progress_history(job.job_id)
                jobs.append(job)
        return jobs

    def enqueue_task(self, task: QueueTaskPayload) -> None:
        self.client.rpush(self._queue_key(task.stage), task.model_dump_json())

    def dequeue_task(
        self,
        stages: Sequence[WorkerStage] = STAGES_ORDER,
        timeout_seconds: int = 1,
    ) -> Optional[QueueTaskPayload]:
        keys = [self._queue_key(stage) for stage in stages]
        if not keys:
            return None

        if timeout_seconds > 0:
            item = self.client.blpop(keys, timeout=timeout_seconds)
            if not item:
                return None
            _, raw_payload = item
            return QueueTaskPayload.model_validate_json(raw_payload)

        for key in keys:
            raw_payload = self.client.lpop(key)
            if raw_payload:
                return QueueTaskPayload.model_validate_json(raw_payload)
        return None

    def push_dead_letter(self, task: QueueTaskPayload, error: str) -> None:
        envelope = {
            "task": task.model_dump(),
            "error": error,
            "failed_at": utc_timestamp(),
        }
        self.client.rpush(self._dlq_key(), json.dumps(envelope, ensure_ascii=False))

    def publish_progress(self, event: WebSocketProgressEvent) -> None:
        event_json = event.model_dump_json()
        history_key = self._progress_history_key(event.job_id)
        pipe = self.client.pipeline()
        pipe.rpush(history_key, event_json)
        pipe.expire(history_key, self.job_ttl_seconds)
        pipe.publish(self._progress_channel(event.job_id), event_json)
        pipe.execute()

    def get_stats(self) -> QueueStatsResponse:
        connected = False
        try:
            connected = bool(self.client.ping())
        except Exception:
            connected = False

        queues = {
            stage: int(self.client.llen(self._queue_key(stage)))
            for stage in STAGES_ORDER
        }
        dlq_len = int(self.client.llen(self._dlq_key()))
        total_jobs = int(self.client.llen(self._index_key()))
        return QueueStatsResponse(
            backend="redis",
            redis_connected=connected,
            queues=queues,
            dead_letter_count=dlq_len,
            total_jobs=total_jobs,
        )

    async def stream_progress(
        self,
        job_id: str,
        poll_interval: float = 0.05,
        idle_timeout_seconds: float = 300.0,
    ) -> AsyncIterator[WebSocketProgressEvent]:
        pubsub = self.client.pubsub()
        channel = self._progress_channel(job_id)
        pubsub.subscribe(channel)

        seen_keys: set[tuple[str, int, str]] = set()
        try:
            job = self.get_job(job_id)
            if job:
                for event in job.progress_events:
                    sig = (event.step, event.progress_percentage, event.message)
                    seen_keys.add(sig)
                    yield event
                if is_job_terminal(job):
                    return

            elapsed = 0.0
            while elapsed < idle_timeout_seconds:
                message = await asyncio.to_thread(
                    lambda: pubsub.get_message(
                        ignore_subscribe_messages=True,
                        timeout=poll_interval,
                    )
                )
                if message and message.get("type") == "message":
                    raw_data = message.get("data")
                    if raw_data:
                        event = WebSocketProgressEvent.model_validate_json(raw_data)
                        sig = (event.step, event.progress_percentage, event.message)
                        if sig not in seen_keys:
                            seen_keys.add(sig)
                            yield event
                        elapsed = 0.0
                        latest_job = self.get_job(job_id)
                        if latest_job and is_job_terminal(latest_job):
                            break
                else:
                    await asyncio.sleep(poll_interval)
                    elapsed += poll_interval
                    # Check periodically in case terminal status was persisted without pubsub delivery
                    latest_job = self.get_job(job_id)
                    if latest_job and is_job_terminal(latest_job):
                        for event in latest_job.progress_events:
                            sig = (event.step, event.progress_percentage, event.message)
                            if sig not in seen_keys:
                                seen_keys.add(sig)
                                yield event
                        break
        finally:
            try:
                pubsub.unsubscribe(channel)
                pubsub.close()
            except Exception:
                pass


def create_queue_backend(
    mode: Optional[str] = None,
    redis_url: Optional[str] = None,
    shared_jobs_store: Optional[Dict[str, JobStatusResponse]] = None,
) -> BaseQueueBackend:
    """
    Instantiates either RedisQueueBackend or LocalMemoryQueueBackend based on QUEUE_MODE.
    In `auto` mode, probes REDIS_URL with a short 0.5s ping and gracefully falls back
    to LocalMemoryQueueBackend when no local Redis server is running.
    """
    resolved_mode = (mode or os.getenv("QUEUE_MODE", "auto")).strip().lower()
    resolved_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379/0")

    if resolved_mode == "memory":
        logger.info("Initialized LocalMemoryQueueBackend (QUEUE_MODE=memory).")
        return LocalMemoryQueueBackend(shared_jobs_store=shared_jobs_store)

    if resolved_mode == "redis":
        client = redis.Redis.from_url(
            resolved_url,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=5,
        )
        logger.info("Initialized RedisQueueBackend at %s (QUEUE_MODE=redis).", resolved_url)
        return RedisQueueBackend(redis_client=client)

    # Auto-detect Redis availability
    try:
        probe_client = redis.Redis.from_url(
            resolved_url,
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=1.0,
        )
        if probe_client.ping():
            logger.info("Redis detected at %s; using RedisQueueBackend.", resolved_url)
            return RedisQueueBackend(redis_client=probe_client)
    except Exception as exc:
        logger.info(
            "Redis not reachable at %s (%s); using LocalMemoryQueueBackend fallback.",
            resolved_url,
            exc,
        )

    return LocalMemoryQueueBackend(shared_jobs_store=shared_jobs_store)
