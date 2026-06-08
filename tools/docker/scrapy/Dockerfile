# Scrapy + Playwright + stealth — runs a real Chromium per request to pass
# fingerprint-based Cloudflare (e.g. betmines). Also runs plain scrapy spiders.
FROM python:3.12-slim

RUN pip install --no-cache-dir scrapy scrapy-playwright playwright-stealth

# Chromium + matching system deps for the installed playwright version
RUN playwright install --with-deps chromium

WORKDIR /work
CMD ["scrapy", "version", "-v"]
