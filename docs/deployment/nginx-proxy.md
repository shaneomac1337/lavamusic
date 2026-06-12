# Nginx Reverse Proxy (production)

Host nginx terminates TLS for the dashboard and proxies everything to the lavamusic container's
Fastify server on `127.0.0.1:3001`. Vhost file on the server:
`/etc/nginx/sites-enabled/music.komplexaci.cz`.

## Shape

- **Upstream**: `lavamusic_backend` → `127.0.0.1:3001`, `keepalive 32`
- **Port 80**: `301` redirect to HTTPS
- **Port 443**: `ssl http2`, Let's Encrypt certs
  (`/etc/letsencrypt/live/music.komplexaci.cz/`), TLSv1.2+1.3 only
- **Security headers**: HSTS (1y, includeSubDomains), X-Frame-Options SAMEORIGIN,
  X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
- **Gzip** on for text/JSON/JS/SVG, `client_max_body_size 50M`

## Location routing

| Location | Notes |
|---|---|
| `/` | Main app. HTTP/1.1 upgrade headers, `X-Forwarded-*` set, buffering on, 60s timeouts |
| `/socket.io/` | WebSocket upgrade for the real-time dashboard (Socket.IO). **7-day** read/send timeouts so long-lived sockets survive |
| `/health` | Healthcheck passthrough, responses cached 30s |
| `/public/` | Static assets, `expires 1h`, `Cache-Control: public, immutable` |
| `/api/` | REST API, 30s timeouts |
| `/auth/` | Discord OAuth2 flow, 30s timeouts |

## Interaction with the app

- The app must know its public origin for OAuth redirects — `DASHBOARD_BASE_URL=https://music.komplexaci.cz`
  in the env (see [environment](environment.md)); the Fastify auth route builds the Discord
  OAuth2 `redirect_uri` from it.
- `X-Forwarded-Proto`/`X-Forwarded-Host` headers let Fastify generate correct URLs behind the proxy.
- Logs: `/var/log/nginx/music.komplexaci.cz.{access,error}.log`.
