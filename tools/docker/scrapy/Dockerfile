# Scrapy in a container — installs scrapy/scrapy from PyPI (the framework).
# Usage: see tools/docker/README.md
FROM python:3.12-slim

# Build deps for lxml/cryptography wheels (slim image is missing them)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libxml2-dev libxslt1-dev libssl-dev libffi-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir scrapy

WORKDIR /work
# Default command prints the version; override at run time:
#   docker compose run --rm scrapy scrapy startproject myproj
#   docker compose run --rm scrapy scrapy crawl myspider
CMD ["scrapy", "version", "-v"]
