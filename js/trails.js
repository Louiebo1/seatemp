// Party boats' tracks (the relay keeps 72 hours of each): points [seconds, lat, lon, knots],
// a point a minute at most, one every 10 minutes while a boat sits still. Each stretch is
// colored by speed, like the fleet trackers do: slow is where a boat was fishing.
import { nearHome, nm } from './party.js';

/** Up to this speed (knots) a boat is fishing: drifting, anchored or slow-trolling a spot. */
export const FISHING_KN = 4;
/** Up to this speed it's trolling or moving slowly between spots; faster, it's running. */
export const TROLLING_KN = 10;
/** A silence longer than this (seconds) breaks the line; up to MAX_GAP it's drawn dotted. */
export const GAP = 30 * 60, MAX_GAP = 6 * 3600;

/** The speed for the stretch from points[i-1] to points[i]: the reported speed at its end,
 *  or (when none was sent) the distance over the time. */
export function stretchKnots(a, b) {
  if (b[3] != null) return b[3];
  const hours = (b[0] - a[0]) / 3600;
  return hours > 0 ? nm(a[1], a[2], b[1], b[2]) / hours : 0;
}

export const kindOf = kn => (kn <= FISHING_KN ? 'fishing' : kn <= TROLLING_KN ? 'trolling' : 'running');

/** True for a point at the boat's own dock: barely moving inside its home harbor. Those
 *  aren't drawn (or counted as fishing). */
export const atDock = (p, parties, kn) => kn < 1 && nearHome({ lat: p[1], lon: p[2] }, parties, DOCK_NM);
/** "In the harbor": this close to its home harbor point. */
const DOCK_NM = 1.6;

/** Merges newer points (from /trails?since=) into `trails` (mmsi → points), dropping any
 *  older than 72 hours. */
export function mergeTrails(trails, fresh, now = Date.now()) {
  const oldest = now / 1000 - 72 * 3600;
  for (const [key, points] of Object.entries(fresh || {})) {
    const mmsi = Number(key);
    const have = trails.get(mmsi) || [];
    const last = have.length ? have[have.length - 1][0] : -Infinity;
    for (const p of points) if (p[0] > last) have.push(p);
    trails.set(mmsi, have);
  }
  for (const [mmsi, points] of trails) {
    let i = 0;
    while (i < points.length && points[i][0] < oldest) i++;
    if (i) points.splice(0, i);
    if (!points.length) trails.delete(mmsi);
  }
}

/** How long (seconds) the boat spent fishing-slow away from its dock in these points. */
export function fishingSeconds(points, parties) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dt = b[0] - a[0];
    if (dt > GAP) continue;
    const kn = stretchKnots(a, b);
    if (kindOf(kn) === 'fishing' && !atDock(b, parties, kn)) total += dt;
  }
  return total;
}
