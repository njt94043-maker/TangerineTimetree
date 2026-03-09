FROM python:3.10-slim

# Build tools + audio libs (madmom Cython extensions, ffmpeg for decode/encode)
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ pkg-config libsndfile1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# 1. madmom needs Cython + numpy at build time for setup.py
# 2. PyTorch CPU-only (no CUDA) — installed separately to use the CPU index
# 3. Then the rest of requirements (including demucs which depends on torch)
RUN pip install --no-cache-dir cython==3.0.12 numpy==1.23.5 setuptools && \
    pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu && \
    pip install --no-cache-dir -r requirements.txt

# Pre-download Demucs htdemucs model weights (~80MB) at build time
# so cold starts don't trigger a download
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs')"

COPY main.py .

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 900 main:app
