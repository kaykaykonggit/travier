import type { LatLng } from "./geocode";

const CACHE_KEY = "travier.photos.v3";
const SKIP_LOOKUP = new Set(["transit", "flight", "hotel", "rest", "night_train", "meal"]);
const NOISE =
  /\b(klook|ticket|tickets|skip[- ]the[- ]line|with|and|&|entry|admission|guided tour|audio guide|x2)\b/gi;
const NOISE_ZH = /門票|套票|入場券?|導覽|含門票|快速通關/g;
const NOT_A_PHOTO = /flag|coat_of_arms|logo|icon|map_of|location_map|diagram|\.svg($|\?)/i;

const memory = new Map<string, string>();
const misses = new Set<string>();
const inflight = new Map<string, Promise<string[]>>();
let cacheLoaded = false;
let active = 0;
const waiters: Array<() => void> = [];

export function isUsableImageUrl(url?: string | null): boolean {
  if (!url || !/^https?:\/\//i.test(url.trim())) return false;
  const value = url.trim();
  if (/\.{3,}|placeholder|example\.com/i.test(value)) return false;
  if (/maps\.app\.goo\.gl|(www\.)?google\.[^/]+\/maps(\/|$)/i.test(value)) return false;
  return true;
}

export function skipPhotoLookup(kind?: string | null): boolean {
  return Boolean(kind && SKIP_LOOKUP.has(kind));
}

export function osmTileUrl(lat: number, lng: number, zoom = 16): string {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [key, url] of Object.entries(obj)) {
      if (isUsableImageUrl(url)) memory.set(key, url);
    }
  } catch {
    /* ignore */
  }
}

function persistCache() {
  const obj: Record<string, string> = {};
  let n = 0;
  for (const [key, url] of memory) {
    if (n++ > 400) break;
    obj[key] = url;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

function cacheKey(query: string, title = ""): string {
  return `${query.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
}

function cleanName(value: string): string {
  return value.replace(NOISE, " ").replace(NOISE_ZH, " ").replace(/\s+/g, " ").trim();
}

function searchTerms(placeQuery: string, title = ""): string[] {
  const parts = placeQuery.split(",").map((part) => cleanName(part)).filter(Boolean);
  const name = parts[0] || cleanName(title);
  const city = parts[1] || "";
  const extra = cleanName(title);
  const extraEn = extra.replace(/[\u4e00-\u9fff]/g, " ").replace(/\s+/g, " ").trim();
  const terms: string[] = [];
  if (extraEn.length >= 4 && extraEn.toLowerCase() !== name.toLowerCase()) {
    terms.push(city ? `${extraEn} ${city}` : extraEn);
  }
  if (extra && /[\u4e00-\u9fff]/.test(extra) && extra !== name) {
    terms.push(city ? `${extra} ${city}` : extra);
  }
  if (name && city) terms.push(`${name} ${city}`);
  if (name) terms.push(name);
  return [...new Set(terms.filter((term) => term.length >= 3))];
}

function isGenericPage(title: string, query: string): boolean {
  const page = title.replace(/_/g, " ").toLowerCase();
  const parts = query.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean);
  const city = parts[1] || "";
  const country = parts[2] || "";
  if (city && (page === city || page.startsWith(`${city} (`) || page === `tourism in ${city}`)) return true;
  if (country && page === country) return true;
  return /list of |disambiguation|tourism in |history of /i.test(title);
}

function pickThumb(url?: string | null, title = ""): string | null {
  if (!isUsableImageUrl(url) || NOT_A_PHOTO.test(`${title} ${url}`)) return null;
  return url!.trim();
}

async function wikiThumbs(origin: string, search: string, query: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: search,
    gsrlimit: "5",
    prop: "pageimages",
    piprop: "thumbnail",
    pithumbsize: "1280",
  });
  const res = await fetch(`${origin}/w/api.php?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: { pages?: Record<string, { title?: string; index?: number; thumbnail?: { source?: string } }> };
  };
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const urls: string[] = [];
  for (const page of pages) {
    if (page.title && isGenericPage(page.title, query)) continue;
    const thumb = pickThumb(page.thumbnail?.source, page.title);
    if (thumb) urls.push(thumb);
  }
  return urls;
}

async function commonsThumbs(search: string): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: search,
    gsrlimit: "5",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "800",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: {
      pages?: Record<string, { title?: string; index?: number; imageinfo?: { url?: string; thumburl?: string }[] }>;
    };
  };
  const urls: string[] = [];
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const thumb = pickThumb(info?.thumburl || info?.url, page.title);
    if (thumb) urls.push(thumb);
  }
  return urls;
}

async function fetchRemotePhotos(query: string, title: string): Promise<string[]> {
  const urls: string[] = [];
  const seen = new Set<string>();
  const pushAll = (found: string[]) => {
    for (const url of found) {
      if (seen.has(url)) continue;
      seen.add(url);
      urls.push(url);
    }
  };

  for (const term of searchTerms(query, title)) {
    try {
      pushAll(await withLimit(() => wikiThumbs("https://en.wikipedia.org", term, query)));
      if (urls.length) return urls;
      if (/[\u4e00-\u9fff]/.test(term)) {
        pushAll(await withLimit(() => wikiThumbs("https://zh.wikipedia.org", term, query)));
        if (urls.length) return urls;
      }
      pushAll(await withLimit(() => commonsThumbs(term)));
      if (urls.length) return urls;
    } catch {
      /* try next term */
    }
  }
  return urls;
}

export async function lookupPlacePhotos({
  imageUrl,
  query,
  title = "",
  kind,
  point,
}: {
  imageUrl?: string | null;
  query: string;
  title?: string;
  kind?: string | null;
  point?: LatLng;
}): Promise<string[]> {
  loadCache();
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url?: string | null) => {
    if (!url || seen.has(url) || !isUsableImageUrl(url)) return;
    seen.add(url);
    urls.push(url);
  };

  push(imageUrl);
  if (skipPhotoLookup(kind)) {
    if (point) push(osmTileUrl(point.lat, point.lng));
    return urls;
  }

  const key = cacheKey(query, title);
  const cached = memory.get(key);
  if (cached) push(cached);
  else if (!misses.has(key)) {
    let pending = inflight.get(key);
    if (!pending) {
      pending = fetchRemotePhotos(query, title);
      inflight.set(key, pending);
    }
    const found = await pending;
    inflight.delete(key);
    if (found[0]) {
      memory.set(key, found[0]);
      persistCache();
    } else {
      misses.add(key);
    }
    found.forEach(push);
  }

  if (point) push(osmTileUrl(point.lat, point.lng));
  return urls;
}
