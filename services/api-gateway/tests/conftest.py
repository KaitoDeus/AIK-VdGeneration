"""
Pytest configuration for AIK-VdGeneration API Gateway tests.

Forces in-memory queue isolation so running unit/API tests locally never collides with
or mutates a live Redis container exposed on localhost:6379 by Docker Compose.
"""

import os

os.environ["QUEUE_MODE"] = "memory"
os.environ["USE_EXTERNAL_WORKER"] = "false"
