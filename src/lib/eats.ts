import type { Day, TimelineItem } from "../types";
import type { LatLng } from "./geocode";

export type EatSlotId = "breakfast" | "lunch" | "snack" | "dinner" | "late";

export type EatSlot = {
  id: EatSlotId;
  label: string;
  timeLabel: string;
  bookTime: string;
  nearName: string;
  nearQuery: string;
  lat: number | null;
  lng: number | null;
  plannedTitle: string | null;
};

export type NearbyEat = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  amenity: string;
  cuisine: string | null;
  website: string | null;
  phone: string | null;
};

export type EatPin = NearbyEat & {
  tripKey: string;
  date: string;
  slot: EatSlotId;
};

const ANCHOR_SKIP = new Set(["transit", "flight", "rest", "hotel", "night_train"]);
const CACHE_KEY = "travier.nearby-eats.v1";
const PIN_KEY = "travier.eats.pins.v1";
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const CLUSTER_M = 800;

const SLOTS: {
  id: EatSlotId;
  label: string;
  timeLabel: string;
  bookTime: string;
  start: number;
  end: number;
}[] = [
  { id: "breakfast", label: "早餐", timeLabel: "10:30 前", bookTime: "08:30", start: 6 * 60, end: 10 * 60 + 30 },
  { id: "lunch", label: "午餐", timeLabel: "11:00–14:30", bookTime: "12:30", start: 11 * 60, end: 14 * 60 + 30 },
  { id: "snack", label: "下午茶", timeLabel: "14:30–17:15", bookTime: "15:30", start: 14 * 60 + 30, end: 17 * 60 + 15 },
  { id: "dinner", label: "晚餐", timeLabel: "17:30–21:30", bookTime: "19:00", start: 17 * 60 + 30, end: 21 * 60 + 30 },
  { id: "late", label: "宵夜", timeLabel: "21:30 後", bookTime: "21:30", start: 21 * 60 + 30, end: 24 * 60 },
];

const AMENITY_ZH: Record<string, string> = {
  restaurant: "餐廳",
  cafe: "咖啡",
  bakery: "麵包",
  fast_food: "快餐",
  bar: "酒吧",
  pub: "酒吧",
  ice_cream: "雪糕",
};

const CUISINE_ZH: Record<string, string> = {
  italian: "意大利菜",
  austrian: "奧地利菜",
  german: "德國菜",
  chinese: "中菜",
  japanese: "日本菜",
  french: "法國菜",
  pizza: "薄餅",
  seafood: "海鮮",
  cafe: "咖啡",
  coffee: "咖啡",
  bakery: "麵包",
  vegan: "素食",
  vegetarian: "素食",
  asian: "亞洲菜",
  thai: "泰國菜",
  korean: "韓國菜",
  indian: "印度菜",
  mediterranean: "地中海",
  spanish: "西班牙菜",
  greek: "希臘菜",
  turkish: "土耳其菜",
  american: "美式",
  burger: "漢堡",
  ice_cream: "雪糕",
  dessert: "甜品",
  wine: "葡萄酒",
  regional: "當地菜",
  breakfast: "早餐",
  international: "國際菜",
  ramen: "拉麵",
  sushi: "壽司",
  izakaya: "居酒屋",
  yakitori: "燒鳥",
  yakiniku: "燒肉",
  udon: "烏冬",
  soba: "蕎麥麵",
  tonkatsu: "吉列豬",
  okonomiyaki: "大阪燒",
  tempura: "天婦羅",
  kaiseki: "懷石",
};

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

type Anchor = {
  name: string;
  query: string;
  start: number;
  end: number;
  lat: number | null;
  lng: number | null;
  meal: boolean;
};

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

function sameArea(a: Anchor, b: Anchor): boolean {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) {
    return a.query.trim().toLowerCase() === b.query.trim().toLowerCase();
  }
  return haversine(a.lat, a.lng, b.lat, b.lng) <= CLUSTER_M;
}

function itemEnd(item: TimelineItem): number {
  if (!item.end) return toMinutes(item.start) + 45;
  const end = toMinutes(item.end);
  return item.endNextDay ? end + 24 * 60 : end;
}

function overlaps(item: Anchor, start: number, end: number): boolean {
  return item.start < end && item.end > start;
}

function anchorsOf(day: Day, points: Map<string, LatLng>, hotelQuery?: string | null): Anchor[] {
  const list: Anchor[] = [];
  for (const item of day.timeline) {
    const query = item.placeQuery.trim();
    const point = query ? points.get(query) : undefined;
    const meal = item.type === "meal";
    if (ANCHOR_SKIP.has(item.type)) continue;
    if (!meal && !query) continue;
    list.push({
      name: item.displayNameZh || item.title,
      query: query || day.stayCity,
      start: toMinutes(item.start),
      end: itemEnd(item),
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      meal,
    });
  }
  const hotel = hotelQuery?.trim();
  if (hotel) {
    const point = points.get(hotel);
    list.push({
      name: "今晚酒店",
      query: hotel,
      start: 21 * 60,
      end: 24 * 60,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
      meal: false,
    });
  }
  return list;
}

function pickAnchor(anchors: Anchor[], start: number, end: number, fallbacks: Anchor[]): Anchor | null {
  const hits = anchors.filter((item) => !item.meal && overlaps(item, start, end));
  const mid = (start + end) / 2;
  const ranked = (hits.length ? hits : fallbacks.filter((item) => !item.meal)).sort(
    (a, b) => Math.abs((a.start + a.end) / 2 - mid) - Math.abs((b.start + b.end) / 2 - mid),
  );
  return ranked[0] ?? fallbacks[0] ?? null;
}

function plannedMeal(anchors: Anchor[], start: number, end: number): string | null {
  const meal = anchors.find((item) => item.meal && overlaps(item, start, end));
  return meal?.name ?? null;
}

export function slotOfTime(start: string): EatSlotId {
  const minutes = toMinutes(start);
  const found = SLOTS.find((slot) => minutes >= slot.start && minutes < slot.end);
  if (found) return found.id;
  if (minutes < SLOTS[0].start) return "breakfast";
  return "late";
}

export function skipStopEats(type: string): boolean {
  return type === "flight" || type === "transit" || type === "night_train";
}

export function stopEatSlot(
  item: Pick<TimelineItem, "start" | "title" | "displayNameZh" | "placeQuery" | "type">,
  point?: LatLng | null,
): EatSlot {
  const id = slotOfTime(item.start);
  const meta = SLOTS.find((slot) => slot.id === id) ?? SLOTS[2];
  return {
    id,
    label: meta.label,
    timeLabel: meta.timeLabel,
    bookTime: meta.bookTime,
    nearName: item.displayNameZh || item.title,
    nearQuery: item.placeQuery.trim() || item.title,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    plannedTitle: item.type === "meal" ? item.displayNameZh || item.title : null,
  };
}

export function buildEatSlots(
  day: Day,
  points: Map<string, LatLng>,
  hotelQuery?: string | null,
): EatSlot[] {
  const anchors = anchorsOf(day, points, hotelQuery);
  if (!anchors.length && !day.stayCity) return [];

  const sights = anchors.filter((item) => !item.meal);
  const first = sights[0] ?? null;
  const lastSight = [...sights].reverse().find((item) => item.name !== "今晚酒店") ?? sights[sights.length - 1] ?? null;
  const cityFallback: Anchor = {
    name: day.stayCity === "in_transit" ? "今日停留" : day.stayCity || "今日停留",
    query: day.stayCity === "in_transit" ? lastSight?.query || day.stayCity : day.stayCity,
    start: first?.start ?? 12 * 60,
    end: lastSight?.end ?? 20 * 60,
    lat: first?.lat ?? lastSight?.lat ?? null,
    lng: first?.lng ?? lastSight?.lng ?? null,
    meal: false,
  };

  const lunch = pickAnchor(anchors, 11 * 60, 14 * 60 + 30, [first, cityFallback].filter(Boolean) as Anchor[]);
  const dinner = pickAnchor(anchors, 17 * 60 + 30, 21 * 60 + 30, [lastSight, cityFallback].filter(Boolean) as Anchor[]);
  const breakfast = pickAnchor(anchors, 6 * 60, 10 * 60 + 30, [first, cityFallback].filter(Boolean) as Anchor[]);
  const snack = pickAnchor(anchors, 14 * 60 + 30, 17 * 60 + 15, [lunch, cityFallback].filter(Boolean) as Anchor[]);
  const late = pickAnchor(anchors, 21 * 60 + 30, 24 * 60, [lastSight, dinner, cityFallback].filter(Boolean) as Anchor[]);
  const picked: Record<EatSlotId, Anchor | null> = { breakfast, lunch, snack, dinner, late };

  const showSnack =
    Boolean(snack && anchors.some((item) => !item.meal && overlaps(item, 14 * 60 + 30, 17 * 60 + 15))) ||
    Boolean(lunch && dinner && sameArea(lunch, dinner));
  const showBreakfast = Boolean(first && first.start < 11 * 60);
  const showLate = Boolean(
    lastSight && lastSight.end >= 21 * 60 + 30,
  ) || Boolean(anchors.some((item) => item.meal && item.start >= 21 * 60 + 30));

  return SLOTS.flatMap((meta) => {
    if (meta.id === "breakfast" && !showBreakfast) return [];
    if (meta.id === "snack" && !showSnack) return [];
    if (meta.id === "late" && !showLate) return [];
    const here = picked[meta.id] ?? cityFallback;
    if (!here) return [];
    return [
      {
        id: meta.id,
        label: meta.label,
        timeLabel: meta.timeLabel,
        bookTime: meta.bookTime,
        nearName: here.name,
        nearQuery: here.query || cityFallback.query,
        lat: here.lat,
        lng: here.lng,
        plannedTitle: plannedMeal(anchors, meta.start, meta.end),
      },
    ];
  });
}

export function amenityLabel(amenity: string): string {
  return AMENITY_ZH[amenity] || "食店";
}

export function cuisineLabel(cuisine: string | null): string | null {
  if (!cuisine) return null;
  const first = cuisine.split(/[;,]/)[0]?.trim().toLowerCase();
  if (!first) return null;
  return CUISINE_ZH[first] || first.replace(/_/g, " ");
}

export function walkMeters(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  return Math.round(haversine(fromLat, fromLng, toLat, toLng));
}

export function formatWalk(meters: number): string {
  if (meters < 80) return "就喺隔離";
  if (meters < 1000) return `步行約 ${meters} 米`;
  return `步行約 ${(meters / 1000).toFixed(1)} 公里`;
}

export function defaultEatSlot(slots: EatSlot[], date: string, now = new Date()): EatSlotId {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (date === today) {
    const minutes = now.getHours() * 60 + now.getMinutes();
    const current = SLOTS.find((slot) => minutes >= slot.start && minutes < slot.end);
    if (current && slots.some((item) => item.id === current.id)) return current.id;
    const next = SLOTS.find((slot) => minutes < slot.start && slots.some((item) => item.id === slot.id));
    if (next) return next.id;
  }
  return slots.find((item) => item.id === "lunch")?.id ?? slots[0]?.id ?? "lunch";
}

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function readNearbyCache(): Record<string, { at: number; places: NearbyEat[] }> {
  return loadJson(CACHE_KEY, {});
}

export function nearbyFromCache(lat: number, lng: number): NearbyEat[] | null {
  const hit = readNearbyCache()[cacheKey(lat, lng)];
  if (!hit || Date.now() - hit.at > CACHE_MS) return null;
  return hit.places;
}

function writeNearbyCache(lat: number, lng: number, places: NearbyEat[]): void {
  const all = readNearbyCache();
  all[cacheKey(lat, lng)] = { at: Date.now(), places };
  localStorage.setItem(CACHE_KEY, JSON.stringify(all));
}

function parseOverpass(json: {
  elements?: {
    id: number;
    type: string;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
  }[];
}): NearbyEat[] {
  const places: NearbyEat[] = [];
  const seen = new Set<string>();
  for (const el of json.elements ?? []) {
    const name = el.tags?.name?.trim() || el.tags?.["name:en"]?.trim() || el.tags?.["name:zh"]?.trim();
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!name || lat == null || lng == null) continue;
    const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push({
      id: `${el.type}/${el.id}`,
      name,
      lat,
      lng,
      amenity: el.tags?.amenity || "restaurant",
      cuisine: el.tags?.cuisine || null,
      website: el.tags?.website || el.tags?.["contact:website"] || null,
      phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
    });
  }
  return places;
}

async function overpassAt(url: string, query: string): Promise<NearbyEat[] | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) return null;
  return parseOverpass((await res.json()) as Parameters<typeof parseOverpass>[0]);
}

export async function fetchNearbyEats(lat: number, lng: number): Promise<NearbyEat[]> {
  const cached = nearbyFromCache(lat, lng);
  if (cached) return cached;
  const query = `[out:json][timeout:20];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pub|bakery|ice_cream)$"](around:450,${lat},${lng});
);
out center tags 40;`;
  for (const url of OVERPASS) {
    try {
      const places = await overpassAt(url, query);
      if (places) {
        writeNearbyCache(lat, lng, places);
        return places;
      }
    } catch {
      /* try next mirror */
    }
  }
  return [];
}

const SLOT_PREF: Record<EatSlotId, string[]> = {
  breakfast: ["cafe", "bakery", "restaurant"],
  lunch: ["restaurant", "cafe", "fast_food"],
  snack: ["cafe", "bakery", "ice_cream", "restaurant"],
  dinner: ["restaurant", "bar", "pub"],
  late: ["bar", "pub", "restaurant", "fast_food"],
};

export function rankEats(places: NearbyEat[], slot: EatSlot, limit = 6): NearbyEat[] {
  if (slot.lat == null || slot.lng == null) return places.slice(0, limit);
  const pref = SLOT_PREF[slot.id];
  return [...places]
    .filter((place) => haversine(slot.lat!, slot.lng!, place.lat, place.lng) <= 550)
    .sort((a, b) => {
      const pa = pref.indexOf(a.amenity);
      const pb = pref.indexOf(b.amenity);
      const sa = pa === -1 ? 9 : pa;
      const sb = pb === -1 ? 9 : pb;
      if (sa !== sb) return sa - sb;
      return (
        haversine(slot.lat!, slot.lng!, a.lat, a.lng) - haversine(slot.lat!, slot.lng!, b.lat, b.lng)
      );
    })
    .slice(0, limit);
}

export function tripEatKey(title: string, startDate: string, endDate: string): string {
  return `${title}|${startDate}|${endDate}`;
}

export function loadEatPins(tripKey: string, date: string): EatPin[] {
  return loadJson<EatPin[]>(PIN_KEY, []).filter((pin) => pin.tripKey === tripKey && pin.date === date);
}

export function toggleEatPin(pin: EatPin): EatPin[] {
  const all = loadJson<EatPin[]>(PIN_KEY, []);
  const exists = all.some((item) => item.tripKey === pin.tripKey && item.id === pin.id && item.date === pin.date);
  const next = exists
    ? all.filter((item) => !(item.tripKey === pin.tripKey && item.id === pin.id && item.date === pin.date))
    : [...all, pin];
  localStorage.setItem(PIN_KEY, JSON.stringify(next));
  return next.filter((item) => item.tripKey === pin.tripKey && item.date === pin.date);
}

export function isPinned(pins: EatPin[], id: string): boolean {
  return pins.some((pin) => pin.id === id);
}
