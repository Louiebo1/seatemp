// The classic fishing-chart colors (purple → blue → green → yellow → red, stretched over
// each map's own range) and the isotherms. Ported from the app's SSTRenderer.
import { fahrenheit } from './grid.js';

export const STOPS = [
  [0.00, 0.30, 0.10, 0.50],   // purple
  [0.17, 0.15, 0.25, 0.85],   // blue
  [0.33, 0.10, 0.62, 0.90],   // cyan
  [0.50, 0.20, 0.75, 0.42],   // green
  [0.67, 0.95, 0.88, 0.20],   // yellow
  [0.83, 0.96, 0.52, 0.12],   // orange
  [1.00, 0.82, 0.10, 0.12],   // red
];
export const LAND = [0.80, 0.77, 0.68];

export function rgb(t) {
  t = Math.min(Math.max(t, 0), 1);
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const a = STOPS[i - 1], b = STOPS[i], f = (t - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
  }
  return STOPS[STOPS.length - 1].slice(1);
}

/** The legend's range: whole degrees around the map's water, at least 4° wide. */
export function scaleFor([lo, hi]) {
  let low = Math.floor(lo), high = Math.ceil(hi);
  if (high - low < 4) { const pad = Math.ceil((4 - (high - low)) / 2); low -= pad; high += pad; }
  return [low, high];
}

/** °F between lines: ½° when the map's water spans 8° or less, else 1°. */
export const intervalFor = ([lo, hi]) => (hi - lo <= 8 ? 0.5 : 1);

/** Most pixels across a map's image: each 1-km cell becomes up to 6×6 pixels, blended
 *  smoothly between readings, so zooming in shows gradients instead of squares. */
const MAX_WIDTH = 2400;
/** Water colors reach this many cells in under MUR's blocky land, so the detailed coastline
 *  drawn on top always meets colored water (harbors, bays, river mouths). */
const BLEED = 6;

/** A map ready to draw: the colored water on a canvas (`upsample` pixels per cell), the
 *  isotherms and the land as Path2D in grid units (cell centers at +0.5), the scale and
 *  line interval. `hidden`: boxes left blank (Baja's Gulf of California); `coast`: land
 *  polygons [lon, lat, …] (coast-data.js). */
export function renderMap(grid, { hidden = [], coast = [] } = {}) {
  const range = grid.fahrenheitRange();
  if (!range) return null;
  const scale = scaleFor(range), span = scale[1] - scale[0];
  const { cols, rows } = grid;
  const f = bleed(Float32Array.from(grid.celsius, c => (Number.isNaN(c) ? NaN : fahrenheit(c))), cols, rows, BLEED);
  for (let r = 0; r < rows; r++) {
    const lat = grid.lat(r);
    for (let c = 0; c < cols; c++) {
      const lon = grid.lon(c);
      if (hidden.some(b => lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east)) f[r * cols + c] = NaN;
    }
  }
  const S = Math.max(2, Math.min(6, Math.floor(MAX_WIDTH / cols)));
  const W = cols * S, H = rows * S;
  const lut = new Uint8ClampedArray(1024 * 3);
  for (let i = 0; i < 1024; i++) { const [r, g, b] = rgb(i / 1023); lut[i * 3] = r * 255; lut[i * 3 + 1] = g * 255; lut[i * 3 + 2] = b * 255; }
  const land = LAND.map(v => Math.round(v * 255));
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H), px = img.data;
  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) / S - 0.5, r0 = Math.max(0, Math.min(rows - 1, Math.floor(gy))), r1 = Math.min(rows - 1, r0 + 1);
    const fy = Math.max(0, Math.min(1, gy - r0));
    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5) / S - 0.5, c0 = Math.max(0, Math.min(cols - 1, Math.floor(gx))), c1 = Math.min(cols - 1, c0 + 1);
      const fx = Math.max(0, Math.min(1, gx - c0));
      // Bilinear between the four readings around this pixel, skipping any that are land.
      let sum = 0, weight = 0;
      const add = (v, w) => { if (!Number.isNaN(v) && w > 0) { sum += v * w; weight += w; } };
      add(f[r0 * cols + c0], (1 - fx) * (1 - fy)); add(f[r0 * cols + c1], fx * (1 - fy));
      add(f[r1 * cols + c0], (1 - fx) * fy); add(f[r1 * cols + c1], fx * fy);
      const o = (y * W + x) * 4;
      if (weight === 0) { px[o] = land[0]; px[o + 1] = land[1]; px[o + 2] = land[2]; }
      else {
        const t = Math.max(0, Math.min(1023, Math.round(((sum / weight) - scale[0]) / span * 1023))) * 3;
        px[o] = lut[t]; px[o + 1] = lut[t + 1]; px[o + 2] = lut[t + 2];
      }
      px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const interval = intervalFor(scale);
  const { minor, major } = traceIsotherms(grid, scale, interval);
  return { grid, canvas, scale, interval, minor: toPath(minor), major: toPath(major), land: landPath(grid, coast) };
}

/** Fills land cells next to water with the average of their water neighbors, `passes`
 *  times (each pass reaches one cell further). */
function bleed(f, cols, rows, passes) {
  for (let p = 0; p < passes; p++) {
    const next = f.slice();
    let changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (!Number.isNaN(f[i])) continue;
        let sum = 0, n = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          const v = f[rr * cols + cc];
          if (!Number.isNaN(v)) { sum += v; n++; }
        }
        if (n) { next[i] = sum / n; changed = true; }
      }
    }
    f = next;
    if (!changed) break;
  }
  return f;
}

/** The land polygons as one Path2D in grid units. */
function landPath(grid, coast) {
  const p = new Path2D();
  for (const ring of coast) {
    for (let k = 0; k < ring.length; k += 2) {
      const x = grid.col(ring[k]) + 0.5, y = grid.row(ring[k + 1]) + 0.5;
      if (k === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.closePath();
  }
  return p;
}

function toPath(segments) {
  const p = new Path2D();
  for (let i = 0; i < segments.length; i += 4) { p.moveTo(segments[i], segments[i + 1]); p.lineTo(segments[i + 2], segments[i + 3]); }
  return p;
}

/** Marching squares over the °F grid, a level every `interval` degrees; heavier every 5°.
 *  Returns flat [x1, y1, x2, y2, …] segment lists. */
export function traceIsotherms(grid, scale, interval = 1) {
  const { cols, rows } = grid;
  const f = Float64Array.from(grid.celsius, c => (Number.isNaN(c) ? NaN : fahrenheit(c)));
  const minor = [], major = [];
  for (let v = scale[0] + interval; v < scale[1] - 1e-9; v += interval) {
    const out = Math.abs(v % 5) < 1e-9 ? major : minor;
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = f[r * cols + c], b = f[r * cols + c + 1], d = f[(r + 1) * cols + c], e = f[(r + 1) * cols + c + 1];
        if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(d) || Number.isNaN(e)) continue;
        // Corners: a top-left, b top-right, e bottom-right, d bottom-left.
        const index = (a >= v ? 8 : 0) | (b >= v ? 4 : 0) | (e >= v ? 2 : 0) | (d >= v ? 1 : 0);
        if (index === 0 || index === 15) continue;
        const x = c + 0.5, y = r + 0.5;
        const top = () => [x + (v - a) / (b - a), y];
        const right = () => [x + 1, y + (v - b) / (e - b)];
        const bottom = () => [x + (v - d) / (e - d), y + 1];
        const left = () => [x, y + (v - a) / (d - a)];
        const line = (p, q) => out.push(p[0], p[1], q[0], q[1]);
        switch (index) {
          case 1: case 14: line(left(), bottom()); break;
          case 2: case 13: line(bottom(), right()); break;
          case 3: case 12: line(left(), right()); break;
          case 4: case 11: line(top(), right()); break;
          case 6: case 9: line(top(), bottom()); break;
          case 7: case 8: line(left(), top()); break;
          case 5: line(left(), top()); line(bottom(), right()); break;
          case 10: line(top(), right()); line(left(), bottom()); break;
        }
      }
    }
  }
  return { minor, major };
}
