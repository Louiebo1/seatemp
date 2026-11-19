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
  - `/sst/latest`, `/sst/grid?region&day`, `/sst/mask?region`: the four boxes only
    (`regions-data.js`), served from Workers KV `seatemp-maps` (binding MAPS; deploy.sh
    makes it): `grid:<region>:<day>` (16-day TTL), `mask:<region>` (60), `latest`
    {day, at}. The Hub's alarm runs `keepMapsUp` every 30 min: on a new NOAA day it saves
    all four grids + any missing masks, then updates `latest` (so the newest day is always
    saved). A miss fetches ERDDAP (retried once on its 522) and saves it. Response header
    `X-From: saved|noaa`. Measured 2026-11-19: SoCal 2.6 s → 0.6 s, Baja 2.6 s → 0.8 s.
    Browser-cached (`private, max-age`); the Cache API does nothing on workers.dev.
  - The Hub (one Durable Object, SQLite-backed — the free plan's kind): holds the
    aisstream websocket **around the clock** (since 2026-11-19; alarm every minute
    reconnects; storage written every 5 minutes to stay well under the free plan's 100k row
    writes a day; always-on ≈ 11,000 of the free 13,000 GB-s a day — watch it), keeps boats
    2 h (party boats 24 h). Party boats' tracks: `trail:<mmsi>` = [[sec, lat, lon, kn]…],
    72 h, a point a minute at most (every 10 min sitting still); `/trails?since=ms` (only
    boats that are party boats now). Pins (`pins`: name key → {mmsi, seen, known}): a party
    boat's transponder, learned the first time a boat with the name is heard within 3 nm of
    its home harbor (`HOMES` in party.js), re-pinnable after 14 silent days; `KNOWN_PINS`
    (100 transponders for 97 names: fishing-reports.ai's fleet list, vessel databases, and the FCC's ship licenses — data.fcc.gov ULS `l_ship.zip`, SH.dat name→MMSI joined to EN.dat licensee/city, picked when the licensee is a sportfishing company near the landing) always win; a list where boats share a name (Patriot, Endeavor). A name's pins exclude namesakes only when they cover every party boat with that name. `/boats`
    and `/trails` send `pins`; `partyOf(boat, pins)` uses them. `/wake` (no auth) starts it;
    deploy.sh calls it. `/history?days=7|14`
    caches GFW events 6 h (GFW answers 201); counts devices (`device:<id>` → first, last,
    label like "iPhone · Safari"); when the count passes 20 it emails ALERT_EMAIL
    (louiebo@comcast.net, a plain binding) once through Resend
    (`onboarding@resend.dev` → only the Resend account's own address). `/stats`,
    `/alert-test`, `/forget` (this device).
  - A running Durable Object keeps the code it started with, even after a deploy (found
    2026-10-23: a hub kept old code for 10+ minutes while being polled). So every Hub
    call carries `X-Version: VERSION-<hash of the secrets>` (a secret change needs a restart
    too); a Hub on other code saves and `state.abort()`s, and
    the worker retries once. **Bump `VERSION` in worker.js on every relay change.** The Hub
    is `idFromName('hub2')` (the first one, 'hub', ran pre-fix code; only test data).
  - CORS: https://louiebo1.github.io and http://127.0.0.1:8765 / localhost:8765 only.
  - Deploy: `relay/deploy.sh` (uploads worker.js + js/party.js + js/regions-data.js;
    the Durable Object migration only on the very first upload; keeps secrets).

## Page layout
- `js/regions-data.js` — generated from the app's `Region.swift` by
  `tools/regions_from_app.py` (edit the app, then regenerate). `js/regions.js` — covers
  (hidden boxes), describe ("8 nm SW of …"), position.
- `js/party.js` — the 144 party boats and `partyOf(boat, pins)` (same rule as the app:
  pinned transponder first; else by name unless cargo/tanker/tug/sailing/pleasure type, MMSI
  338… that doesn't say fishing/passenger (Excel and Horizon are 338), or north of
  34.9°N); `KNOWN_PINS`, `HOMES`; shared with the relay. Regenerate the list with
  `tools/party_from_app.py` (KNOWN_PINS is hand-kept, same as the app's `knownPins`).
- `js/trails.js` — trail speed classes (≤4 kn fishing = thick pink, ≤10 trolling = yellow,
  faster = thin white; dotted across a 30 min–6 h silence; dock points skipped), merging,
  "fished X in the last 12 h". Trails setting `seatemp.trails` (12/24/72 h, 0 = tapped boat only).
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
Live at https://louiebo1.github.io/seatemp/ since 2026-10-23 — GitHub Pages from `main`
(public repo Louiebo1/seatemp; `~/bin/gh`). Page: commit and `git push` (about a minute).
Relay: `relay/deploy.sh` (bump VERSION). Nothing secret is in the repo. Test devices
were removed from the count at launch (count 0); the alert email was tested 2026-10-23.
