# Rapport de fin de mission — Correction ERR_HTTP2_PROTOCOL_ERROR

**Date** : 2026-09-06, session 6 (~14:30–14:50)
**Mission** : résoudre `net::ERR_HTTP2_PROTOCOL_ERROR` sur les fichiers statiques de pariscore.fr.
**Statut final : ✅ RÉSOLU** — les statiques sont servis directement par Nginx depuis le disque (`alias`), plus de passage par Bun.

---

## 1. Symptôme

- Console navigateur : `net::ERR_HTTP2_PROTOCOL_ERROR` sur `fc017392b0d9fc42.css` et les chunks JS sous `/_next/static/`
- Le HTML se chargeait (200) mais sans CSS → affichage HTML brut

## 2. Cause racine

Nginx faisait un `proxy_pass http://localhost:3005` pour les fichiers statiques, ce qui créait une rupture de flux HTTP/2 (stream truncation) entre le navigateur et Bun.

## 3. Correctif appliqué

### 3.1 Nginx — `alias` au lieu de `proxy_pass`

**Avant** (`/etc/nginx/sites-enabled/pariscore`) :
```nginx
location /_next/static/ {
    proxy_pass http://localhost:3005;
    proxy_cache_valid 200 1y;
    add_header Cache-Control "public, immutable, max-age=31536000";
    access_log off;
}
```

**Après** :
```nginx
location /_next/static/ {
    alias /home/ubuntu/pariscore/.next/static/;
    expires 365d;
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

location /public/ {
    alias /home/ubuntu/pariscore/public/;
    expires 365d;
    access_log off;
}
```

### 3.2 Buffers proxy (location /)

```nginx
location / {
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

    # Fix HTTP/2 stream truncation
    proxy_buffers 16 32k;
    proxy_buffer_size 64k;
    proxy_busy_buffers_size 128k;
}
```

### 3.3 Permissions

```bash
sudo chown -R ubuntu:www-data /home/ubuntu/pariscore/.next/static
sudo chmod -R 755 /home/ubuntu/pariscore/.next/static
```

## 4. Vérification

| Sonde | Résultat |
|-------|----------|
| `https://pariscore.fr/_next/static/chunks/fc017392b0d9fc42.css` | 200 (312 790 o) |
| `https://pariscore.fr/_next/static/chunks/1772acb377e56c7b.js` | 200 (45 071 o) |
| `https://pariscore.fr/_next/static/media/caa3a2e1cccd8315-s.p.3b6cae6d.woff2` | 200 (29 288 o) |
| `https://pariscore.fr/` | 200 (163 709 o) |
| `https://pariscore.fr/api/v1/status` | 200 `{"status":"ok"}` |
| `sudo nginx -t` | syntax ok |

## 5. Leçons

1. **Ne jamais `proxy_pass` les statiques** — Nginx doit les servir depuis le disque avec `alias`, c'est 100x plus rapide et ça évite les problèmes de flux HTTP/2.
2. **Les buffers proxy** (`proxy_buffers`, `proxy_buffer_size`) sont nécessaires quand on proxifie des réponses volumineuses en HTTP/2.
3. **Backup hors de `sites-enabled/`** — un backup avec `.bak` dans `sites-enabled` crée un conflit de `default_server`.

---

*Rapport de fin de mission — prod pariscore.fr opérationnelle, statiques servis par alias Nginx.*
