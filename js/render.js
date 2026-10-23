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

/** A map ready to draw: the colored grid on a canvas (one pixel per cell), the isotherms
 *  as Path2D in grid units (cell centers at +0.5), the scale and line interval. */
export function renderMap(grid) {
  const range = grid.fahrenheitRange();
  if (!range) return null;
  const scale = scaleFor(range), span = scale[1] - scale[0];
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols; canvas.height = grid.rows;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(grid.cols, grid.rows);
  for (let i = 0; i < grid.celsius.length; i++) {
    const c = grid.celsius[i];
    const [r, g, b] = Number.isNaN(c) ? LAND : rgb((fahrenheit(c) - scale[0]) / span);
    img.data[i * 4] = r * 255; img.data[i * 4 + 1] = g * 255; img.data[i * 4 + 2] = b * 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const interval = intervalFor(scale);
  const { minor, major } = traceIsotherms(grid, scale, interval);
  return { grid, canvas, scale, interval, minor: toPath(minor), major: toPath(major) };
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
