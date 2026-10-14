# SmailPro API (Render)

A persistent Node/Express JSON API wrapping SmailPro temporary email, deployable on Render as a Web Service.

## Endpoints

All endpoints accept GET (query params) and POST (JSON body). CORS is open.

### `GET /health`
Liveness probe used by Render's health check.
```json
{ "success": true, "status": "ok", "uptime": 42.1 }
```

### `GET /domains`
```json
{
  "success": true,
  "google": ["gmail.com", "googlemail.com"],
  "microsoft": ["outlook.com", "..."],
  "edu": ["singapore.edu.pl", "..."],
  "other": ["devpoet.com", "..."],
  "all": ["..."]
}
```

### `GET|POST /create`
Params:
- `domain` (default `gmail.com`; `random` → `singapore.edu.pl`)
- `username` (default `random`)
- `type` (default `alias`)
- `server` (default `1`)
- `userAgent` (optional)

Returns the account object including `address`, `timestamp`, `key`, `cookie`. Keep all four — you need them for inbox/message/wait.

### `GET|POST /inbox`
Params: `address` (required), `timestamp`, `key`, `cookie`, `userAgent`.

Returns `{ success, address, provider, total, messages: [...] }`.

### `GET|POST /message`
Params: `address` (required), `mid` (required), `cookie`, `userAgent`.

Returns `{ success, address, mid, provider, body, attachments }`.

### `GET|POST /wait`
Params: `address` (required), `timestamp`, `key`, `cookie`, `timeoutMs` (default 60000, capped by `WAIT_MAX_MS`), `intervalMs` (default 4000), `contains` (substring filter), `fetchBody` (default true), `userAgent`.

Polls until a matching message arrives or times out (504 on timeout).

## Local run

```
cp .env.example .env
npm install
npm start
```

Server listens on `PORT` (default 3000).

## Deploy on Render

1. Push the repo to GitHub.
2. Render → New → Web Service → connect the repo.
3. Settings:
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/health`
   - **Env vars:** set `WAIT_MAX_MS` (e.g. `120000`), optionally `SMIALPRO_TURNSTILE_API_KEY`
4. Deploy.

`render.yaml` is included, so you can also use **New → Blueprint** and point it at the repo to provision from the file.

## Notes

- Render runs a persistent process, so there's no per-request wall-clock limit like Vercel's serverless functions. `/wait` can poll for minutes, bounded by `WAIT_MAX_MS`. Keep it under Render's idle-connection timeout (~100s on the free plan) or the client may drop the connection first.
- The Turnstile solver (`fgsi.dpdns.org`) and Sonjj API are third-party. `/create` and `/message` return 502 if either is unreachable.
- Cookies returned by `/create` are reusable. Pass them on subsequent calls to skip re-fetching a session.
- Free plan services spin down after inactivity — first request after sleep is slow. Upgrade or use a keep-alive pinger if that matters.
