"""
Automated Verification & Test Suite for Milestone M2.1:
Asynchronous Queue Worker (Redis + In-Memory Fallback), Dedicated Stage Workers
(LLMWorker, TTSWorker, RenderWorker), 3-Attempt Retry & DLQ Fault Tolerance,
and Realtime WebSocket Progress Streaming.
"""

from pathlib import Path
import shutil
import threading
import time
from unittest.mock import MagicMock

import fakeredis
from fastapi.testclient import TestClient
import pytest

import src.main as main_module
from src.main import TEMP_JOBS_DIR, app, configure_queue_backend
from src.schemas import (
    JobStatusResponse,
    QueueTaskPayload,
    VideoGenerateRequest,
)
from src.services.llm_service import LLMScriptGenerator
from src.services.queue_service import (
    LocalMemoryQueueBackend,
    RedisQueueBackend,
    create_queue_backend,
    utc_timestamp,
)
from src.services.render_service import RemotionRenderService
from src.services.tts_service import TTSAudioPipeline
from src.services.worker_service import PipelineWorkerCoordinator
from src.worker import parse_worker_args


def _make_video_request(render_video: bool = False, language: str = "en") -> VideoGenerateRequest:
    return VideoGenerateRequest(
        prompt="Distributed Asynchronous Video Queue Architecture",
        language=language,  # type: ignore
        aspect_ratio="16:9",
        target_duration_seconds=36,
        render_video=render_video,
    )


def _create_dummy_mp4_file(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    header = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + (b"\x00" * 2048)
    path.write_bytes(header)
    return path


class TestQueueBackends:
    """Verifies RedisQueueBackend (via fakeredis), LocalMemoryQueueBackend, and auto fallback."""

    @pytest.mark.parametrize("backend_type", ["memory", "redis"])
    def test_job_persistence_and_fifo_stage_queues(self, backend_type: str):
        if backend_type == "redis":
            fake_redis = fakeredis.FakeRedis(decode_responses=True)
            backend = RedisQueueBackend(redis_client=fake_redis)
        else:
            backend = LocalMemoryQueueBackend()

        job = JobStatusResponse(
            job_id="job_queue_001",
            status="queued",
            progress_percentage=0,
            current_stage="llm",
        )
        backend.save_job(job)
        fetched = backend.get_job("job_queue_001")
        assert fetched is not None
        assert fetched.job_id == "job_queue_001"
        assert fetched.status == "queued"

        req = _make_video_request()
        t1 = QueueTaskPayload(
            job_id="job_queue_001",
            stage="llm",
            request=req,
            created_at=utc_timestamp(),
        )
        t2 = QueueTaskPayload(
            job_id="job_queue_002",
            stage="tts",
            request=req,
            created_at=utc_timestamp(),
        )
        backend.enqueue_task(t1)
        backend.enqueue_task(t2)

        stats = backend.get_stats()
        assert stats.backend == backend_type
        assert stats.queues["llm"] == 1
        assert stats.queues["tts"] == 1
        assert stats.total_jobs == 1

        # Stage-filtered dequeue only pulls matching stage
        popped_tts = backend.dequeue_task(stages=("tts",), timeout_seconds=0)
        assert popped_tts is not None
        assert popped_tts.job_id == "job_queue_002"

        popped_llm = backend.dequeue_task(stages=("llm",), timeout_seconds=0)
        assert popped_llm is not None
        assert popped_llm.job_id == "job_queue_001"
        assert backend.dequeue_task(timeout_seconds=0) is None

    def test_auto_backend_falls_back_to_memory_when_redis_unreachable(self):
        backend = create_queue_backend(
            mode="auto",
            redis_url="redis://127.0.0.1:63999/0",
        )
        assert backend.backend_name == "memory"


class TestDedicatedStageWorkersAndRetries:
    """Verifies modular LLMWorker -> TTSWorker -> RenderWorker handoff, 3 retries, and DLQ."""

    def test_stage_workers_handoff_through_redis_queues(self, tmp_path: Path):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        backend = RedisQueueBackend(redis_client=fake_redis)

        mock_renderer = MagicMock(spec=RemotionRenderService)
        def _fake_render(props, job_id, output_mp4_path, props_json_path=None):
            return _create_dummy_mp4_file(output_mp4_path)

        mock_renderer.render_presentation.side_effect = _fake_render

        coordinator = PipelineWorkerCoordinator(
            queue_backend=backend,
            temp_jobs_dir=tmp_path,
            llm_generator=LLMScriptGenerator(api_key=""),
            tts_pipeline=TTSAudioPipeline(output_base_dir=tmp_path),
            render_service=mock_renderer,
        )

        job_id = "job_redis_handoff"
        req = _make_video_request(render_video=True)
        backend.save_job(
            JobStatusResponse(
                job_id=job_id,
                status="queued",
                progress_percentage=0,
                current_stage="llm",
                render_requested=True,
            )
        )
        backend.enqueue_task(
            QueueTaskPayload(
                job_id=job_id,
                stage="llm",
                request=req,
                created_at=utc_timestamp(),
            )
        )

        # Dedicated LLMWorker processes only "llm" stage and queues "tts"
        assert coordinator.run_once(stages=("llm",), timeout_seconds=0) is True
        after_llm = backend.get_job(job_id)
        assert after_llm is not None
        assert after_llm.status == "script_ready"
        assert after_llm.progress_percentage == 40
        assert (tmp_path / job_id / "script.json").exists()
        assert backend.get_stats().queues["tts"] == 1

        # Dedicated TTSWorker processes only "tts" stage and queues "render"
        assert coordinator.run_once(stages=("tts",), timeout_seconds=0) is True
        after_tts = backend.get_job(job_id)
        assert after_tts is not None
        assert after_tts.status == "audio_ready"
        assert after_tts.progress_percentage == 80
        assert (tmp_path / job_id / "remotion_props.json").exists()
        assert backend.get_stats().queues["render"] == 1

        # Dedicated RenderWorker processes "render" stage and completes job
        assert coordinator.run_once(stages=("render",), timeout_seconds=0) is True
        after_render = backend.get_job(job_id)
        assert after_render is not None
        assert after_render.status == "completed"
        assert after_render.progress_percentage == 100
        assert after_render.output_video_path is not None
        assert Path(after_render.output_video_path).exists()
        assert [e.step for e in after_render.progress_events] == [
            "generating_script",
            "script_ready",
            "synthesizing_audio",
            "audio_ready",
            "rendering_video",
            "completed",
        ]

    def test_transient_worker_failure_retries_and_recovers_within_3_attempts(self, tmp_path: Path):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        backend = RedisQueueBackend(redis_client=fake_redis)

        flaky_llm = MagicMock(spec=LLMScriptGenerator)
        real_llm = LLMScriptGenerator(api_key="")
        valid_script, valid_model = real_llm.generate_script("Retry recovery test", language="en")
        flaky_llm.generate_script.side_effect = [
            RuntimeError("Transient LLM gateway timeout #1"),
            RuntimeError("Transient LLM gateway timeout #2"),
            (valid_script, valid_model),
        ]

        coordinator = PipelineWorkerCoordinator(
            queue_backend=backend,
            temp_jobs_dir=tmp_path,
            llm_generator=flaky_llm,
            tts_pipeline=TTSAudioPipeline(output_base_dir=tmp_path),
            retry_delay_seconds=0.0,
        )

        job_id = "job_retry_recover"
        backend.save_job(
            JobStatusResponse(
                job_id=job_id,
                status="queued",
                progress_percentage=0,
                current_stage="llm",
                render_requested=False,
            )
        )
        backend.enqueue_task(
            QueueTaskPayload(
                job_id=job_id,
                stage="llm",
                request=_make_video_request(render_video=False),
                attempt=1,
                max_retries=3,
                created_at=utc_timestamp(),
            )
        )

        processed = coordinator.drain_all()
        assert processed == 4  # 2 failed LLM attempts + 1 successful LLM attempt + 1 TTS attempt
        final_job = backend.get_job(job_id)
        assert final_job is not None
        assert final_job.status == "audio_ready"
        assert final_job.retry_count == 2
        assert backend.get_stats().dead_letter_count == 0
        assert any(e.step == "retrying" for e in final_job.progress_events)

    def test_permanent_failure_after_3_attempts_routes_to_dlq(self, tmp_path: Path):
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        backend = RedisQueueBackend(redis_client=fake_redis)

        broken_llm = MagicMock(spec=LLMScriptGenerator)
        broken_llm.generate_script.side_effect = RuntimeError("Permanent upstream error")

        coordinator = PipelineWorkerCoordinator(
            queue_backend=backend,
            temp_jobs_dir=tmp_path,
            llm_generator=broken_llm,
            retry_delay_seconds=0.0,
        )

        job_id = "job_dlq_fail"
        backend.save_job(
            JobStatusResponse(
                job_id=job_id,
                status="queued",
                progress_percentage=0,
                current_stage="llm",
            )
        )
        backend.enqueue_task(
            QueueTaskPayload(
                job_id=job_id,
                stage="llm",
                request=_make_video_request(render_video=False),
                attempt=1,
                max_retries=3,
                created_at=utc_timestamp(),
            )
        )

        processed = coordinator.drain_all()
        assert processed == 3
        failed_job = backend.get_job(job_id)
        assert failed_job is not None
        assert failed_job.status == "failed"
        assert failed_job.retry_count == 2
        assert "Permanent upstream error" in (failed_job.error or "")
        assert backend.get_stats().dead_letter_count == 1
        assert failed_job.progress_events[-1].step == "failed"


class TestWebSocketProgressAndExternalQueueAPI:
    """Verifies FastAPI external Redis queueing, /api/v1/queue/stats, and /ws/jobs/{job_id}."""

    def test_external_redis_worker_mode_and_realtime_websocket_streaming(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        original_backend = main_module.queue_backend
        fake_redis = fakeredis.FakeRedis(decode_responses=True)
        redis_backend = RedisQueueBackend(redis_client=fake_redis)
        configure_queue_backend(redis_backend)
        monkeypatch.setenv("USE_EXTERNAL_WORKER", "true")

        job_id = None
        try:
            client = TestClient(app)

            # 1. Verify health & stats endpoints report Redis mode
            health = client.get("/api/v1/health").json()
            assert health["queue_backend"] == "redis"
            assert health["external_worker_enabled"] is True

            # 2. Submit video generation request -> returns 202 queued immediately without running inline
            gen_resp = client.post(
                "/api/v1/videos/generate",
                json={
                    "prompt": "Realtime WebSocket Progress Test",
                    "language": "en",
                    "aspect_ratio": "16:9",
                    "target_duration_seconds": 36,
                    "render_video": False,
                },
            )
            assert gen_resp.status_code == 202
            payload = gen_resp.json()
            job_id = payload["job_id"]
            assert payload["status"] == "queued"
            assert payload["websocket_url"].endswith(f"/ws/jobs/{job_id}")

            # Job remains queued in Redis until external worker consumes it
            stats_before = client.get("/api/v1/queue/stats").json()
            assert stats_before["backend"] == "redis"
            assert stats_before["queues"]["llm"] == 1

            # 3. Spawn background worker thread simulating external `src.worker` process
            def _run_external_worker():
                time.sleep(0.15)
                main_module.worker_coordinator.drain_all()

            worker_thread = threading.Thread(target=_run_external_worker, daemon=True)
            worker_thread.start()

            # 4. Connect WebSocket client and collect realtime streamed events
            received_events = []
            with client.websocket_connect(f"/ws/jobs/{job_id}") as ws:
                while True:
                    try:
                        event = ws.receive_json()
                        received_events.append(event)
                        if event["step"] in ("audio_ready", "completed", "failed"):
                            break
                    except Exception:
                        break

            worker_thread.join(timeout=15)

            steps = [e["step"] for e in received_events]
            assert "queued" in steps
            assert "generating_script" in steps
            assert "script_ready" in steps
            assert "synthesizing_audio" in steps
            assert "audio_ready" in steps
            for evt in received_events:
                assert evt["job_id"] == job_id
                assert "timestamp" in evt and evt["timestamp"].endswith("Z")
                assert 0 <= evt["progress_percentage"] <= 100

            # 5. Verify job listing endpoint includes the completed job
            jobs_list = client.get("/api/v1/jobs").json()
            assert any(j["job_id"] == job_id and j["status"] == "audio_ready" for j in jobs_list)
        finally:
            configure_queue_backend(original_backend)
            if job_id:
                shutil.rmtree(TEMP_JOBS_DIR / job_id, ignore_errors=True)

    def test_websocket_unknown_job_returns_error_and_closes(self):
        client = TestClient(app)
        with client.websocket_connect("/ws/jobs/job_does_not_exist") as ws:
            msg = ws.receive_json()
            assert msg["step"] == "error"
            assert msg["job_id"] == "job_does_not_exist"


class TestWorkerCLIParser:
    """Verifies standalone `src.worker` CLI flags."""

    def test_worker_cli_defaults_and_overrides(self):
        defaults = parse_worker_args([])
        assert defaults.stages == ["llm", "tts", "render"]
        assert defaults.concurrency == 1

        custom = parse_worker_args(
            ["--stages", "llm", "tts", "--concurrency", "3", "--queue-mode", "memory"]
        )
        assert custom.stages == ["llm", "tts"]
        assert custom.concurrency == 3
        assert custom.queue_mode == "memory"
