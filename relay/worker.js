// Sea Temp's relay (Cloudflare Workers, free plan): the web page talks only to this.
// - Holds the secrets — PASSCODE (the family passcode), AIS_KEY (aisstream.io),
//   GFW_TOKEN (Global Fishing Watch), RESEND_KEY (email) — so no page ever sees them.
// - A device unlocks once with the passcode and gets a token (an HMAC of its device id
//   under the passcode); every other call needs it. Change the passcode and every device
//   is asked again.
// - Passes NOAA's temperature maps through (NOAA sends no CORS headers, so a page can't
//   read them itself), only for the four maps.
// - The Hub (one Durable Object) listens to aisstream while anyone is looking, keeps the
//   fleet, caches Global Fishing Watch's fishing events for 6 hours, and counts devices:
//   when more than ALERT_AFTER have unlocked, it emails ALERT_EMAIL once (Resend).

import { REGION_DATA } from './regions-data.js';
import { partyOf } from './party.js';

const ALLOWED_ORIGINS = ['https://louiebo1.github.io', 'http://127.0.0.1:8765', 'http://localhost:8765'];
const ERDDAP = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/jplMURSST41';
const ALERT_AFTER = 20;
/** Bumped on every change, so /hello shows which code is answering. */
const VERSION = 6;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const response = await route(request, env);
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return json({ error: String(error && error.message || error) }, 500, cors);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const hub = () => ({ fetch: (u, init = {}) => hubFetch(env, u, init) });

  if (path === '/unlock' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const device = String(body.device || '');
    if (!/^[A-Za-z0-9-]{8,64}$/.test(device)) return json({ error: 'Bad device' }, 400);
    if (!env.PASSCODE) return json({ error: 'The passcode isn\'t set up yet.' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const gate = await hub().fetch('https://hub/attempt', { method: 'POST', body: JSON.stringify({ ip }) });
    if (gate.status === 429) return json({ error: 'Too many wrong tries. Wait an hour and try again.' }, 429);
    if (normalize(body.passcode) !== normalize(env.PASSCODE)) {
      await hub().fetch('https://hub/attempt', { method: 'POST', body: JSON.stringify({ ip, failed: true }) });
      return json({ error: 'That passcode isn\'t right.' }, 403);
    }
    await hub().fetch('https://hub/register', { method: 'POST', body: JSON.stringify({ device, label: String(body.label || '').slice(0, 40) }) });
    return json({ token: await tokenFor(device, env) });
  }

  // Everything else needs a device that has unlocked.
  const [device, token] = (request.headers.get('Authorization') || '').replace(/^Bearer /, '').split('.');
  if (!device || !token || !env.PASSCODE || token !== await tokenFor(device, env)) return json({ error: 'locked' }, 401);

  if (path === '/sst/latest') {
    const r = await fetch(`${ERDDAP}.json?time%5B(last)%5D`);
    if (!r.ok) return json({ error: `NOAA answered ${r.status}` }, 502);
    const day = (await r.json()).table.rows[0][0].slice(0, 10);
    return json({ day }, 200, { 'Cache-Control': 'private, max-age=1800' });
  }
  if (path === '/sst/grid' || path === '/sst/mask') {
    const region = REGION_DATA.find(r => r.id === url.searchParams.get('region'));
    if (!region) return json({ error: 'No such map' }, 404);
    const box = `%5B(${region.south}):1:(${region.north})%5D%5B(${region.west}):1:(${region.east})%5D`;
    let query, maxAge;
    if (path === '/sst/mask') {
      query = `mask%5B(last)%5D${box}`;
      maxAge = 30 * 86400;     // Land doesn't move.
    } else {
      const day = url.searchParams.get('day') || '';
      if (!/^\d{4}-\d\d-\d\d$/.test(day)) return json({ error: 'Bad day' }, 400);
      query = `analysed_sst%5B(${day}T09:00:00Z)%5D${box}`;
      maxAge = 14 * 86400;     // A day's map never changes.
    }
    // NOAA's server sometimes times out once (Cloudflare's 522); a second try works.
    let r = await fetch(`${ERDDAP}.esriAscii?${query}`);
    if (r.status >= 500) r = await fetch(`${ERDDAP}.esriAscii?${query}`);
    if (r.status === 404 || (!r.ok && (await r.clone().text()).includes('outside'))) return json({ error: 'not available' }, 404);
    if (!r.ok) return json({ error: `NOAA answered ${r.status}` }, 502);
    return new Response(r.body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': `private, max-age=${maxAge}` } });
  }

  // The Hub's own: /boats, /history, /stats, /hello, /alert-test, /forget (this device).
  if (['/boats', '/history', '/stats', '/hello', '/alert-test', '/forget'].includes(path)) {
    return hub().fetch(`https://hub${path}${url.search}`, { method: request.method, headers: { 'X-Device': device } });
  }
  return json({ error: 'Not found' }, 404);
}

/** A call to the Hub. A running Hub keeps the code it started with, even after a deploy:
 *  every call says which version is current, a Hub on older code restarts itself (its
 *  call fails), and the call is made once more, to the new code. */
async function hubFetch(env, url, init) {
  const stub = () => env.HUB.get(env.HUB.idFromName('hub2'));
  const headers = { ...(init.headers || {}), 'X-Version': String(VERSION) };
  const body = init.body;
  try {
    return await stub().fetch(url, { ...init, headers, body });
  } catch (e) {
    return await stub().fetch(url, { ...init, headers, body });
  }
}

const normalize = s => String(s || '').toLowerCase().replace(/\s+/g, '');

async function tokenFor(device, env) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('seatemp:' + normalize(env.PASSCODE)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(device)));
  return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

// ---------------------------------------------------------------------------------------

const AIS_TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport', 'ShipStaticData', 'StaticDataReport'];
const BOXES = REGION_DATA.map(r => [[r.south, r.west], [r.north, r.east]]);
const FORGET = 2 * 3600e3, FORGET_PARTY = 24 * 3600e3;
/** Stop listening to aisstream this long after the last page asked for boats. */
const IDLE = 3 * 60e3;

export class Hub {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.fleet = null;          // mmsi → boat
    this.types = null;          // mmsi → AIS ship type (sent only every few minutes)
    this.ws = null;
    this.lastViewer = 0;
    this.heard = false;
    this.refused = 0;
    this.status = 'off';
    this.retryAt = 0;
  }

  async load() {
    if (this.fleet) return;
    const saved = await this.state.storage.get('fleet');
    this.fleet = new Map((saved && saved.boats || []).map(b => [b.mmsi, b]));
    this.types = new Map(saved && saved.types || []);
  }

  async save() {
    if (!this.fleet) return;
    this.prune();
    const types = [...this.types].slice(-4000);
    await this.state.storage.put('fleet', { boats: [...this.fleet.values()], types });
  }

  prune(now = Date.now()) {
    for (const [k, b] of this.fleet) if (now - b.seen > (partyOf(b).length ? FORGET_PARTY : FORGET)) this.fleet.delete(k);
  }

  async fetch(request) {
    const wanted = request.headers.get('X-Version');
    if (wanted && wanted !== String(VERSION)) {
      if (this.fleet) await this.save();
      if (this.ws) { try { this.ws.close(1012, 'restarting'); } catch {} }
      this.state.abort('newer code deployed');
    }
    const url = new URL(request.url);
    const device = request.headers.get('X-Device');
    if (device && url.pathname !== '/forget') await this.touch(device);
    switch (url.pathname) {
      case '/boats': return this.boats();
      case '/history': return this.history(Number(url.searchParams.get('days')) === 14 ? 14 : 7);
      case '/attempt': return this.attempt(await request.json());
      case '/register': return this.register(await request.json());
      case '/stats': return this.stats();
      case '/hello': return json({ ok: true, version: VERSION });
      case '/alert-test': return json(await this.sendAlert(0, true));
      case '/forget': await this.state.storage.delete(`device:${device}`); return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  }

  // --- Boats -----------------------------------------------------------------------------

  async boats() {
    await this.load();
    this.lastViewer = Date.now();
    if (!this.env.AIS_KEY) this.status = 'nokey';
    else if (!this.ws && Date.now() >= this.retryAt) await this.connect();
    await this.ensureAlarm();
    this.prune();
    return json({ status: this.status, at: Date.now(), boats: [...this.fleet.values()] });
  }

  async connect() {
    this.status = 'connecting';
    this.heard = false;
    let ws;
    try {
      const r = await fetch('https://stream.aisstream.io/v0/stream', { headers: { Upgrade: 'websocket' } });
      ws = r.webSocket;
      if (!ws) throw new Error(`aisstream answered ${r.status}`);
      ws.accept();
    } catch (e) {
      this.status = 'problem';
      this.retryAt = Date.now() + 30e3;
      return;
    }
    this.ws = ws;
    ws.addEventListener('message', e => this.onMessage(e.data));
    ws.addEventListener('close', () => this.onClose(ws));
    ws.addEventListener('error', () => this.onClose(ws));
    ws.send(JSON.stringify({ APIKey: this.env.AIS_KEY, BoundingBoxes: BOXES, FilterMessageTypes: AIS_TYPES }));
  }

  onClose(ws) {
    if (this.ws !== ws) return;
    this.ws = null;
    // aisstream hangs up without a word on a bad key: two hang-ups before any data.
    if (!this.heard && ++this.refused >= 2) { this.status = 'badkey'; this.retryAt = Date.now() + 10 * 60e3; }
    else { this.status = this.heard ? 'reconnecting' : 'connecting'; this.retryAt = Date.now() + 5e3; }
  }

  onMessage(data) {
    const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.error) { this.status = /api key/i.test(msg.error) ? 'badkey' : 'problem'; return; }
    this.heard = true;
    this.refused = 0;
    this.status = 'live';
    applyAIS(msg, this.fleet, this.types);
  }

  async ensureAlarm() {
    if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(Date.now() + 60e3);
  }

  /** Every minute while someone is looking: keep the fleet, reconnect if dropped; else stop. */
  async alarm() {
    await this.load();
    if (Date.now() - this.lastViewer > IDLE) {
      if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(1000, 'idle'); } catch {} }
      this.status = 'off';
      await this.save();
      return;
    }
    if (!this.ws && this.env.AIS_KEY && Date.now() >= this.retryAt) await this.connect();
    await this.save();
    await this.state.storage.setAlarm(Date.now() + 60e3);
  }

  // --- Fishing history (Global Fishing Watch) --------------------------------------------

  async history(days) {
    if (!this.env.GFW_TOKEN) return json({ status: 'nokey', events: [] });
    const cached = await this.state.storage.get(`history${days}`);
    if (cached && Date.now() - cached.at < 6 * 3600e3) return json({ status: 'ready', ...cached });
    const end = new Date(); end.setUTCHours(0, 0, 0, 0); end.setUTCDate(end.getUTCDate() + 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - days);
    const day = d => d.toISOString().slice(0, 10);
    try {
      const events = [];
      for (const r of REGION_DATA) events.push(...await gfwEvents(r, day(start), day(end), this.env.GFW_TOKEN));
      const value = { at: Date.now(), start: day(start), end: day(end), events };
      await this.state.storage.put(`history${days}`, value);
      return json({ status: 'ready', ...value });
    } catch (e) {
      if (cached) return json({ status: 'ready', stale: true, ...cached });
      return json({ status: 'problem', error: String(e.message || e), events: [] });
    }
  }

  // --- Devices and the alert ---------------------------------------------------------------

  /** Wrong passcodes: at most 10 an hour from one address. */
  async attempt({ ip, failed }) {
    const key = `fails:${ip}`;
    const now = Date.now();
    let f = await this.state.storage.get(key);
    if (!f || now - f.since > 3600e3) f = { since: now, count: 0 };
    if (failed) { f.count++; await this.state.storage.put(key, f); }
    return new Response(null, { status: f.count >= 10 ? 429 : 204 });
  }

  async register({ device, label }) {
    const key = `device:${device}`;
    const now = Date.now();
    const known = await this.state.storage.get(key);
    await this.state.storage.put(key, { first: known ? known.first : now, last: now, label: label || (known && known.label) || '' });
    if (!known) {
      const count = (await this.state.storage.list({ prefix: 'device:' })).size;
      if (count > ALERT_AFTER && !(await this.state.storage.get('alerted'))) {
        const sent = await this.sendAlert(count);
        if (sent.ok) await this.state.storage.put('alerted', now);
      }
    }
    return json({ ok: true });
  }

  /** Remembers when each device was last here (at most one write a day per device). */
  async touch(device) {
    const key = `device:${device}`;
    const d = await this.state.storage.get(key);
    if (d && new Date(d.last).toDateString() !== new Date().toDateString()) await this.state.storage.put(key, { ...d, last: Date.now() });
  }

  async stats() {
    const devices = [...(await this.state.storage.list({ prefix: 'device:' })).values()]
      .map(d => ({ first: d.first, last: d.last, label: d.label })).sort((a, b) => a.first - b.first);
    return json({ count: devices.length, alertAfter: ALERT_AFTER, alerted: await this.state.storage.get('alerted') || null,
                  emailReady: !!this.env.RESEND_KEY,
                  keys: { ais: (this.env.AIS_KEY || '').length, gfw: (this.env.GFW_TOKEN || '').length }, devices });
  }

  async sendAlert(count, test = false) {
    if (!this.env.RESEND_KEY || !this.env.ALERT_EMAIL) return { ok: false, error: 'Email isn\'t set up yet.' };
    if (test) count = (await this.state.storage.list({ prefix: 'device:' })).size;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Sea Temp <onboarding@resend.dev>',
        to: [this.env.ALERT_EMAIL],
        subject: test ? 'Sea Temp: test alert' : `Sea Temp: ${count} devices have used the site`,
        text: test
          ? `This is a test of Sea Temp's visitor alert. ${count} devices have unlocked the site so far.`
          : `${count} different devices have now unlocked Sea Temp with the family passcode (the alert is set for more than ${ALERT_AFTER}).\n\nIf that's more than your family and friends, change the passcode: everyone will be asked for the new one. This alert is sent once.`,
      }),
    });
    return r.ok ? { ok: true } : { ok: false, error: `Resend answered ${r.status}: ${(await r.text()).slice(0, 200)}` };
  }
}

/** Folds one aisstream message into the fleet (by MMSI) and the remembered types — the
 *  same reading as the app's AISMessage.apply. */
export function applyAIS(msg, fleet, types, now = Date.now()) {
  const kind = msg.MessageType;
  const m = msg.Message && msg.Message[kind];
  if (!m) return;
  const meta = msg.MetaData || {};
  const mmsi = meta.MMSI || m.UserID;
  if (!(mmsi > 0)) return;
  const clean = s => (typeof s === 'string' && s.replace(/@/g, ' ').trim()) || null;
  const metaName = clean(meta.ShipName);
  switch (kind) {
    case 'PositionReport': case 'StandardClassBPositionReport': case 'ExtendedClassBPositionReport': {
      const lat = m.Latitude, lon = m.Longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return;
      const b = fleet.get(mmsi) || { mmsi };
      b.lat = lat; b.lon = lon; b.seen = now;
      b.sog = typeof m.Sog === 'number' && m.Sog < 102.3 ? m.Sog : null;
      b.cog = typeof m.Cog === 'number' && m.Cog < 360 ? m.Cog : null;
      b.heading = Number.isInteger(m.TrueHeading) && m.TrueHeading < 360 ? m.TrueHeading : null;
      if (kind === 'ExtendedClassBPositionReport' && m.Type > 0) types.set(mmsi, m.Type);
      const name = metaName || clean(m.Name);
      if (name) b.name = name;
      if (types.has(mmsi)) b.type = types.get(mmsi);
      fleet.set(mmsi, b);
      break;
    }
    case 'ShipStaticData': {
      if (m.Type > 0) types.set(mmsi, m.Type);
      const b = fleet.get(mmsi);
      if (b) { if (types.has(mmsi)) b.type = types.get(mmsi); const name = clean(m.Name) || metaName; if (name) b.name = name; }
      break;
    }
    case 'StaticDataReport': {
      if (m.ReportB && m.ReportB.Valid && m.ReportB.ShipType > 0) types.set(mmsi, m.ReportB.ShipType);
      const b = fleet.get(mmsi);
      if (b) {
        if (types.has(mmsi)) b.type = types.get(mmsi);
        const name = m.ReportA && m.ReportA.Valid && clean(m.ReportA.Name);
        if (name) b.name = name;
      }
      break;
    }
  }
}

/** All Global Fishing Watch fishing events in a region's box, page by page, kept small. */
async function gfwEvents(region, startDate, endDate, token) {
  const ring = [[region.west, region.south], [region.east, region.south], [region.east, region.north], [region.west, region.north], [region.west, region.south]];
  const body = JSON.stringify({ datasets: ['public-global-fishing-events:latest'], startDate, endDate, geometry: { type: 'Polygon', coordinates: [ring] } });
  const out = [];
  let offset = 0;
  while (offset < 5000) {
    const r = await fetch(`https://gateway.api.globalfishingwatch.org/v3/events?offset=${offset}&limit=500`, {
      method: 'POST', body, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (r.status === 401 || r.status === 403) throw new Error('Global Fishing Watch didn\'t accept the token.');
    if (!r.ok) throw new Error(`Global Fishing Watch answered ${r.status}`);     // It answers 201 when all is well.
    const page = await r.json();
    const entries = page.entries || [];
    for (const e of entries) {
      if (!e.id || !e.position || typeof e.position.lat !== 'number' || !e.start || !e.end) continue;
      out.push({ id: e.id, lat: e.position.lat, lon: e.position.lon, start: e.start, end: e.end,
                 name: (e.vessel && e.vessel.name) || null, flag: (e.vessel && e.vessel.flag) || null });
    }
    if (!(page.nextOffset > offset) || !entries.length) break;
    offset = page.nextOffset;
  }
  return out;
}
