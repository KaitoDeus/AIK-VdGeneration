"""
Dedicated Asynchronous Queue Worker Entrypoint (Milestone M2.1).
Consumes stage tasks (`llm`, `tts`, `render`) from Redis queues and executes
the corresponding modular worker with automatic retries and WebSocket progress publishing.

Usage:
  python -m src.worker
  python -m src.worker --stages llm tts
  python -m src.worker --stages render --concurrency 2
"""

import argparse
import logging
import os
from pathlib import Path
import signal
import sys
import threading
from typing import List, Optional

GATEWAY_ROOT = Path(__file__).resolve().parent.parent
if str(GATEWAY_ROOT) not in sys.path:
    sys.path.insert(0, str(GATEWAY_ROOT))

from src.schemas import WorkerStage
from src.services.queue_service import STAGES_ORDER, create_queue_backend
from src.services.worker_service import PipelineWorkerCoordinator

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("aik-worker")


def parse_worker_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="aik-worker",
        description="AIK-VdGeneration Distributed Queue Worker Daemon",
    )
    parser.add_argument(
        "--stages",
        nargs="+",
        choices=list(STAGES_ORDER),
        default=list(STAGES_ORDER),
        help="Pipeline stages this worker process should consume (default: llm tts render).",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Number of concurrent worker threads to spawn (default: 1).",
    )
    parser.add_argument(
        "--poll-timeout",
        type=int,
        default=1,
        help="Redis BLPOP timeout in seconds per poll cycle (default: 1).",
    )
    parser.add_argument(
        "--queue-mode",
        type=str,
        default=os.getenv("QUEUE_MODE", "redis"),
        choices=["auto", "redis", "memory"],
        help="Queue backend mode (default: redis).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> None:
    args = parse_worker_args(argv)
    temp_jobs_dir = GATEWAY_ROOT / ".temp" / "jobs"
    queue_backend = create_queue_backend(mode=args.queue_mode)
    coordinator = PipelineWorkerCoordinator(
        queue_backend=queue_backend,
        temp_jobs_dir=temp_jobs_dir,
    )

    stop_event = threading.Event()

    def _handle_signal(signum, _frame):
        logger.info("Received shutdown signal (%s). Stopping workers gracefully...", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, _handle_signal)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, _handle_signal)

    stages: tuple[WorkerStage, ...] = tuple(args.stages)
    concurrency = max(1, args.concurrency)
    logger.info(
        "Starting AIK-VdGeneration Worker (backend=%s, stages=%s, concurrency=%d)",
        queue_backend.backend_name,
        stages,
        concurrency,
    )

    if concurrency == 1:
        coordinator.run_forever(
            stages=stages,
            poll_timeout=args.poll_timeout,
            stop_event=stop_event,
        )
        return

    threads: List[threading.Thread] = []
    for idx in range(concurrency):
        thread = threading.Thread(
            target=coordinator.run_forever,
            kwargs={
                "stages": stages,
                "poll_timeout": args.poll_timeout,
                "stop_event": stop_event,
            },
            name=f"worker-{idx + 1}",
            daemon=True,
        )
        thread.start()
        threads.append(thread)

    for thread in threads:
        while thread.is_alive():
            thread.join(timeout=0.5)


if __name__ == "__main__":
    main()
