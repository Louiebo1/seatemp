# Cuts the land outlines for Sea Temp's four maps out of GSHHG (Global Self-consistent
# Hierarchical High-resolution Shorelines, full resolution, level 1 = land incl. islands)
# and writes js/coast-data.js (the web page) and the app's SeaTemp/coast.json.
#   curl -LO https://www.soest.hawaii.edu/pwessel/gshhg/gshhg-bin-2.3.7.zip
#   unzip gshhg-bin-2.3.7.zip gshhs_f.b
#   python3 tools/coast_from_gshhg.py path/to/gshhs_f.b
# Each region's polygons are clipped to its box (plus a margin) and simplified to ~15 m.
import json, re, struct, sys, os

TOLERANCE = 0.00015     # degrees (~15 m): Douglas-Peucker
MARGIN = 0.05           # degrees beyond each box

src = open(os.path.join(os.path.dirname(__file__), '..', 'js', 'regions-data.js')).read()
regions = json.loads(src[src.index('['):src.rindex(']') + 1])

def boxes():
    for r in regions:
        yield r['id'], (r['west'] - MARGIN, r['south'] - MARGIN, r['east'] + MARGIN, r['north'] + MARGIN)

def read_gshhg(path):
    with open(path, 'rb') as f:
        data = f.read()
    i = 0
    while i < len(data):
        pid, n, flag, west, east, south, north, area, area_full, container, ancestor = struct.unpack_from('>11i', data, i)
        i += 44
        level = flag & 255
        if level == 1:
            yield (west / 1e6, east / 1e6, south / 1e6, north / 1e6), data, i, n
        i += 8 * n

def points(data, i, n):
    pts = struct.unpack_from(f'>{2 * n}i', data, i)
    out = []
    for k in range(n):
        lon, lat = pts[2 * k] / 1e6, pts[2 * k + 1] / 1e6
        if lon > 180: lon -= 360
        out.append((lon, lat))
    return out

def clip(poly, box):
    """Sutherland-Hodgman against an axis-aligned box (fine for filling: concave pieces
    may gain edges along the border, which lie outside the map anyway)."""
    w, s, e, n = box
    def cut(pts, inside, cross):
        out = []
        for k in range(len(pts)):
            p, q = pts[k - 1], pts[k]
            if inside(q):
                if not inside(p): out.append(cross(p, q))
                out.append(q)
            elif inside(p):
                out.append(cross(p, q))
        return out
    def at_x(x):
        return lambda p, q: (x, p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0]))
    def at_y(y):
        return lambda p, q: (p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]), y)
    for inside, cross in [(lambda p: p[0] >= w, at_x(w)), (lambda p: p[0] <= e, at_x(e)),
                          (lambda p: p[1] >= s, at_y(s)), (lambda p: p[1] <= n, at_y(n))]:
        poly = cut(poly, inside, cross)
        if not poly: return []
    return poly

def simplify(pts, tol):
    if len(pts) < 4: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        d2 = dx * dx + dy * dy
        best, at = -1, -1
        for k in range(a + 1, b):
            x, y = pts[k]
            if d2 == 0: dist = (x - x1) ** 2 + (y - y1) ** 2
            else:
                t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / d2))
                dist = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2
            if dist > best: best, at = dist, k
        if best > tol * tol:
            keep[at] = True
            stack += [(a, at), (at, b)]
    return [p for p, k in zip(pts, keep) if k]

def main(path):
    polys = list(read_gshhg(path))
    out = {}
    for rid, box in boxes():
        w, s, e, n = box
        rings = []
        for (pw, pe, ps, pn), data, i, count in polys:
            if pw > 180: pw -= 360; pe -= 360
            if pe < w or pw > e or pn < s or ps > n: continue
            ring = clip(points(data, i, count), box)
            ring = simplify(ring + [ring[0]], TOLERANCE)[:-1] if len(ring) > 2 else []
            if len(ring) >= 3:
                rings.append([v for p in ring for v in (round(p[0], 4), round(p[1], 4))])
        out[rid] = rings
        print(rid, len(rings), 'polygons', sum(len(r) // 2 for r in rings), 'points')
    text = json.dumps(out, separators=(',', ':'))
    root = os.path.join(os.path.dirname(__file__), '..')
    with open(os.path.join(root, 'js', 'coast-data.js'), 'w') as f:
        f.write('// Land outlines for the four maps (GSHHG full resolution, level 1), made by\n'
                '// tools/coast_from_gshhg.py: region id -> polygons, each [lon, lat, lon, lat, ...].\n'
                'export const COAST = ' + text + ';\n')
    app = os.path.expanduser('~/code/sst/SeaTemp/coast.json')
    with open(app, 'w') as f: f.write(text)
    print(len(text), 'bytes')

main(sys.argv[1])
