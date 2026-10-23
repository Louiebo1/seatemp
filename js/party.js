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
].map(([name, landing, city]) => ({ name, landing, city }));

const byKey = new Map();
for (const b of PARTY_BOATS) {
  const k = partyKey(b.name);
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(b);
}

/** The party boats a boat on AIS is, by name — unless it's plainly a different boat with
 *  the same name: a freighter, tanker, tug, sailboat or pleasure craft by its type, a US
 *  recreational boat by its MMSI (338…; party boats are licensed commercial, 366–369), or
 *  north of the SoCal map (a Morro Bay or Monterey namesake). Same rule as the app. */
export function partyOf(boat) {
  if (!boat.name) return [];
  const t = boat.type;
  if (t != null && ((t >= 70 && t <= 89) || [31, 32, 36, 37, 52].includes(t))) return [];
  if (String(boat.mmsi).startsWith('338')) return [];
  if (boat.lat > 34.6 + 0.3) return [];
  return byKey.get(partyKey(boat.name)) || [];
}
