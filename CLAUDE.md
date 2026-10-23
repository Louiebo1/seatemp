# Sea Temp for the web

The iPhone app's maps (`~/code/sst`) as a web page, started 2026-10-23 for Louie: four
sea surface temperature maps (Monterey Bay, Morro Bay, SoCal, Baja), live boats with the
SoCal party boats named, the Boat List, and Global Fishing Watch's fishing spots. Plain
ES modules, no build step. Family only: a passcode, asked once per device.

## Two parts
- **The page** (GitHub Pages): `index.html`, `css/style.css`, `js/`. It talks only to the
  relay — never to NOAA, aisstream or Global Fishing Watch directly (NOAA sends no CORS
  headers; aisstream refuses browsers; the keys must stay hidden).
- **The relay** (`relay/worker.js`, Cloudflare Workers free plan, Louie's account
  louiebo@comcast.net, at https://seatemp.louiebo.workers.dev):
  - Secrets (never in the repo; each read from a private file in `~/.config/seatemp/`
    that Louie saved with `pbpaste`, uploaded by `relay/deploy.sh secret NAME`):
    PASSCODE (`passcode`), AIS_KEY (`ais-key`), GFW_TOKEN (`gfw-token`), RESEND_KEY
    (`resend-key`). The Cloudflare API token ("Edit Cloudflare Workers") is
    `~/.config/seatemp/cloudflare-token`. Never print any of them.
  - `POST /unlock {passcode, device, label}` → token = HMAC(passcode, device id); the
    page keeps `DEVICE.TOKEN` in localStorage (`seatemp.auth`) and sends it as a Bearer
    token. Passcode compared ignoring case and spaces. 10 wrong tries an hour per IP.
    Changing the passcode signs every device out.
  - `/sst/latest`, `/sst/grid?region&day`, `/sst/mask?region`: ERDDAP passed through for
    the four boxes only (`regions-data.js`), retried once on NOAA's occasional 522.
    Browser-cached (`private, max-age`); the Cache API does nothing on workers.dev.
  - The Hub (one Durable Object, SQLite-backed — the free plan's kind): holds the
    aisstream websocket while anyone has asked for `/boats` in the last 3 minutes (alarm
    every minute; saves the fleet), keeps boats 2 h (party boats 24 h); `/history?days=7|14`
    caches GFW events 6 h (GFW answers 201); counts devices (`device:<id>` → first, last,
    label like "iPhone · Safari"); when the count passes 20 it emails ALERT_EMAIL
    (louiebo@comcast.net, a plain binding) once through Resend
    (`onboarding@resend.dev` → only the Resend account's own address). `/stats`,
    `/alert-test`, `/forget` (this device).
  - A running Durable Object keeps the code it started with, even after a deploy (found
    2026-10-23: a hub kept old code for 10+ minutes while being polled). So every Hub
    call carries `X-Version: VERSION`; a Hub on other code saves and `state.abort()`s, and
    the worker retries once. **Bump `VERSION` in worker.js on every relay change.** The Hub
    is `idFromName('hub2')` (the first one, 'hub', ran pre-fix code; only test data).
  - CORS: https://louiebo1.github.io and http://127.0.0.1:8765 / localhost:8765 only.
  - Deploy: `relay/deploy.sh` (uploads worker.js + js/party.js + js/regions-data.js;
    the Durable Object migration only on the very first upload; keeps secrets).

## Page layout
- `js/regions-data.js` — generated from the app's `Region.swift` by
  `tools/regions_from_app.py` (edit the app, then regenerate). `js/regions.js` — covers
  (hidden boxes), describe ("8 nm SW of …"), position.
- `js/party.js` — the 123 party boats and `partyOf(boat)` (same rule as the app: not
  cargo/tanker/tug/sailing/pleasure types, not MMSI 338…, not north of 34.9°N); shared
  with the relay. Regenerate the list with `tools/party_from_app.py`.
- `js/grid.js`, `js/render.js` — ports of SSTGrid / SSTRenderer (palette, scale,
  marching-squares isotherms).
- `js/map.js` — canvas map: pinch/scroll zoom about the fingers, drag, double-tap to fit,
  tap → water / boat (22 px) / fishing spot (14 px). Place names on their `side`.
- `js/api.js` — relay calls, unlock, forget. `js/main.js` — screens, polling (boats every
  10 s for a minute, then 30 s, only while the page is visible), Boat List, About + device
  count. Settings: `seatemp.region`, `.mode`, `.span`.
- Icons are drawn (inline SVG) — iPhone fonts lack ⛴ ◆ ☰ ⟳. `img/` icons are the app's.

## Test
- Serve: `python3 nocache.py 8765 DIR` (a no-store static server) — port 8765 is the one the
  relay accepts. On 127.0.0.1 only, `#auth=DEVICE.TOKEN` signs in as a test device and
  `window.__seatemp` exposes state for scripted checks (headless Chrome with its own
  `--user-data-dir`, a same-origin iframe harness, `--dump-dom`). Phone layout: the iPhone
  simulator's Safari. Remove test devices afterwards (`/forget` with their token).
- Checked 2026-10-23: live boats through the relay (~160 in 2 min; Toronado, New Del Mar,
  Victory, Ocean Odyssey, Top Gun 80 named), 31 GFW spots in 7 days; four maps (scales match the app), tap readout, party matching,
  Boat List → map, device count; iPhone 17 Pro and an 1100 px desktop window.

## Deploy
Not published yet (waiting for Louie's OK). Plan: public repo Louiebo1/seatemp → GitHub
Pages https://louiebo1.github.io/seatemp/ (`~/bin/gh`). Nothing secret is in the repo.
