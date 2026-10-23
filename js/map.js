// The temperature map on a canvas: colored water, a line every whole (or half) °F,
// heavier every 5°, land in sand, places labeled, fishing spots, boats and the blue dot.
// Pinch or scroll to zoom, drag to move, double-tap to fit, tap the water for its
// temperature or a boat for who it is. Same look as the app's MapView.
import { partyOf } from './party.js';

const STALE = 15 * 60e3;      // Boats not heard from in this long are drawn faded.
const PINK = 'rgb(242, 51, 191)';

export class MapView {
  constructor(canvas, { onPick }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onPick = onPick;
    this.map = null;          // from renderMap()
    this.region = null;
    this.boats = [];
    this.events = [];
    this.location = null;     // { lat, lon }
    this.picked = null;       // { kind: 'water'|'boat'|'event', lat, lon, id }
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.pointers = new Map();
    this.gesture = null;
    this.lastTap = 0;
    this.listen();
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  show(map, region) {
    const changed = !this.region || region.id !== this.region.id;
    this.map = map;
    this.region = region;
    if (changed) { this.zoom = 1; this.pan = { x: 0, y: 0 }; }
    this.draw();
  }

  set(values) { Object.assign(this, values); this.draw(); }

  // --- Geometry ----------------------------------------------------------------------------

  /** The map at its natural shape, as big as fits; then zoom and pan. */
  layout() {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const g = this.map.grid;
    const midLat = g.lat((g.rows - 1) / 2) * Math.PI / 180;
    const aspect = g.cols * Math.cos(midLat) / g.rows;
    const fit = W / H > aspect ? { w: H * aspect, h: H } : { w: W, h: W / aspect };
    const w = fit.w * this.zoom, h = fit.h * this.zoom;
    const x0 = W / 2 + this.pan.x - w / 2, y0 = H / 2 + this.pan.y - h / 2;
    return { W, H, fit, w, h, x0, y0, sx: w / g.cols, sy: h / g.rows };
  }

  toScreen(L, lat, lon) {
    const g = this.map.grid;
    return { x: L.x0 + (g.col(lon) + 0.5) * L.sx, y: L.y0 + (g.row(lat) + 0.5) * L.sy };
  }

  toLatLon(L, x, y) {
    const g = this.map.grid;
    return { lat: g.lat((y - L.y0) / L.sy - 0.5), lon: g.lon((x - L.x0) / L.sx - 0.5) };
  }

  clampPan() {
    if (!this.map) return;
    const L = this.layout();
    const maxX = Math.max(0, (L.fit.w * this.zoom - L.W) / 2), maxY = Math.max(0, (L.fit.h * this.zoom - L.H) / 2);
    this.pan.x = Math.min(Math.max(this.pan.x, -maxX), maxX);
    this.pan.y = Math.min(Math.max(this.pan.y, -maxY), maxY);
    if (this.zoom === 1) this.pan = { x: 0, y: 0 };
  }

  // --- Drawing -----------------------------------------------------------------------------

  draw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.paint(); });
  }

  paint() {
    const { canvas, ctx } = this;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, W, H);
    if (!this.map) return;
    const L = this.layout();

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(this.map.canvas, L.x0, L.y0, L.w, L.h);

    // Isotherms, in grid units.
    ctx.save();
    ctx.translate(L.x0, L.y0);
    ctx.scale(L.sx, L.sy);
    const unit = 1 / Math.sqrt(L.sx * L.sy);
    ctx.lineWidth = 0.7 * unit;
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.stroke(this.map.minor);
    ctx.lineWidth = 1.3 * unit;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke(this.map.major);
    ctx.restore();

    const on = (lat, lon) => this.region.covers(lat, lon);
    for (const p of this.region.places) this.place(this.toScreen(L, p.lat, p.lon), p);
    for (const e of this.events) if (on(e.lat, e.lon)) this.spot(this.toScreen(L, e.lat, e.lon), this.picked && this.picked.kind === 'event' && this.picked.id === e.id);
    for (const b of this.boats) if (on(b.lat, b.lon)) this.boat(this.toScreen(L, b.lat, b.lon), b, this.picked && this.picked.kind === 'boat' && this.picked.id === b.mmsi);
    if (this.location && on(this.location.lat, this.location.lon)) {
      const { x, y } = this.toScreen(L, this.location.lat, this.location.lon);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 3;
      circle(ctx, x, y, 7, '#0a7aff');
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
    if (this.picked && this.picked.kind === 'water') this.scope(this.toScreen(L, this.picked.lat, this.picked.lon));
  }

  place({ x, y }, p) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    if (p.kind === 'bank') {
      ctx.fillRect(x - 4, y - 1, 8, 2); ctx.fillRect(x - 1, y - 4, 2, 8);
    } else {
      circle(ctx, x, y, 2.5, 'rgba(0,0,0,0.85)');
    }
    const italic = p.kind !== 'town' ? 'italic ' : '';
    ctx.font = `${italic}${p.kind === 'island' ? 600 : 700} 10px -apple-system, system-ui, sans-serif`;
    const w = ctx.measureText(p.name).width;
    // Where the name goes, like the app: just past the dot's 9-point frame.
    let tx, ty;
    ctx.textBaseline = 'middle';
    switch (p.side) {
      case 'above': tx = x - w / 2; ty = y - 12; break;
      case 'left': tx = x - 6.5 - w; ty = y; break;
      case 'right': tx = x + 6.5; ty = y; break;
      default: tx = x - w / 2; ty = y + 12;
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.strokeText(p.name, tx, ty);
    ctx.fillText(p.name, tx, ty);
    ctx.restore();
  }

  /** Where a vessel fished lately (Global Fishing Watch): a small pink diamond. */
  spot({ x, y }, picked) {
    const { ctx } = this;
    const r = picked ? 6.5 : 4.5;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
    ctx.fillStyle = PINK; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = picked ? 2 : 0.8; ctx.strokeStyle = picked ? '#ffd60a' : '#fff'; ctx.stroke();
    ctx.restore();
  }

  /** A boat: an arrow on a dark disc pointing the way it's going (a dot when stopped);
   *  yellow with its name for a party boat, orange for a fishing boat, white for others;
   *  faded when it hasn't been heard from lately. */
  boat({ x, y }, b, picked) {
    const { ctx } = this;
    const party = partyOf(b);
    const color = party.length ? '#ffd60a' : b.type === 30 ? '#ff9f0a' : '#fff';
    const s = picked ? 1.3 : 1;
    ctx.save();
    ctx.globalAlpha = Date.now() - b.seen > STALE ? 0.45 : 1;
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3;
    circle(ctx, 0, 0, 9.5, 'rgba(13,26,51,0.85)');
    ctx.shadowBlur = 0;
    ctx.lineWidth = picked ? 2.5 : 1; ctx.strokeStyle = picked ? '#ffd60a' : 'rgba(255,255,255,0.9)'; ctx.stroke();
    const dir = direction(b);
    if (dir == null) {
      circle(ctx, 0, 0, 3.5, color);
    } else {
      ctx.save();
      ctx.rotate(dir * Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4.5, 5); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.restore();
    }
    if (party.length) {
      ctx.font = '800 9px -apple-system, system-ui, sans-serif';
      const name = party[0].name, w = ctx.measureText(name).width + 6;
      ctx.fillStyle = 'rgba(255,214,10,0.9)';
      roundRect(ctx, -w / 2, 12, w, 12, 3); ctx.fill();
      ctx.fillStyle = '#000'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(name, 0, 18.5);
    }
    ctx.restore();
  }

  scope({ x, y }) {
    const { ctx } = this;
    ctx.save();
    ctx.shadowColor = '#000'; ctx.shadowBlur = 2;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      ctx.beginPath(); ctx.moveTo(x + dx * 4, y + dy * 4); ctx.lineTo(x + dx * 12, y + dy * 12); ctx.stroke();
    }
    ctx.restore();
  }

  // --- Touch, mouse ------------------------------------------------------------------------

  listen() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.gesture = { start: this.snapshot(), zoom: this.zoom, pan: { ...this.pan }, moved: 0, t: Date.now(), multi: this.pointers.size > 1 };
    });
    c.addEventListener('pointermove', e => {
      if (!this.pointers.has(e.pointerId) || !this.gesture || !this.map) return;
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      const now = this.snapshot(), g = this.gesture;
      g.moved = Math.max(g.moved, Math.hypot(now.cx - g.start.cx, now.cy - g.start.cy), Math.abs(now.d - g.start.d));
      if (g.moved < 8 && !g.multi) return;
      if (this.pointers.size > 1) g.multi = true;
      if (this.pointers.size !== g.start.n) { this.gesture = { ...g, start: now, zoom: this.zoom, pan: { ...this.pan } }; return; }
      // Zoom about the fingers' midpoint, and follow it.
      const zoom = Math.min(Math.max(g.zoom * (g.start.d > 0 ? now.d / g.start.d : 1), 1), 12);
      const W = c.clientWidth, H = c.clientHeight;
      const k = zoom / g.zoom;
      this.zoom = zoom;
      this.pan.x = now.cx - W / 2 - (g.start.cx - W / 2 - g.pan.x) * k;
      this.pan.y = now.cy - H / 2 - (g.start.cy - H / 2 - g.pan.y) * k;
      this.draw();
    });
    const end = e => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const g = this.gesture;
      if (this.pointers.size === 0) {
        this.gesture = null;
        this.clampPan();
        this.draw();
        if (g && g.moved < 8 && !g.multi && Date.now() - g.t < 500 && e.type === 'pointerup') this.tap(e.offsetX, e.offsetY);
      } else {
        this.gesture = { ...g, start: this.snapshot(), zoom: this.zoom, pan: { ...this.pan } };
      }
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', e => {
      if (!this.map) return;
      e.preventDefault();
      const zoom = Math.min(Math.max(this.zoom * Math.exp(-e.deltaY * 0.002), 1), 12);
      const W = c.clientWidth, H = c.clientHeight, k = zoom / this.zoom;
      this.pan.x = e.offsetX - W / 2 - (e.offsetX - W / 2 - this.pan.x) * k;
      this.pan.y = e.offsetY - H / 2 - (e.offsetY - H / 2 - this.pan.y) * k;
      this.zoom = zoom;
      this.clampPan();
      this.draw();
    }, { passive: false });
  }

  snapshot() {
    const pts = [...this.pointers.values()];
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const d = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    return { cx, cy, d, n: pts.length };
  }

  tap(x, y) {
    if (!this.map) return;
    // A double tap fits the map again.
    if (Date.now() - this.lastTap < 300) { this.lastTap = 0; this.zoom = 1; this.pan = { x: 0, y: 0 }; this.draw(); return; }
    this.lastTap = Date.now();
    const L = this.layout();
    if (x < L.x0 || y < L.y0 || x > L.x0 + L.w || y > L.y0 + L.h) { this.onPick(null); return; }
    const on = (lat, lon) => this.region.covers(lat, lon);
    const nearest = (items, r) => {
      let best = null, bd = r;
      for (const it of items) {
        if (!on(it.lat, it.lon)) continue;
        const p = this.toScreen(L, it.lat, it.lon), d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { best = it; bd = d; }
      }
      return best;
    };
    // A boat within a finger's width wins over the water under it; then a fishing spot.
    const boat = nearest(this.boats, 22);
    if (boat) return this.onPick({ kind: 'boat', id: boat.mmsi, lat: boat.lat, lon: boat.lon });
    const event = nearest(this.events, 14);
    if (event) return this.onPick({ kind: 'event', id: event.id, lat: event.lat, lon: event.lon });
    const { lat, lon } = this.toLatLon(L, x, y);
    this.onPick({ kind: 'water', lat, lon });
  }
}

/** Which way to point the arrow: the heading if it's sent, else the course when moving. */
export function direction(b) {
  if (b.heading != null && b.heading >= 0 && b.heading < 360) return b.heading;
  if (b.cog != null && b.cog < 360 && (b.sog || 0) > 0.5) return b.cog;
  return null;
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
