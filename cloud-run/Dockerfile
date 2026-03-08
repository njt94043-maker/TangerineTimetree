FROM python:3.11-slim

# madmom needs gcc + audio libs for building Cython extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ pkg-config libsndfile1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
# madmom needs Cython + numpy available at build time for setup.py
RUN pip install --no-cache-dir cython==3.0.12 numpy==1.26.4 && \
    pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 300 main:app
