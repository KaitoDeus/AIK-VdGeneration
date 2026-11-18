# Unified AIK-VdGeneration Backend & Remotion Render Image
# Shared by `api-gateway` (FastAPI/Uvicorn) and `worker` (Async Queue + Remotion Linux Chrome)

FROM python:3.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive

# Install FFmpeg, Node.js 22 LTS, Chromium shared libs, and Vietnamese/Latin font packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    fonts-liberation \
    fonts-noto-core \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python dependencies (cached layer)
COPY services/api-gateway/requirements.txt /app/services/api-gateway/requirements.txt
RUN pip install --no-cache-dir -r /app/services/api-gateway/requirements.txt

# 2. Install Remotion video-renderer dependencies & pre-bake headless browser binary
COPY services/video-renderer/package.json services/video-renderer/package-lock.json /app/services/video-renderer/
RUN cd /app/services/video-renderer \
    && npm ci --omit=dev \
    && npx remotion browser ensure

# 3. Copy gateway and renderer application sources cleanly maintaining monorepo relative depth
COPY services/api-gateway /app/services/api-gateway
COPY services/video-renderer /app/services/video-renderer

# Prepare shared runtime directories
RUN mkdir -p /app/services/api-gateway/.temp/jobs \
    /app/services/video-renderer/public/audio_temp \
    /app/services/video-renderer/public/assets \
    /app/services/video-renderer/public/music

WORKDIR /app/services/api-gateway

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
