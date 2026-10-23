// One day's sea surface temperature over a region: cells 0.01° (about 1 km) apart, row 0
// the northern edge, °C, land NaN. Ported from the app's SSTGrid.

export const fahrenheit = c => c * 9 / 5 + 32;

export class Grid {
  constructor({ cols, rows, west, north, cell, celsius }) {
    Object.assign(this, { cols, rows, west, north, cell, celsius });
  }
  lat(row) { return this.north - row * this.cell; }
  lon(col) { return this.west + col * this.cell; }
  row(lat) { return (this.north - lat) / this.cell; }
  col(lon) { return (lon - this.west) / this.cell; }

  /** °F of the cell nearest a point, or null on land or off the map. */
  fahrenheitAt(lat, lon) {
    const r = Math.round(this.row(lat)), c = Math.round(this.col(lon));
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    const v = this.celsius[r * this.cols + c];
    return Number.isNaN(v) ? null : fahrenheit(v);
  }

  /** The coldest and warmest water, °F (null if all land). */
  fahrenheitRange() {
    let lo = Infinity, hi = -Infinity;
    for (const v of this.celsius) if (!Number.isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
    return lo <= hi ? [fahrenheit(lo), fahrenheit(hi)] : null;
  }

  /** Land (islands included) blanked out: MUR's temperatures fill small islands in; its mask doesn't. */
  masked(land) {
    if (!land || land.length !== this.celsius.length) return this;
    const v = this.celsius.slice();
    for (let i = 0; i < v.length; i++) if (land[i]) v[i] = NaN;
    return new Grid({ ...this, celsius: v });
  }

  /** The region's hidden boxes (Baja's Gulf of California) blanked out like land. */
  hiding(boxes) {
    if (!boxes || !boxes.length) return this;
    const v = this.celsius.slice();
    for (let r = 0; r < this.rows; r++) {
      const lat = this.lat(r);
      for (let c = 0; c < this.cols; c++) {
        const lon = this.lon(c);
        if (boxes.some(b => lat >= b.south && lat <= b.north && lon >= b.west && lon <= b.east)) v[r * this.cols + c] = NaN;
      }
    }
    return new Grid({ ...this, celsius: v });
  }
}

/** Reads ERDDAP's `.esriAscii`: six header lines (ncols, nrows, xllcenter, yllcenter,
 *  cellsize, nodata_value), then the values row by row from the north. `keepAll` keeps
 *  every value (for the land mask). */
export function parseESRIAscii(text, keepAll = false) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const header = {};
  for (let i = 0; i < 6; i++) header[tokens[2 * i].toLowerCase()] = Number(tokens[2 * i + 1]);
  const { ncols: cols, nrows: rows, xllcenter: x, yllcenter: y, cellsize: cell, nodata_value: nodata } = header;
  if (!(cols > 0 && rows > 0) || [x, y, cell, nodata].some(Number.isNaN)) throw new Error('Bad map header');
  if (tokens.length - 12 !== cols * rows) throw new Error('Map is the wrong size');
  const values = new Float32Array(cols * rows);
  for (let i = 0; i < values.length; i++) {
    const v = Number(tokens[12 + i]);
    values[i] = keepAll || (Math.abs(v - nodata) > 1e-6 && v > -5) ? v : NaN;
  }
  // The header's numbers are stored as floats: round them back to the 0.01° grid.
  const round = v => Math.round(v * 1000) / 1000;
  const step = round(cell);
  return new Grid({ cols, rows, west: round(x), north: round(round(y) + (rows - 1) * step), cell: step, celsius: values });
}

/** MUR's land mask (1 open sea; 2 land; 5 lake; 9 sea ice; 13 lake ice): true where not sea. */
export function parseLandMask(text) {
  const g = parseESRIAscii(text, true);
  return Uint8Array.from(g.celsius, v => (v === 1 || v === 9) ? 0 : 1);
}
