# Security Policy

## Supported Versions

The actively developed line is `5.0.0-beta` (see `package.json`). Only the latest
`main` branch receives security updates.

| Version       | Supported          |
| ------------- | ------------------ |
| 5.0.0-beta    | :white_check_mark: |
| < 5.0.0-beta  | :x:                |

## Web Dashboard Content-Security-Policy

The Fastify dashboard sets a strict CSP via `@fastify/helmet` (`src/web/server.ts`):

- `default-src 'self'`
- `style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com` (FontAwesome)
- `script-src 'self' 'unsafe-inline' https://cdn.socket.io` (Socket.IO client)
- `script-src-attr 'unsafe-inline'` (inline event handlers on the guild page)
- `img-src 'self' data: https:`
- `connect-src 'self' ws: wss:`

CSS is self-hosted — the Tailwind bundle is built by `npm run build:css` and served
from `/public/css/`. No jsDelivr CDN is used.

Other dashboard hardening:
- Discord OAuth2 login with JWT stored in an `httpOnly` cookie (`secure` in production,
  `sameSite: 'lax'`); see `src/web/routes/auth.ts`.
- `DASHBOARD_SECRET` signs the JWT; if unset it is auto-generated at startup (set a
  permanent value in production — see `docs/DASHBOARD_SECRET_EXPLAINED.md`).
- CORS is enabled with credentials; `@fastify/helmet` adds standard security headers.

## Reporting a Vulnerability

Report vulnerabilities privately — open a GitHub security advisory on the repository,
or reach the maintainers via the project Discord: https://discord.gg/YQsGbTwPBx

Please do not open public issues for security reports. Expect an initial response
within a few days.
