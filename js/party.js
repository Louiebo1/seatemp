// Southern California party (open-party sportfishing) boats, matched to AIS by name.
// Shared by the page and the relay. Generated from the iPhone app's PartyBoats.swift
// (every boat that posted fish counts from a SoCal landing Oct 2025 - Oct 2026, plus San
// Diego's long-range fleet); regenerate with tools/party_from_app.py when that list changes.

/** Names compared without case, spaces or punctuation, and with a closing roman numeral
 *  as a digit: "Red Rooster III" = "RED ROOSTER 3", "New Lo-An" = "NEWLOAN". */
export function partyKey(name) {
  const words = String(name).toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const roman = { II: '2', III: '3', IV: '4', V: '5' };
  if (words.length > 1 && roman[words[words.length - 1]]) words[words.length - 1] = roman[words[words.length - 1]];
  return words.join('');
}

export const PARTY_BOATS = [
  ["Clemente", "Dana Wharf Sportfishing", "Dana Point"],
  ["Current", "Dana Wharf Sportfishing", "Dana Point"],
  ["Dana Pride", "Dana Wharf Sportfishing", "Dana Point"],
  ["Fury", "Dana Wharf Sportfishing", "Dana Point"],
  ["Helena", "Dana Wharf Sportfishing", "Dana Point"],
  ["Lex Sea", "Dana Wharf Sportfishing", "Dana Point"],
  ["New San Mateo", "Dana Wharf Sportfishing", "Dana Point"],
  ["Reel Fun", "Dana Wharf Sportfishing", "Dana Point"],
  ["Second Chance", "Dana Wharf Sportfishing", "Dana Point"],
  ["Sum Fun", "Dana Wharf Sportfishing", "Dana Point"],
  ["Ahra-Ahn", "Long Beach Sportfishing", "Long Beach"],
  ["El Patron", "Long Beach Sportfishing", "Long Beach"],
  ["Eldorado", "Long Beach Sportfishing", "Long Beach"],
  ["MarDiosa", "Long Beach Sportfishing", "Long Beach"],
  ["Victory", "Long Beach Sportfishing", "Long Beach"],
  ["City of Long Beach", "Pierpoint Landing", "Long Beach"],
  ["Enterprise", "Pierpoint Landing", "Long Beach"],
  ["Toronado", "Pierpoint Landing", "Long Beach"],
  ["Betty-O", "Marina Del Rey Sportfishing", "Marina Del Rey"],
  ["New Del Mar", "Marina Del Rey Sportfishing", "Marina Del Rey"],
  ["Spitfire", "Marina Del Rey Sportfishing", "Marina Del Rey"],
  ["Blackfish", "Davey's Locker", "Newport Beach"],
  ["Freelance", "Davey's Locker", "Newport Beach"],
  ["Western Pride", "Davey's Locker", "Newport Beach"],
  ["Aggressor", "Newport Landing", "Newport Beach"],
  ["Patriot", "Newport Landing", "Newport Beach"],
  ["Thunderbird", "Newport Landing", "Newport Beach"],
  ["Blue Horizon", "Oceanside Sea Center", "Oceanside"],
  ["Chubasco II", "Oceanside Sea Center", "Oceanside"],
  ["Effishency", "Oceanside Sea Center", "Oceanside"],
  ["Pronto", "Oceanside Sea Center", "Oceanside"],
  ["Sea Star", "Oceanside Sea Center", "Oceanside"],
  ["Southern Cal", "Oceanside Sea Center", "Oceanside"],
  ["Aloha Spirit", "Channel Islands Sportfishing", "Oxnard"],
  ["Cobra", "Channel Islands Sportfishing", "Oxnard"],
  ["Gentleman", "Channel Islands Sportfishing", "Oxnard"],
  ["Graylight", "Channel Islands Sportfishing", "Oxnard"],
  ["Indicator", "Channel Islands Sportfishing", "Oxnard"],
  ["Island Fox", "Channel Islands Sportfishing", "Oxnard"],
  ["Island Tak", "Channel Islands Sportfishing", "Oxnard"],
  ["Mirage", "Channel Islands Sportfishing", "Oxnard"],
  ["Orion", "Channel Islands Sportfishing", "Oxnard"],
  ["Speed Twin", "Channel Islands Sportfishing", "Oxnard"],
  ["Coroloma", "Hooks Landing", "Oxnard"],
  ["Estella", "Hooks Landing", "Oxnard"],
  ["New Hustler", "Hooks Landing", "Oxnard"],
  ["Pescador", "Redondo Beach Sportfishing", "Redondo Beach"],
  ["Redondo Special", "Redondo Beach Sportfishing", "Redondo Beach"],
  ["Constitution", "Fisherman's Landing", "San Diego"],
  ["Dolphin", "Fisherman's Landing", "San Diego"],
  ["Fortune", "Fisherman's Landing", "San Diego"],
  ["Islander", "Fisherman's Landing", "San Diego"],
  ["Liberty", "Fisherman's Landing", "San Diego"],
  ["Lucky B Sportfishing", "Fisherman's Landing", "San Diego"],
  ["Pacific Dawn", "Fisherman's Landing", "San Diego"],
  ["Pacific Queen", "Fisherman's Landing", "San Diego"],
  ["Pegasus", "Fisherman's Landing", "San Diego"],
  ["Poseidon", "Fisherman's Landing", "San Diego"],
  ["Tomahawk", "Fisherman's Landing", "San Diego"],
  ["Alicia", "H&M Landing", "San Diego"],
  ["Daiwa Pacific", "H&M Landing", "San Diego"],
  ["Excalibur", "H&M Landing", "San Diego"],
  ["Grande", "H&M Landing", "San Diego"],
  ["Horizon", "H&M Landing", "San Diego"],
  ["Legend", "H&M Landing", "San Diego"],
  ["Little G", "H&M Landing", "San Diego"],
  ["Malihini", "H&M Landing", "San Diego"],
  ["Nautilus", "H&M Landing", "San Diego"],
  ["Ocean Odyssey", "H&M Landing", "San Diego"],
  ["Old Glory", "H&M Landing", "San Diego"],
  ["Patriot", "H&M Landing", "San Diego"],
  ["Premier", "H&M Landing", "San Diego"],
  ["Producer", "H&M Landing", "San Diego"],
  ["Ranger 85", "H&M Landing", "San Diego"],
  ["Relentless", "H&M Landing", "San Diego"],
  ["Sea Adventure 80", "H&M Landing", "San Diego"],
  ["Spirit of Adventure", "H&M Landing", "San Diego"],
  ["Top Gun 80", "H&M Landing", "San Diego"],
  ["Tradition", "H&M Landing", "San Diego"],
  ["Vendetta 2", "H&M Landing", "San Diego"],
  ["American Angler", "Long range", "San Diego"],
  ["Excel", "Long range", "San Diego"],
  ["Independence", "Long range", "San Diego"],
  ["Intrepid", "Long range", "San Diego"],
  ["Red Rooster III", "Long range", "San Diego"],
  ["Royal Star", "Long range", "San Diego"],
  ["Searcher", "Long range", "San Diego"],
  ["Shogun", "Long range", "San Diego"],
  ["Vagabond", "Long range", "San Diego"],
  ["Daily Double", "Point Loma Sportfishing", "San Diego"],
  ["Got Bait", "Point Loma Sportfishing", "San Diego"],
  ["Mission Belle", "Point Loma Sportfishing", "San Diego"],
  ["New Lo-An", "Point Loma Sportfishing", "San Diego"],
  ["Point Loma", "Point Loma Sportfishing", "San Diego"],
  ["Apollo", "Seaforth Sportfishing", "San Diego"],
  ["Aztec", "Seaforth Sportfishing", "San Diego"],
  ["Cortez", "Seaforth Sportfishing", "San Diego"],
  ["El Gato Dos", "Seaforth Sportfishing", "San Diego"],
  ["Highliner", "Seaforth Sportfishing", "San Diego"],
  ["Legacy", "Seaforth Sportfishing", "San Diego"],
  ["New Seaforth", "Seaforth Sportfishing", "San Diego"],
  ["Pacific Voyager", "Seaforth Sportfishing", "San Diego"],
  ["Pacifica", "Seaforth Sportfishing", "San Diego"],
  ["Polaris Supreme", "Seaforth Sportfishing", "San Diego"],
  ["San Diego", "Seaforth Sportfishing", "San Diego"],
  ["Sea Watch", "Seaforth Sportfishing", "San Diego"],
  ["Tribute", "Seaforth Sportfishing", "San Diego"],
  ["Voyager", "Seaforth Sportfishing", "San Diego"],
  ["Amigo", "22nd Street Landing", "San Pedro"],
  ["Freedom", "22nd Street Landing", "San Pedro"],
  ["Ghost", "22nd Street Landing", "San Pedro"],
  ["Monte Carlo", "22nd Street Landing", "San Pedro"],
  ["Native Sun", "22nd Street Landing", "San Pedro"],
  ["Pride", "22nd Street Landing", "San Pedro"],
  ["Pursuit", "22nd Street Landing", "San Pedro"],
  ["Gail Force", "LA Waterfront Cruises and Sportfishing", "San Pedro"],
  ["Sport King", "LA Waterfront Cruises and Sportfishing", "San Pedro"],
  ["Triton", "LA Waterfront Cruises and Sportfishing", "San Pedro"],
  ["Coral Sea", "Santa Barbara Landing", "Santa Barbara"],
  ["Stardust", "Santa Barbara Landing", "Santa Barbara"],
  ["Californian", "Ventura Harbor Sportfishing", "Ventura"],
  ["Endeavor", "Ventura Harbor Sportfishing", "Ventura"],
  ["Island Spirit", "Ventura Harbor Sportfishing", "Ventura"],
  ["Pacific Eagle", "Ventura Harbor Sportfishing", "Ventura"],
  ["Caroline", "Chris' Fishing Trips", "Monterey"],
  ["Check Mate", "Chris' Fishing Trips", "Monterey"],
  ["Star of Monterey", "Chris' Fishing Trips", "Monterey"],
  ["Chubasco", "J&M Sportfishing", "Monterey"],
  ["Kahuna", "J&M Sportfishing", "Monterey"],
  ["New Horizon", "J&M Sportfishing", "Monterey"],
  ["Barbarossa", "Barbarossa Fishing", "Santa Cruz"],
  ["Legacy", "Stagnaro's Charters", "Santa Cruz"],
  ["Velocity", "Stagnaro's Charters", "Santa Cruz"],
  ["Mega-bite", "Monterey Bay Charters", "Santa Cruz"],
  ["Salmon Streaker", "Santa Cruz Coastal Fishing Charters", "Santa Cruz"],
  ["Avenger", "Morro Bay Landing", "Morro Bay"],
  ["Endeavor", "Morro Bay Landing", "Morro Bay"],
  ["Starfire", "Morro Bay Landing", "Morro Bay"],
  ["Black Pearl", "Black Pearl Sportfishing", "Morro Bay"],
  ["Fiesta", "Virg's Landing", "Morro Bay"],
  ["Rita G", "Virg's Landing", "Morro Bay"],
  ["Flying Fish", "Patriot Sportfishing", "Avila Beach"],
  ["Patriot", "Patriot Sportfishing", "Avila Beach"],
  ["Sunny Day", "Patriot Sportfishing", "Avila Beach"],
].map(([name, landing, city]) => ({ name, landing, city }));

const byKey = new Map();
for (const b of PARTY_BOATS) {
  const k = partyKey(b.name);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(b);
}

/** Transponders (MMSI) known for sure, by name key (a list where two party boats share a
 *  name: Patriot at Newport and San Diego, Endeavor at Ventura and Morro Bay). Checked
 *  2026-11-19: the fleet tracker at fishing-reports.ai/fleet, vessel databases (Excel,
 *  Searcher, American Angler), and the FCC's ship radio licenses (data.fcc.gov ULS l_ship:
 *  each party boat's license held by its sportfishing company near its landing; 11 of them
 *  agreed with the fleet tracker). The relay starts its pins with these and never re-pins
 *  them; learned pins only fill in names not listed here. */
export const KNOWN_PINS = {
  AGGRESSOR: 366897770, ALICIA: 368160170, ALOHASPIRIT: [368464920, 368018780],
  AMERICANANGLER: 367485000, AMIGO: 368133430, APOLLO: 303338000, AVENGER: 367767450,
  BLACKPEARL: 367698640, CALIFORNIAN: 368189960, CAROLINE: 366752090, CHUBASCO: 367785470,
  CHUBASCO2: 366688460, CITYOFLONGBEACH: 367034320, CLEMENTE: 367324190, COBRA: 367673660,
  CONSTITUTION: 368352260, CORALSEA: 367671430, DAILYDOUBLE: 368081690, DAIWAPACIFIC: 367346990,
  DANAPRIDE: 366849310, DOLPHIN: 367330940, ELDORADO: 368089620, ELPATRON: 366915000,
  ENDEAVOR: [367452860, 367694510], ENTERPRISE: 367095040, ESTELLA: 368071460,
  EXCALIBUR: 368050590, EXCEL: 338102000, FIESTA: 366112760, FLYINGFISH: 366060000,
  FORTUNE: 367515120, FREEDOM: 367621160, FURY: 366917650, GAILFORCE: 367592620,
  GENTLEMAN: 368052510, GRANDE: 366746210, HELENA: 367611730, HORIZON: 338776000,
  INDEPENDENCE: 338795000, INTREPID: 367704000, ISLANDER: 368406170, ISLANDFOX: 368236210,
  ISLANDSPIRIT: 368140130, ISLANDTAK: 366925740, KAHUNA: 368247080, LEGACY: 366889830,
  LEGEND: 367600830, MALIHINI: 367146720, MISSIONBELLE: 367180720, MONTECARLO: 368014440,
  NATIVESUN: 367655460, NEWDELMAR: 366855060, NEWHORIZON: 367785650, NEWLOAN: 338093000,
  NEWSANMATEO: 368271550, NEWSEAFORTH: 367076870, OCEANODYSSEY: 367025330, OLDGLORY: 367629440,
  ORION: 367529170, PACIFICA: 368218520, PACIFICQUEEN: 367186270, PATRIOT: [367099460, 368268760],
  PESCADOR: 368051170, POINTLOMA: 367304250, POLARISSUPREME: 303676000, POSEIDON: 366880260,
  PREMIER: 367771450, PRIDE: 368098230, PRONTO: 368155450, PURSUIT: 368022060, RANGER85: 367044250,
  REDONDOSPECIAL: 367595720, REDROOSTER3: 366749490, REELFUN: 367393090, RITAG: 367381820,
  ROYALSTAR: 366447000, SEARCHER: 367130150, SEAWATCH: 368376240, SHOGUN: 368453000,
  SOUTHERNCAL: 367349390, SPEEDTWIN: 368087330, SPIRITOFADVENTURE: 367185130, SPITFIRE: 367435030,
  SPORTKING: 368310220, STARDUST: 367163430, STAROFMONTEREY: 367141650, SUMFUN: 367304670,
  THUNDERBIRD: 368078070, TOMAHAWK: 368046780, TOPGUN80: 368437000, TORONADO: 367169120,
  TRIBUTE: 369713000, TRITON: 367622910, VAGABOND: 368347000, VELOCITY: 367010010,
  VICTORY: 368412030, WESTERNPRIDE: 367158550,
};

/** The party boats a boat on AIS is, by name — unless it's plainly a different boat with
 *  the same name: a freighter, tanker, tug, sailboat or pleasure craft by its type, a US
 *  recreational boat by its MMSI (338…, unless it says fishing or passenger), or
 *  north of the SoCal map (a Morro Bay or Monterey namesake). Same rule as the app.
 *
 *  With `pins` (the relay's {nameKey: mmsi}: each party boat's transponder, learned the
 *  first time a boat with its name was heard near its home harbor), a pinned transponder
 *  is that boat whatever name it sends, and any other boat with the name isn't. */
export function partyOf(boat, pins = null) {
  if (pins) {
    const pinned = pinIndex(pins).get(Number(boat.mmsi));
    if (pinned) return inRange(byKey.get(pinned) || [], boat);
  }
  const found = byName(boat);
  if (pins && found.length) {
    // Pinned under this name to other transponders — unless the pins don't cover every party
    // boat with the name (Avila's Patriot has none yet; Newport's and San Diego's do).
    const mine = pins[partyKey(found[0].name)];
    const all = byKey.get(partyKey(found[0].name)) || [];
    if (mine != null && !pinList(mine).includes(Number(boat.mmsi)) && pinList(mine).length >= all.length) return [];
  }
  return found;
}

/** The name rule alone (no pins). */
export function byName(boat) {
  if (!boat.name) return [];
  const t = boat.type;
  if (t != null && ((t >= 70 && t <= 89) || [31, 32, 36, 37, 52].includes(t))) return [];
  // 338… is a US recreational number — but some long-range boats have one (Excel, Horizon),
  // so it only rules a boat out when it doesn't call itself fishing or passenger.
  if (String(boat.mmsi).startsWith('338') && !(t === 30 || (t >= 60 && t <= 69))) return [];
  return inRange(byKey.get(partyKey(boat.name)) || [], boat);
}

/** A pin's transponders (one, or a list when two party boats share the name). */
export const pinList = v => [].concat(v).map(Number);

/** Central Coast landings (the Monterey Bay and Morro Bay maps); the rest are Southern
 *  California's, whose boats fish south to Baja. A namesake on the other coast isn't one. */
export const CENTRAL = new Set(['Monterey', 'Santa Cruz', 'Morro Bay', 'Avila Beach']);
const inRange = (list, boat) => list.filter(p => (CENTRAL.has(p.city) ? boat.lat >= 34.4 : boat.lat <= 34.9));

const indexes = new WeakMap();
function pinIndex(pins) {
  let index = indexes.get(pins);
  if (!index) {
    index = new Map(Object.entries(pins).flatMap(([k, v]) => pinList(v).map(m => [m, k])));
    indexes.set(pins, index);
  }
  return index;
}

/** Each landing city's harbor (San Diego has two: the Point Loma landings and Mission Bay),
 *  and how near (nm) counts as "at home" for pinning a transponder. */
export const HOMES = {
  'Dana Point': [[33.459, -117.698]], 'Long Beach': [[33.758, -118.204]], 'Marina Del Rey': [[33.968, -118.455]],
  'Newport Beach': [[33.600, -117.880]], 'Oceanside': [[33.205, -117.395]], 'Oxnard': [[34.160, -119.225]],
  'Redondo Beach': [[33.845, -118.398]], 'San Diego': [[32.722, -117.226], [32.763, -117.236]], 'San Pedro': [[33.715, -118.270]],
  'Santa Barbara': [[34.403, -119.690]], 'Ventura': [[34.243, -119.267]],
  'Monterey': [[36.605, -121.892]], 'Santa Cruz': [[36.962, -122.002]], 'Morro Bay': [[35.370, -120.857]],
  'Avila Beach': [[35.170, -120.738]],
};
const HOME_NM = 3;

/** Nautical miles between two points (flat-earth: fine at these distances). */
export function nm(lat1, lon1, lat2, lon2) {
  const dy = (lat2 - lat1) * 60, dx = (lon2 - lon1) * 60 * Math.cos((lat1 + lat2) / 2 * Math.PI / 180);
  return Math.hypot(dx, dy);
}

/** True when the boat is within a few miles (or `radius` nm) of one of these party boats'
 *  home harbors. */
export function nearHome(boat, parties, radius = null) {
  return parties.some(p => (HOMES[p.city] || []).some(h => nm(boat.lat, boat.lon, h[0], h[1]) <= (radius ?? HOME_NM)));
}
