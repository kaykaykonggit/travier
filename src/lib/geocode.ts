export type LatLng = { lat: number; lng: number; label: string };

export type GeocodeQuery = {
  query: string;
  aliases?: string[];
};

const cache = new Map<string, LatLng | null>();
const CACHE_KEY = "travier.geocode.v3";
const cityCache = new Map<string, LatLng | null>();

type PhotonHit = {
  lat: number;
  lng: number;
  label: string;
  countryCode: string;
  city: string;
  state: string;
  name: string;
};

const COUNTRY_CODE: Record<string, string> = {
  japan: "jp",
  日本: "jp",
  austria: "at",
  奧地利: "at",
  italy: "it",
  意大利: "it",
  義大利: "it",
  france: "fr",
  法國: "fr",
  germany: "de",
  德國: "de",
  spain: "es",
  西班牙: "es",
  switzerland: "ch",
  "hong kong": "hk",
  香港: "hk",
  china: "cn",
  中國: "cn",
  taiwan: "tw",
  台灣: "tw",
  臺灣: "tw",
  korea: "kr",
  "south korea": "kr",
  韓國: "kr",
  "united states": "us",
  usa: "us",
  "united kingdom": "gb",
  uk: "gb",
};

function loadCache(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, LatLng | null>;
    for (const [k, v] of Object.entries(obj)) cache.set(k, v);
  } catch {
    /* ignore */
  }
}

function persistCache(): void {
  const obj: Record<string, LatLng | null> = {};
  cache.forEach((v, k) => {
    obj[k] = v;
  });
  localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}

let loaded = false;

function ensureCache() {
  if (loaded) return;
  loadCache();
  loaded = true;
}

export function mergePoints(base: Map<string, LatLng>, extra: Map<string, LatLng>): Map<string, LatLng> {
  const next = new Map(base);
  extra.forEach((point, key) => next.set(key, point));
  return next;
}

export function pointsFromCache(queries: string[]): Map<string, LatLng> {
  ensureCache();
  const result = new Map<string, LatLng>();
  for (const query of [...new Set(queries.map((item) => item.trim()).filter(Boolean))]) {
    const point = cache.get(query);
    if (point) result.set(query, point);
  }
  return result;
}

function countryCodeOf(value: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (COUNTRY_CODE[key]) return COUNTRY_CODE[key];
  if (/^[a-z]{2}$/i.test(value.trim())) return value.trim().toLowerCase();
  return null;
}

function parsePlace(query: string): { name: string; city: string | null; country: string | null; countryCode: string | null } {
  const parts = query.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const country = parts[parts.length - 1];
    const city = parts[parts.length - 2];
    return { name: parts.slice(0, -2).join(", "), city, country, countryCode: countryCodeOf(country) };
  }
  if (parts.length === 2) {
    const country = parts[1];
    const code = countryCodeOf(country);
    return { name: parts[0], city: code ? null : parts[1], country: code ? country : null, countryCode: code };
  }
  return { name: query.trim(), city: null, country: null, countryCode: null };
}

function norm(value: string): string {
  return value.toLowerCase().replace(/[市県府都區区]/g, "").replace(/\s+/g, "");
}

function foldQuery(input: string | GeocodeQuery): GeocodeQuery {
  if (typeof input === "string") return { query: input.trim() };
  return { query: input.query.trim(), aliases: input.aliases?.map((item) => item.trim()).filter(Boolean) };
}

function expandAliases(input: GeocodeQuery): string[] {
  const parsed = parsePlace(input.query);
  const aliases = [...(input.aliases ?? [])];
  if (parsed.countryCode === "jp") {
    for (const alias of [...aliases]) {
      if (alias.includes("崖")) aliases.push(alias.replace(/崖/g, "バンタ"));
      const stripped = alias.replace(/(展望台|公園|遺址|遺跡)$/u, "").trim();
      if (stripped.length >= 2 && stripped !== alias) aliases.push(stripped);
    }
  }
  return aliases;
}

function searchVariants(input: GeocodeQuery): string[] {
  const parsed = parsePlace(input.query);
  const aliases = expandAliases(input);
  const names = [...new Set([parsed.name, ...aliases].filter(Boolean))];
  const full: string[] = [];
  const short: string[] = [];
  for (const name of names) {
    if (parsed.city && parsed.country) full.push(`${name}, ${parsed.city}, ${parsed.country}`);
    else if (parsed.country) full.push(`${name}, ${parsed.country}`);
    else full.push(name);
    if (name !== parsed.name) short.push(name);
  }
  const unique = [...new Set([input.query, ...full, ...short].map((item) => item.trim()).filter(Boolean))];
  if (parsed.countryCode !== "jp") return unique.slice(0, 5);
  const cjk = unique.filter((item) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(item));
  const latin = unique.filter((item) => !/[\u3040-\u30ff\u4e00-\u9fff]/.test(item));
  return [...cjk, ...latin].slice(0, 5);
}

function kmBetween(a: LatLng, lat: number, lng: number): number {
  const dlat = lat - a.lat;
  const dlng = lng - a.lng;
  return Math.sqrt(dlat * dlat + dlng * dlng) * 111;
}

function nameMatches(hitName: string, names: string[]): boolean {
  return names.some((name) => Boolean(name && hitName && (hitName.includes(name) || name.includes(hitName))));
}

/** Latin city names ↔ local spellings so Photon/Nominatim Japanese cities still match. */
const CITY_ALIASES: Record<string, string[]> = {
  naha: ["那覇", "那霸", "なは"],
  nago: ["名護", "なご"],
  onna: ["恩納", "おんな"],
  motobu: ["本部", "もとぶ"],
  nakijin: ["今帰仁", "なきじん"],
  ginoza: ["宜野座", "ぎのざ"],
  kin: ["金武", "きん"],
  uruma: ["うるま"],
  nanjo: ["南城", "なんじょう"],
  ginowan: ["宜野湾", "ぎのわん"],
  urasoe: ["浦添", "うらそえ"],
  okinawa: ["沖縄", "おきなわ"],
};

function cityTokens(city: string | null): string[] {
  if (!city) return [];
  const key = city.toLowerCase().replace(/\s+/g, "");
  return [...new Set([norm(city), key, ...(CITY_ALIASES[key] ?? []).map(norm)].filter(Boolean))];
}

function scoreHit(hit: PhotonHit, parsed: ReturnType<typeof parsePlace>, bias: LatLng | null | undefined, aliases: string[]): number {
  if (parsed.countryCode && hit.countryCode && hit.countryCode !== parsed.countryCode) return -1000;

  const km = bias ? kmBetween(bias, hit.lat, hit.lng) : Infinity;
  if (parsed.city && bias && km > 120) return -500;

  const tokens = cityTokens(parsed.city);
  const cityBlob = [hit.city, hit.state, hit.label].map((part) => (part ? norm(part) : "")).join("|");
  const cityHit = tokens.some((token) => token && cityBlob.includes(token));
  const names = [parsed.name, ...aliases].map(norm).filter(Boolean);
  const hitName = norm(hit.name || hit.label);
  const named = nameMatches(hitName, names);
  if (parsed.city && !cityHit && !named && !(bias && km < 120)) return -500;

  let score = 0;
  if (parsed.countryCode && (hit.countryCode === parsed.countryCode || !hit.countryCode)) score += 100;
  if (cityHit) score += 40;
  if (named) score += 30;
  if (bias) {
    if (km < 80) score += 25;
    else if (km < 250) score += 10;
  }
  return score;
}

function pickHit(hits: PhotonHit[], parsed: ReturnType<typeof parsePlace>, bias: LatLng | null | undefined, aliases: string[]): PhotonHit | null {
  const ranked = hits
    .map((hit) => ({ hit, score: scoreHit(hit, parsed, bias, aliases) }))
    .filter((row) => row.score >= 80)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.hit ?? null;
}

async function fetchJson(url: string, init?: RequestInit, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function photonSearch(q: string, bias?: LatLng | null): Promise<PhotonHit[]> {
  const params = new URLSearchParams({ q, limit: "8" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lng));
  }
  const res = await fetchJson(`https://photon.komoot.io/api/?${params}`);
  if (!res.ok) throw new Error("photon");
  const json = (await res.json()) as {
    features?: {
      geometry?: { coordinates?: number[] };
      properties?: {
        name?: string;
        country?: string;
        countrycode?: string;
        city?: string;
        state?: string;
        locality?: string;
      };
    }[];
  };
  return (json.features ?? []).flatMap((feature) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return [];
    const props = feature.properties ?? {};
    return [
      {
        lat: coords[1],
        lng: coords[0],
        label: props.name ?? q,
        countryCode: (props.countrycode ?? "").toLowerCase(),
        city: props.city || props.locality || "",
        state: props.state || "",
        name: props.name || "",
      },
    ];
  });
}

async function nominatimSearch(q: string, countryCode: string | null): Promise<PhotonHit[]> {
  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "5",
    addressdetails: "1",
  });
  if (countryCode) params.set("countrycodes", countryCode);
  const res = await fetchJson(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "Travier/0.1 (https://travier.pages.dev)" },
  });
  if (!res.ok) throw new Error("nominatim");
  const json = (await res.json()) as {
    lat?: string;
    lon?: string;
    name?: string;
    display_name?: string;
    address?: { country_code?: string; city?: string; town?: string; village?: string; county?: string; state?: string };
  }[];
  return json.flatMap((item) => {
    const lat = Number(item.lat);
    const lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [
      {
        lat,
        lng,
        label: item.name || item.display_name || q,
        countryCode: (item.address?.country_code ?? "").toLowerCase(),
        city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || "",
        state: item.address?.state || "",
        name: item.name || "",
      },
    ];
  });
}

function savePoint(key: string, picked: PhotonHit): LatLng {
  const point = { lat: picked.lat, lng: picked.lng, label: picked.label };
  cache.set(key, point);
  persistCache();
  return point;
}

async function resolveCity(city: string, country: string, countryCode: string): Promise<LatLng | null> {
  const key = `${city}, ${country}`;
  if (cityCache.has(key)) return cityCache.get(key) ?? null;
  if (cache.has(key)) {
    const hit = cache.get(key) ?? null;
    cityCache.set(key, hit);
    return hit;
  }
  try {
    const hits = await nominatimSearch(key, countryCode);
    const picked = hits.find((hit) => !hit.countryCode || hit.countryCode === countryCode);
    if (picked) {
      const point = savePoint(key, picked);
      cityCache.set(key, point);
      return point;
    }
  } catch {
    /* Photon next */
  }
  try {
    const hits = await photonSearch(key);
    const picked = hits.find((hit) => !hit.countryCode || hit.countryCode === countryCode);
    if (picked) {
      const point = savePoint(key, picked);
      cityCache.set(key, point);
      return point;
    }
  } catch {
    /* leave unresolved */
  }
  cityCache.set(key, null);
  return null;
}

async function geocodeOne(input: GeocodeQuery, bias?: LatLng | null): Promise<LatLng | null> {
  ensureCache();
  const key = input.query.trim();
  if (!key) return null;
  // Only trust positive cache hits. Failed lookups must retry — English JP names
  // often fail once without bias then succeed after a nearby stop resolves.
  if (cache.has(key)) {
    const hit = cache.get(key);
    if (hit) return hit;
  }

  const parsed = parsePlace(key);
  const aliases = expandAliases(input);
  const cityBias =
    parsed.city && parsed.country && parsed.countryCode
      ? await resolveCity(parsed.city, parsed.country, parsed.countryCode)
      : null;
  const regionBias = cityBias || bias || null;
  const variants = searchVariants(input);

  for (const q of variants.slice(0, 5)) {
    try {
      const hits = await photonSearch(q, regionBias);
      const picked = pickHit(hits, parsed, regionBias, aliases);
      if (picked) return savePoint(key, picked);
    } catch {
      /* try next variant or Nominatim */
    }
  }
  for (const q of variants.slice(0, 5)) {
    try {
      const hits = await nominatimSearch(q, parsed.countryCode);
      const picked = pickHit(hits, parsed, regionBias, aliases);
      if (picked) return savePoint(key, picked);
    } catch {
      /* try next */
    }
  }
  // Do not persist null — a later call with better regional bias may succeed.
  return null;
}

export async function geocodeMany(
  queries: Array<string | GeocodeQuery>,
  bias?: LatLng | null,
): Promise<Map<string, LatLng>> {
  ensureCache();
  const inputs = queries.map(foldQuery).filter((item) => item.query);
  const result = new Map<string, LatLng>();
  const missing: GeocodeQuery[] = [];
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input.query)) continue;
    seen.add(input.query);
    if (cache.has(input.query)) {
      const hit = cache.get(input.query);
      if (hit) result.set(input.query, hit);
      else missing.push(input);
    } else {
      missing.push(input);
    }
  }

  // Resolve sequentially so each success can bias the next (same-day itineraries).
  let runningBias = bias ?? null;
  for (const input of missing) {
    const point = await geocodeOne(input, runningBias);
    if (point) {
      result.set(input.query, point);
      runningBias = point;
    }
  }
  return result;
}
