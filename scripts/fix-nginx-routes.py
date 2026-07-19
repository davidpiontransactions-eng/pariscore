#!/usr/bin/env python3
"""
Replace prefix locations /api/mma/ and /api/cycling/ with regex locations
so that both with and without trailing slash go directly to Next.js.

Root cause: Next.js 308-redirects /api/cycling/ -> /api/cycling (strips trailing
slash), and nginx had an exact-match that 301-redirects back -> infinite loop.

Usage: sudo python3 scripts/fix-nginx-routes.py && sudo nginx -t && sudo systemctl reload nginx
"""
path = "/etc/nginx/sites-enabled/pariscore"

with open(path, "r") as f:
    c = f.read()

# Remove the exact-match redirects added by the first fix attempt
c = c.replace('    location = /api/mma { return 301 /api/mma/; }\n    location = /api/cycling { return 301 /api/cycling/; }\n\n    ', '')

# Replace prefix locations with regex locations
old_mma = '''    location /api/mma/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }'''

old_cycling = '''    location /api/cycling/ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }'''

new_mma = '''    location ~ ^/api/mma(?:/.*)?$ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }'''

new_cycling = '''    location ~ ^/api/cycling(?:/.*)?$ {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }'''

c = c.replace(old_mma, new_mma)
c = c.replace(old_cycling, new_cycling)

with open(path, "w") as f:
    f.write(c)

print("Replaced prefix /api/mma/ and /api/cycling/ with regex locations ~ ^/api/mma(?:/.*)?$")
