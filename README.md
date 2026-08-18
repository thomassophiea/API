# API ONE

**API ONE** is a lightweight, Postman-style API explorer and connection
manager for interacting with Extreme Networks **Gateways**. It runs as a
small Node/Express backend serving a React frontend, and can operate in
two modes from the same codebase:

- **Local mode** - run it on your own machine against any number of
  Gateways (lab, engineering, demo, customer, etc.), switch between them
  without restarting, and keep credentials on your machine only.
- **Hosted mode** (Railway) - a public/demo deployment locked to a single
  pre-approved Gateway, with arbitrary custom Gateway targets disabled by
  default to avoid turning a public server into an open proxy.

Think: **Postman/API Explorer + Gateway connection management**, built
specifically for Extreme Gateway APIs - not a general-purpose SaaS
dashboard.

## Contents

- [Deployment modes](#deployment-modes)
- [Fastest local start (Docker)](#fastest-local-start-docker)
- [Native developer setup](#native-developer-setup)
- [Adding a Gateway](#adding-a-gateway)
- [Credentials](#credentials)
- [TLS / self-signed certificates](#tls--self-signed-certificates)
- [Environment variables](#environment-variables)
- [Railway / hosted deployment](#railway--hosted-deployment)
- [Security considerations](#security-considerations)
- [Architecture](#architecture)
- [Tests](#tests)

## Deployment modes

```
Browser
   |
   v
Local Web Application (React, served by the backend)
   |
   v
Local Backend/API Proxy (Express)
   |
   +---- Gateway A (e.g. Orlando Lab, 10.1.20.5)
   |
   +---- Gateway B (e.g. Engineering Gateway, 10.2.50.10)
   |
   +---- Gateway C (e.g. Demo Gateway, gateway.demo.local)
```

The browser never talks to a Gateway directly. The backend owns all
Gateway communication - authentication, TLS trust decisions, timeouts,
and error handling - so the browser never needs Gateway credentials,
never hits CORS/certificate issues talking to a Gateway, and every
request is scoped to an explicit, selected Gateway ID.

`APP_MODE` controls which capabilities are available:

| Mode     | Custom Gateways | Typical use                              |
|----------|-----------------|-------------------------------------------|
| `local`  | Allowed          | Engineer/QA/support running this locally |
| `hosted` | Disabled by default | Railway/public demo deployment       |

## Fastest local start (Docker)

Requires Docker (with Compose) installed. Nothing else.

```bash
git clone https://github.com/thomassophiea/API.git
cd API
docker compose up --build
```

Then open:

```
http://localhost:3000
```

You'll see **"No Gateways configured"**. Click **Add Gateway**, enter a
name, host/IP, and credentials, test the connection, save it, and you're
using the API explorer against that Gateway. Add a second Gateway and
switch between them from the header selector at any time - no source
edits, no `.env` edits, no restart required.

Gateway profile metadata (name/host/port/protocol - never credentials)
persists across container restarts in the `gateway-data` Docker volume.

## Native developer setup

Docker is not required for development.

```bash
git clone https://github.com/thomassophiea/API.git
cd API
cp .env.example .env   # optional - defaults work out of the box
npm install
npm run dev
```

`npm run dev` runs the backend (`node server.js`, defaults to port 3001)
and the Vite frontend dev server (port 3000, proxying `/api` to the
backend) concurrently. Open:

```
http://localhost:3000
```

Other useful scripts:

```bash
npm run dev:server   # backend only
npm run dev:frontend # frontend only (Vite)
npm run build        # production frontend build -> build/
npm start             # run the production server (serves build/ + API)
npm test              # run the automated test suite (vitest)
```

## Adding a Gateway

From the app:

1. If no Gateways exist yet, click **Add Gateway** on the onboarding
   screen (or open **Manage Gateways** from the login screen / the
   Gateway selector in the header once at least one Gateway exists).
2. Fill in:
   - **Display Name** - e.g. "Orlando Lab"
   - **Gateway Host/IP** - e.g. `10.1.20.5` or `gateway.example.local`
   - **Port** - defaults to `443`. Some Gateway/Campus Controller
     deployments expose the Management API on a non-standard port
     (e.g. `5825`) instead of the default HTTPS port. If Test
     Connection fails with a generic/HTML 404 (rather than a JSON
     error from the Gateway), the Gateway is likely reachable but on a
     different port - check your Gateway's documented Management API
     port and update this field accordingly.
   - **Protocol** - defaults to `HTTPS`
   - **Username** / **Password**
   - **Trust self-signed certificate** - only if this specific Gateway
     uses a lab/self-signed cert (see [TLS](#tls--self-signed-certificates))
3. Click **Test Connection** to verify reachability, TLS, and
   authentication before saving.
4. Save. The new Gateway appears in the Gateway list; select it to make
   it the active target for all API requests.

You can have any number of Gateway profiles (Add/Edit/Delete/Test/Select
from **Settings > Gateways**). Each Gateway has its own internal ID, and
every API request is explicitly scoped to the currently selected
Gateway - switching Gateways does not affect other saved profiles, and
in-flight requests are never redirected mid-flight to a different
Gateway.

## Credentials

- Gateway **usernames** are stored (non-secret, used for display/UX).
- Gateway **passwords are never written to disk**. They live only in an
  in-memory map on the backend process for as long as that process is
  running (`server/credentials.js`). Restarting the app/container clears
  stored passwords and you'll be prompted to re-enter them next time you
  select or test that Gateway.
- Passwords are **never** returned in any API response, never logged
  (see centralized redaction in `server/redact.js`), never placed in
  URLs, and never stored in browser `localStorage`.
- In **local mode**, credentials never leave your machine - they are not
  sent to Railway, analytics, telemetry, or any third party.
- This is an intentional, pragmatic trade-off for a local engineering
  utility rather than a full encrypted-at-rest secrets vault. If
  persistent credential storage is added in the future, it should be
  explicitly opt-in and use proper OS-level encryption/key storage
  rather than a plaintext field.

## TLS / self-signed certificates

Certificate verification is **enabled by default** for every Gateway and
is never disabled globally. Lab Gateways using self-signed certificates
can be marked **"Trust self-signed certificate"** on a *per-Gateway*
basis - this is a deliberate, visible, per-profile opt-in
(`trustSelfSigned` on that Gateway's profile), not a blanket setting.

When a connection fails TLS verification and the profile is not marked
as trusted, **Test Connection** returns a clear, actionable message
instead of silently failing or disabling verification:

```
Certificate verification failed. If this Gateway uses a self-signed lab
certificate, enable "Trust self-signed certificate" for this Gateway
profile and try again.
```

## Environment variables

All variables are optional with sensible defaults; see `.env.example`
for a ready-to-copy template with safe placeholder values.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` (see note) | Port the backend listens on. In a single-container/Docker/Railway deployment this is the one port that serves both the API and the built frontend (Docker sets it to `3000`). |
| `BACKEND_PORT` | `3001` | Alternate way to set the backend port; used by `vite.config.ts`'s dev proxy target so the frontend dev server (port 3000) and backend don't collide. |
| `APP_MODE` | `local` (or auto-detected as `hosted` on Railway) | `local` allows arbitrary Gateway targets; `hosted` restricts to a single locked Gateway. |
| `ALLOW_CUSTOM_GATEWAYS` | derived from `APP_MODE` | Explicit override of whether custom Gateway targets are allowed, regardless of `APP_MODE`. |
| `CAMPUS_CONTROLLER_URL` | unset | If set, the backend registers a single **locked** Gateway profile pointing at this URL on startup - this is how the existing Railway/hosted deployment continues to work unchanged. Not needed for local use (add Gateways from the UI instead). |
| `GATEWAY_STORE_PATH` | `./data/gateways.json` | Where non-secret Gateway profile metadata is persisted. |

Railway also auto-detects its own environment (`RAILWAY_ENVIRONMENT`,
`RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`) to default `APP_MODE` to
`hosted` even without explicitly setting it.

## Railway / hosted deployment

The existing Railway deployment continues to work unchanged: Railway
uses the Nixpacks builder configured in `railway.json` / `railway.toml`
/ `Procfile` (a Dockerfile is also present for local use, but Railway's
config explicitly pins the Nixpacks builder, so the two do not
conflict).

Set `CAMPUS_CONTROLLER_URL` in the Railway project's environment
variables to the Gateway that the hosted/demo deployment should target.
On startup, the backend registers that Gateway as a single **locked**
profile - it cannot be deleted, and its host/port/protocol cannot be
changed via the API - while `APP_MODE` auto-detects as `hosted` on
Railway, disabling the ability to add arbitrary custom Gateways.

## Security considerations

**Local mode** intentionally allows arbitrary Gateway hosts, because the
app is running on the user's own machine/network and reaching devices on
that network is the whole point of the tool.

**Hosted mode** is deliberately restricted so the public deployment can
never become an open SSRF proxy capable of reaching arbitrary
internal/private IP addresses:
- Creating a custom Gateway is refused (`403`).
- Editing a locked Gateway's host/port/protocol is refused (`403`);
  only its display name may be changed.
- Deleting the locked Gateway is refused (`403`).
- The proxy layer independently re-checks `locked`/`allowCustomGateways`
  before forwarding any request (defense in depth - not just a UI-level
  restriction).

Other measures:
- CORS is restricted to `localhost`/`127.0.0.1` origins (the backend's
  own frontend), not reflected for arbitrary origins.
- Centralized redaction (`server/redact.js`) strips passwords,
  `Authorization` headers, cookies, and tokens from every log line and
  API response.
- Gateway host input is validated against a strict allow-list pattern to
  prevent host-injection (e.g. shell metacharacters, embedded
  credentials, or protocol/path smuggling) before any network call is
  made.
- A global Express error handler and `unhandledRejection` logger ensure
  a single bad request cannot crash the backend process.

## Architecture

```
GatewayConnection (profile: name/host/port/protocol/credentials-flag)
        |
        v
GatewayApiClient (src/services/api.ts, frontend)
        |
        +-- routes every real Gateway API call through
            /api/gateways/<id>/proxy/<gateway-path>
        |
        v
Backend Gateway proxy (server/proxy.js)
        |
        +-- authentication (OAuth2 password grant, reused from the
        |   Gateway's existing API - see server/testConnection.js)
        +-- request execution + timeout (server/gatewayHttp.js, undici)
        +-- TLS handling (per-Gateway trust, never global)
        +-- API errors / response passthrough
        +-- logging/redaction (server/requestLog.js, server/redact.js)
```

Feature code (e.g. `src/components/ApiTestTool.tsx`) calls the shared
`apiService`/`gatewayClient`, never `fetch()` directly against a
Gateway - this keeps Gateway communication centralized instead of
scattered across UI components.

## Tests

```bash
npm test
```

Runs the full vitest suite (backend + frontend), covering Gateway input
validation, profile CRUD, active-Gateway switching, password/
Authorization-header redaction, request routing to the selected
Gateway, timeout handling, authentication failure, unreachable Gateway,
invalid/self-signed certificate handling, hosted-mode restrictions,
local-mode custom Gateway support, and the health endpoint. No live
Gateway is required - a small mock Gateway HTTP server is used for
network-level scenarios.

---

## Quick reference

```bash
# Local Docker
git clone https://github.com/thomassophiea/API.git
cd API
docker compose up --build
# -> http://localhost:3000

# Local development
npm install
npm run dev
# -> http://localhost:3000 (frontend), backend on http://localhost:3001

# Tests
npm test

# Production / Railway
# Railway builds and runs this automatically via railway.json/Procfile.
# Locally, the equivalent production run is:
npm run build
npm start
```
