// The four maps, north to south, and where a spot is.
import { REGION_DATA } from './regions-data.js';

const inBox = (b, lat, lon) => lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east;

export const REGIONS = REGION_DATA.map(r => ({
  ...r,
  /** Whether a spot is on this map (not in a hidden box such as Baja's Gulf of California). */
  covers(lat, lon) { return inBox(r, lat, lon) && !r.hidden.some(h => inBox(h, lat, lon)); },
}));

export const regionById = id => REGIONS.find(r => r.id === id);

/** The map a spot is on (where SoCal and Baja overlap, SoCal). */
export const regionContaining = (lat, lon) => REGIONS.find(r => r.covers(lat, lon));

/** "8 nm SW of San Clemente Is." — from the nearest labeled place on any map. */
export function describe(lat, lon) {
  let best = null, bestD = Infinity, bx = 0, by = 0;
  for (const r of REGIONS) for (const p of r.places) {
    const dx = (lon - p.lon) * 60 * Math.cos(lat * Math.PI / 180), dy = (lat - p.lat) * 60;
    const d = Math.hypot(dx, dy);
    if (d < bestD) { best = p; bestD = d; bx = dx; by = dy; }
  }
  if (!best || bestD > 60) return null;
  if (bestD < 1.5) return `at ${best.name}`;
  const bearing = (Math.atan2(bx, by) * 180 / Math.PI + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return `${Math.round(bestD)} nm ${points[Math.floor((bearing + 22.5) / 45) % 8]} of ${best.name}`;
}

/** 33°25.2'N 118°30.6'W, the way a chart plotter shows it. */
export function position(lat, lon) {
  const dm = (v, pos, neg) => {
    const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
    return `${d}°${m.toFixed(1).padStart(4, '0')}'${v >= 0 ? pos : neg}`;
  };
  return `${dm(lat, 'N', 'S')} ${dm(lon, 'E', 'W')}`;
}
