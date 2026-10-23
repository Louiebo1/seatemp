// Talking to the relay (relay/worker.js), which holds the passcode check and the keys.
export const RELAY = 'https://seatemp.louiebo.workers.dev';

const AUTH = 'seatemp.auth', DEVICE = 'seatemp.device';
let memory = {};      // When the browser won't keep anything (private windows), this visit only.

function load(key) { try { return localStorage.getItem(key) ?? memory[key] ?? null; } catch { return memory[key] ?? null; } }
function store(key, value) {
  memory[key] = value;
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* kept in memory */ }
}

// Testing on this Mac only: http://127.0.0.1:8765/#auth=DEVICE.TOKEN signs in as a test device.
if (['127.0.0.1', 'localhost'].includes(location.hostname) && location.hash.startsWith('#auth=')) {
  store(AUTH, decodeURIComponent(location.hash.slice(6)));
  history.replaceState(null, '', location.pathname + location.search);
}

export const isUnlocked = () => !!load(AUTH);

export class Locked extends Error {}

/** A relay call; throws Locked when this device needs the passcode (again). */
export async function call(path) {
  const auth = load(AUTH);
  if (!auth) throw new Locked();
  const r = await fetch(RELAY + path, { headers: { Authorization: `Bearer ${auth}` } });
  if (r.status === 401) { store(AUTH, null); throw new Locked(); }
  if (!r.ok) {
    let message = '';
    try { message = (await r.json()).error; } catch { /* not JSON */ }
    const e = new Error(message || `The relay answered ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r;
}

/** Unlocks this device with the family passcode (remembered for good). */
export async function unlock(passcode) {
  let device = load(DEVICE);
  if (!device) { device = crypto.randomUUID(); store(DEVICE, device); }
  const r = await fetch(RELAY + '/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode, device, label: deviceLabel() }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.token) throw new Error(body.error || `The relay answered ${r.status}`);
  store(AUTH, `${device}.${body.token}`);
}

/** Forgets this device (it'll be asked for the passcode next time). */
export async function forget() {
  try { await call('/forget'); } catch { /* forgetting anyway */ }
  store(AUTH, null);
}

/** "iPhone · Safari": what the visitor count shows for each device, nothing more. */
function deviceLabel() {
  const ua = navigator.userAgent;
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${kind} · ${browser}`;
}
