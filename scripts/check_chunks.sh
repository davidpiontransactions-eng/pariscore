#!/bin/bash
cd /home/ubuntu/pariscore
echo "=== rootMainFiles ==="
for f in 006f293584c8bf5d.js a729a2b8e20e9f00.js 255ad1b1e867ec10.js 771dedee3f5e1621.js turbopack-0a3227a9ae643ee7.js; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/chunks/$f")
  echo "  $f -> HTTP $code"
done
echo "=== polyfill ==="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/chunks/a6dad97d9634a72d.js")
echo "  polyfill -> HTTP $code"
echo "=== build-manifest.json ==="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/build-manifest.json")
echo "  build-manifest -> HTTP $code"
echo "=== _buildManifest.js ==="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/H0SoKS6GMkwsMhh2kXMtQ/_buildManifest.js")
echo "  buildManifest -> HTTP $code"
echo "=== _ssgManifest.js ==="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/H0SoKS6GMkwsMhh2kXMtQ/_ssgManifest.js")
echo "  ssgManifest -> HTTP $code"
echo "=== main HTML ==="
curl -s -o /dev/null -w '  HTML -> HTTP %{http_code}, %{size_download} bytes\n' --max-time 5 "http://localhost:3000/"
echo "=== 3 random chunks ==="
for f in $(ls .next/static/chunks/*.js | shuf | head -3); do
  name=$(basename $f)
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:3000/_next/static/chunks/$name")
  size=$(curl -s -o /dev/null -w '%{size_download}' --max-time 5 "http://localhost:3000/_next/static/chunks/$name")
  echo "  $name -> HTTP $code, ${size}B"
done