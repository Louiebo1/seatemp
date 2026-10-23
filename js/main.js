// Sea Temp on the web: the app's four maps, live boats, the party boat list and Global
// Fishing Watch's fishing spots, all through the relay (it holds the keys and the
// passcode check). Settings kept per browser: seatemp.region, .mode, .span.
import { REGIONS, regionById, regionContaining, describe, position } from './regions.js';
import { parseESRIAscii, parseLandMask } from './grid.js';
import { renderMap, STOPS } from './render.js';
import { MapView } from './map.js';
import { PARTY_BOATS, partyOf } from './party.js';
import { call, unlock, forget, isUnlocked, Locked } from './api.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pref = (key, fallback) => { try { return localStorage.getItem('seatemp.' + key) ?? fallback; } catch { return fallback; } };
const setPref = (key, value) => { try { localStorage.setItem('seatemp.' + key, value); } catch { /* this visit only */ } };

const ICON = {
  boat: document.querySelector('#boatbar .pick svg').outerHTML.replace('<svg', '<svg class="icon"'),
  diamond: document.querySelector('#boatbar .pinkicon svg').outerHTML.replace('<svg', '<svg class="icon small-icon"'),
};

const state = {
  region: regionById(pref('region', 'socal')) || regionById('socal'),
  latest: null,          // 'YYYY-MM-DD', NOAA's newest
  day: null,             // the day on screen
  map: null,
  loading: false,
  problem: null,
  mode: pref('mode', 'party'),
  span: Number(pref('span', '7')),
  fleet: [],             // every boat the relay has (mode filters what's drawn)
  boatStatus: 'connecting',
  history: { status: 'loading', events: [] },
  picked: null,
};

const view = new MapView($('map'), { onPick: p => { state.picked = p; drawPicked(); renderReadout(); } });
const masks = new Map();       // region id → land mask
const maps = new Map();        // `${region}/${day}` → rendered map (the last few)
let request = 0;

// --- Start ---------------------------------------------------------------------------

function start() {
  if (!isUnlocked()) return showLock();
  $('lock').hidden = true;
  $('app').hidden = false;
  buildRegions();
  $('mode').value = state.mode;
  $('span').value = String(state.span);
  showChoices();
  show(null);
  pollBoats();
  loadHistory();
  call('/hello').catch(handle);
  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(p => view.set({ location: { lat: p.coords.latitude, lon: p.coords.longitude } }), () => {}, { maximumAge: 60e3 });
  }
}

function handle(error) {
  if (error instanceof Locked) { showLock(); return true; }
  return false;
}

function showLock() {
  $('app').hidden = true;
  $('lock').hidden = false;
  setTimeout(() => $('passcode').focus(), 50);
}

$('lockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const button = $('lockForm').querySelector('button');
  button.disabled = true;
  $('lockError').hidden = true;
  try {
    await unlock($('passcode').value);
    $('passcode').value = '';
    start();
  } catch (error) {
    $('lockError').textContent = error.message === 'Failed to fetch' ? 'Couldn’t reach Sea Temp. Check the connection.' : error.message;
    $('lockError').hidden = false;
  } finally {
    button.disabled = false;
  }
});

// --- Maps --------------------------------------------------------------------------

function buildRegions() {
  $('regions').innerHTML = REGIONS.map(r => `<button data-region="${r.id}">${esc(r.shortName)}</button>`).join('');
  $('regions').onclick = e => {
    const id = e.target.dataset && e.target.dataset.region;
    if (!id || id === state.region.id) return;
    state.region = regionById(id);
    setPref('region', id);
    if (!state.picked || state.picked.kind !== 'boat') state.picked = null;
    show(null);
  };
  markRegion();
}

function markRegion() {
  for (const b of $('regions').children) b.classList.toggle('on', b.dataset.region === state.region.id);
}

/** Shows a day (null: the newest). */
async function show(day) {
  const ticket = ++request;
  const region = state.region;
  markRegion();
  state.problem = null;
  state.loading = true;
  renderChrome();
  try {
    if (!day || !state.latest) {
      state.latest = (await (await call('/sst/latest')).json()).day;
      if (ticket !== request) return;
    }
    day = day || state.latest;
    const key = `${region.id}/${day}`;
    let map = maps.get(key);
    if (!map) {
      if (!state.map || state.map.region !== region.id) { state.map = null; view.show(null, region); }
      const [grid, land] = await Promise.all([
        call(`/sst/grid?region=${region.id}&day=${day}`).then(r => r.text()),
        masks.get(region.id) || call(`/sst/mask?region=${region.id}`).then(r => r.text()).then(parseLandMask),
      ]);
      masks.set(region.id, land);
      if (ticket !== request) return;
      const rendered = renderMap(parseESRIAscii(grid).masked(land).hiding(region.hidden));
      if (!rendered) throw new Error('That map came back empty.');
      map = { ...rendered, region: region.id, day };
      maps.set(key, map);
      if (maps.size > 6) maps.delete(maps.keys().next().value);
    }
    if (ticket !== request) return;
    state.map = map;
    state.day = day;
    view.show(map, region);
    drawLayers();
  } catch (error) {
    if (ticket !== request || handle(error)) return;
    state.problem = error.status === 404 ? 'NOAA doesn’t have that day yet.' : `Couldn’t get the map: ${error.message === 'Failed to fetch' ? 'no connection' : error.message}`;
  } finally {
    if (ticket === request) { state.loading = false; renderChrome(); renderReadout(); }
  }
}

function addDays(day, n) {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

$('prev').onclick = () => { if (state.day) { state.picked = null; show(addDays(state.day, -1)); } };
$('next').onclick = () => { if (state.day && state.day < state.latest) { state.picked = null; show(addDays(state.day, 1)); } };
$('newest').onclick = () => { state.latest = null; show(null); };

function renderChrome() {
  const fmt = day => new Date(day + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('day').textContent = state.day ? fmt(state.day) : '—';
  const latest = state.day && state.day === state.latest;
  $('dayNote').textContent = latest ? 'Newest map' : state.day ? 'Older map' : ' ';
  $('dayNote').className = 'note ' + (latest ? 'green' : 'orange');
  $('prev').disabled = !state.day;
  $('next').disabled = !state.day || latest;
  $('spinner').hidden = !state.loading;
  const msg = $('mapMessage');
  if (state.problem) { msg.textContent = state.problem; msg.className = 'message problem'; msg.hidden = false; }
  else if (state.loading && !state.map) { msg.textContent = 'Getting the temperatures…'; msg.className = 'message'; msg.hidden = false; }
  else msg.hidden = true;
  renderLegend();
}

function renderLegend() {
  const map = state.map;
  $('legend').hidden = !map;
  $('credit').textContent = `MUR sea surface temperature (NASA JPL, about 1 km, daily) via NOAA CoastWatch. Pinch or scroll to zoom · double-tap to fit · lines every ${map && map.interval === 0.5 ? '½' : '1'}°F, heavier every 5°.`;
  if (!map) return;
  $('legend').querySelector('.ramp').style.background =
    `linear-gradient(to right, ${STOPS.map(([t, r, g, b]) => `rgb(${r * 255},${g * 255},${b * 255}) ${t * 100}%`).join(', ')})`;
  const [lo, hi] = map.scale, span = hi - lo, step = span > 14 ? 4 : span > 7 ? 2 : 1;
  const ticks = [];
  for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(`<span style="left:${(t - lo) / span * 100}%">${t}°</span>`);
  $('legend').querySelector('.ticks').innerHTML = ticks.join('');
}

/** The menus show their current choice (the <select>s themselves are invisible). */
function showChoices() {
  for (const id of ['mode', 'span']) {
    const select = $(id);
    select.parentElement.querySelector('.shown').textContent = select.options[select.selectedIndex].text;
  }
}

// --- Boats ----------------------------------------------------------------------------

let boatTimer = null, boatPolls = 0;

/** Asks the relay for the fleet: every 10 s for the first minute (the feed is filling), then
 *  every 30 s, while the page is in front and boats are on. */
async function pollBoats() {
  clearTimeout(boatTimer);
  if (state.mode === 'off' || document.hidden) { renderFeeds(); return; }
  try {
    const data = await (await call('/boats')).json();
    state.fleet = data.boats;
    state.boatStatus = data.status;
  } catch (error) {
    if (handle(error)) return;
    state.boatStatus = 'unreachable';
  }
  drawLayers();
  renderFeeds();
  renderReadout();
  if (!$('list').hidden) renderList();
  boatPolls++;
  boatTimer = setTimeout(pollBoats, boatPolls < 6 ? 10e3 : 30e3);
}

document.addEventListener('visibilitychange', () => { if (!document.hidden && isUnlocked()) { boatPolls = 0; pollBoats(); loadHistory(); } });

function shownBoats() {
  switch (state.mode) {
    case 'party': return state.fleet.filter(b => partyOf(b).length);
    case 'fishing': return state.fleet.filter(b => b.type === 30 || partyOf(b).length);
    case 'all': return state.fleet;
    default: return [];
  }
}

$('mode').onchange = () => {
  state.mode = $('mode').value;
  setPref('mode', state.mode);
  showChoices();
  boatPolls = 0;
  pollBoats();
  drawLayers();
};

// --- Fishing history -----------------------------------------------------------------

async function loadHistory() {
  if (!state.span) { state.history = { status: 'off', events: [] }; drawLayers(); renderFeeds(); return; }
  const span = state.span;
  if (state.history.events.length === 0) state.history = { status: 'loading', events: [] };
  renderFeeds();
  try {
    const data = await (await call(`/history?days=${span}`)).json();
    if (span !== state.span) return;
    state.history = data;
  } catch (error) {
    if (handle(error)) return;
    state.history = { status: 'problem', error: error.message, events: [] };
  }
  drawLayers();
  renderFeeds();
}

$('span').onchange = () => {
  state.span = Number($('span').value);
  setPref('span', state.span);
  showChoices();
  state.history = { status: 'loading', events: [] };
  loadHistory();
};

// --- The map's layers, the status line, the readout -----------------------------------

function drawLayers() {
  view.set({ boats: shownBoats(), events: state.span ? state.history.events || [] : [] });
  drawPicked();
}

function drawPicked() { view.set({ picked: state.picked }); }

function renderFeeds() {
  const parts = [];
  const boats = {
    nokey: '<span class="orange">Live boats aren’t set up yet</span>',
    badkey: '<span class="orange">aisstream.io didn’t accept the key</span>',
    connecting: 'Live boats: connecting…',
    reconnecting: 'Live boats: reconnecting…',
    off: 'Live boats: connecting…',
    problem: '<span class="orange">Boat feed trouble — retrying</span>',
    unreachable: '<span class="orange">Can’t reach Sea Temp — retrying</span>',
  };
  if (state.mode === 'off') parts.push('Live boats off');
  else if (state.boatStatus === 'live' || (state.fleet.length && boats[state.boatStatus] && state.boatStatus !== 'nokey' && state.boatStatus !== 'badkey')) parts.push(`${shownBoats().length} boats live`);
  else parts.push(boats[state.boatStatus] || 'Live boats: connecting…');
  if (state.span) {
    const h = state.history;
    if (h.status === 'nokey') parts.push('<span class="orange">Fishing history isn’t set up yet</span>');
    else if (h.status === 'loading') parts.push('History: loading…');
    else if (h.status === 'problem') parts.push(`<span class="orange">${esc(h.error || 'History unavailable')}</span>`);
    else parts.push(`<span class="pink">${h.events.length} fishing spots, ${state.span} days</span>`);
  }
  $('feeds').innerHTML = parts.join(' · ');
}

function renderReadout() {
  const p = state.picked, el = $('readout');
  if (p && p.kind === 'boat') {
    const b = state.fleet.find(x => x.mmsi === p.id);
    if (b) { el.innerHTML = boatReadout(b); return; }
  }
  if (p && p.kind === 'event') {
    const e = (state.history.events || []).find(x => x.id === p.id);
    if (e) { el.innerHTML = eventReadout(e); return; }
  }
  if (p && p.kind === 'water' && state.map) {
    const f = state.map.grid.fahrenheitAt(p.lat, p.lon);
    el.innerHTML = f == null ? '<span class="muted">That’s land — tap the water.</span>'
      : `<b class="temp">${f.toFixed(1)}°F</b> <span class="muted mono">${position(p.lat, p.lon)}</span>`;
    return;
  }
  el.innerHTML = '<span class="muted">Tap the water for its temperature.</span>';
}

function boatReadout(b) {
  const party = partyOf(b);
  const temp = state.map && state.map.grid.fahrenheitAt(b.lat, b.lon);
  const ago = Math.floor((Date.now() - b.seen) / 60e3);
  const details = [party.length ? party.map(p => p.landing).join(' or ') : typeName(b.type)];
  if (b.sog != null) details.push(`${b.sog.toFixed(1)} kn`);
  if (b.cog != null && (b.sog || 0) > 0.5) details.push(`${String(Math.round(b.cog)).padStart(3, '0')}°`);
  details.push(ago < 1 ? 'just now' : `${ago} min ago`);
  const color = party.length ? 'yellow' : b.type === 30 ? 'orange' : 'muted';
  return `<div><span class="${color}">${ICON.boat}</span> <b>${esc(party.length ? party[0].name : b.name || `MMSI ${b.mmsi}`)}</b>${temp != null ? ` <b class="mono">${temp.toFixed(1)}°F</b>` : ''}</div>
          <div class="small muted">${esc(details.join(' · '))}</div>`;
}

function eventReadout(e) {
  const start = new Date(e.start), hours = (new Date(e.end) - start) / 3600e3;
  const when = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `<div><span class="pink">${ICON.diamond}</span> <b>${esc(e.name || 'A fishing vessel')}</b>${e.flag ? ` <span class="small muted">${esc(e.flag)}</span>` : ''}</div>
          <div class="small muted">Fished here ${when} · ${hours < 1 ? 'under an hour' : `${Math.round(hours)} h`} · ${esc(describe(e.lat, e.lon) || '')}</div>`;
}

function typeName(t) {
  if (t == null) return 'Type not sent yet';
  if (t === 30) return 'Fishing';
  if (t === 31 || t === 32) return 'Towing';
  if (t === 35) return 'Military';
  if (t === 36) return 'Sailing';
  if (t === 37) return 'Pleasure craft';
  if (t === 50) return 'Pilot';
  if (t === 51) return 'Search and rescue';
  if (t === 52) return 'Tug';
  if (t === 55) return 'Law enforcement';
  if (t >= 60 && t <= 69) return 'Passenger';
  if (t >= 70 && t <= 79) return 'Cargo';
  if (t >= 80 && t <= 89) return 'Tanker';
  return 'Other';
}

// --- The Boat List --------------------------------------------------------------------

$('listButton').onclick = () => { $('search').value = ''; renderList(); $('list').hidden = false; };
$('search').oninput = renderList;

function renderList() {
  const heardBy = new Map();
  for (const b of state.fleet) for (const p of partyOf(b)) if (!heardBy.has(p) || heardBy.get(p).seen < b.seen) heardBy.set(p, b);
  const q = $('search').value.trim().toLowerCase();
  const rows = PARTY_BOATS.filter(p => !q || [p.name, p.landing, p.city].some(s => s.toLowerCase().includes(q)));
  const heard = rows.filter(p => heardBy.has(p)).sort((a, b) => heardBy.get(b).seen - heardBy.get(a).seen);
  const quiet = rows.filter(p => !heardBy.has(p)).sort((a, b) => a.name.localeCompare(b.name));
  const note = state.boatStatus === 'nokey' ? '<p class="orange">Live boats aren’t set up yet.</p>' : '';
  $('listBody').innerHTML = `${note}
    <h3>Heard today · ${heard.length}</h3>
    ${heard.length ? '' : '<p class="muted">None yet. Boats send their position every few seconds to minutes; give it a minute.</p>'}
    ${heard.map(p => heardRow(p, heardBy.get(p))).join('')}
    <h3>Not heard today · ${quiet.length}</h3>
    ${quiet.map(p => `<div class="row quiet"><b>${esc(p.name)}</b><div class="small">${esc(p.landing)} · ${esc(p.city)}</div></div>`).join('')}
    <p class="small muted">At the dock with the AIS off, out of a shore receiver’s range, or not carrying AIS. Boat list: every boat that posted fish counts from a Southern California landing in the past year (SanDiegoFishReports.com, SoCalFishReports.com), plus San Diego’s long-range fleet. Matched to AIS by name.</p>`;
}

function heardRow(p, b) {
  const ago = Math.floor((Date.now() - b.seen) / 60e3);
  const agoText = ago < 1 ? 'just now' : ago < 60 ? `${ago} min ago` : `${Math.floor(ago / 60)} h ${ago % 60} min ago`;
  const line = [describe(b.lat, b.lon) || position(b.lat, b.lon)];
  if (b.sog != null) line.push(b.sog < 0.5 ? 'stopped' : `${b.sog.toFixed(1)} kn`);
  const region = regionContaining(b.lat, b.lon);
  const temp = state.map && state.map.region === (region && region.id) ? state.map.grid.fahrenheitAt(b.lat, b.lon) : null;
  if (temp != null) line.push(`${temp.toFixed(1)}°F`);
  return `<button class="row" data-mmsi="${b.mmsi}">
      <div><b>${esc(p.name)}</b> <span class="small ${ago < 15 ? 'green' : 'orange'}"><b>${agoText}</b></span></div>
      <div>${esc(line.join(' · '))}</div>
      <div class="small muted">${esc(p.landing)} · ${esc(p.city)}</div>
    </button>`;
}

$('listBody').onclick = e => {
  const row = e.target.closest('[data-mmsi]');
  if (!row) return;
  const b = state.fleet.find(x => x.mmsi === Number(row.dataset.mmsi));
  if (!b) return;
  $('list').hidden = true;
  // Show it: its map, picked.
  if (state.mode === 'off') { state.mode = 'party'; $('mode').value = 'party'; setPref('mode', 'party'); showChoices(); pollBoats(); }
  state.picked = { kind: 'boat', id: b.mmsi, lat: b.lat, lon: b.lon };
  const region = regionContaining(b.lat, b.lon);
  if (region && region.id !== state.region.id) { state.region = region; setPref('region', region.id); show(null); }
  drawLayers();
  renderReadout();
};

// --- About, the visitor count ------------------------------------------------------------

$('infoButton').onclick = async () => {
  $('info').hidden = false;
  $('infoBody').innerHTML = aboutText('<p class="muted">Counting devices…</p>');
  try {
    const s = await (await call('/stats')).json();
    const when = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    $('infoBody').innerHTML = aboutText(`
      <h3>Devices using Sea Temp · ${s.count}</h3>
      <p class="small muted">Each phone or computer that has entered the passcode. ${s.alerted ? 'The alert email was sent.' : `An email goes to Louie once more than ${s.alertAfter} have.`}</p>
      ${s.devices.map((d, i) => `<div class="row quiet"><b>${i + 1}. ${esc(d.label || 'Device')}</b><div class="small">First ${when(d.first)} · last ${when(d.last)}</div></div>`).join('')}`);
  } catch (error) {
    if (!handle(error)) $('infoBody').innerHTML = aboutText(`<p class="orange">${esc(error.message)}</p>`);
  }
};

function aboutText(devices) {
  return `<p>Sea surface temperature for Monterey Bay, Morro Bay, Southern California and Baja, from NASA JPL’s MUR analysis (satellites blended, about 1 km, daily — about a day behind) via NOAA CoastWatch.</p>
    <p><b>Boats</b>: live AIS positions from aisstream.io’s shore receivers. Yellow with a name = a Southern California party boat; orange = a fishing boat; white = others; faded = not heard in 15 minutes.</p>
    <p><b class="pink">${ICON.diamond} Fishing history</b>: where vessels fished in the last 7 or 14 days, from Global Fishing Watch (satellite AIS too, so offshore; about 4 days behind; mostly commercial boats).</p>
    ${devices}
    <p><button id="forget" class="link danger">Forget this device</button> <span class="small muted">— it will ask for the passcode again.</span></p>`;
}

$('infoBody').onclick = async e => {
  if (e.target.id !== 'forget') return;
  await forget();
  $('info').hidden = true;
  showLock();
};

for (const b of document.querySelectorAll('[data-close]')) b.onclick = () => { b.closest('.sheet').hidden = true; };
for (const s of document.querySelectorAll('.sheet')) s.addEventListener('click', e => { if (e.target === s && s.id !== 'lock') s.hidden = true; });

renderReadout();
start();

// Testing on this Mac only: the page's insides, for scripted checks.
if (['127.0.0.1', 'localhost'].includes(location.hostname)) window.__seatemp = { state, view, show, renderList, renderReadout, drawLayers, renderFeeds };
