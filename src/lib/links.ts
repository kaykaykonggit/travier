import type { Transport } from "../types";
import { tripCityId } from "./tripCities";

type GuestStay = {
  checkIn: string;
  checkOut: string;
  adults: number;
  children?: number;
  lat?: number | null;
  lng?: number | null;
};

function guestCount(adults: number, children = 0) {
  return {
    adult: String(Math.max(1, adults)),
    children: String(Math.max(0, children)),
    crn: "1",
  };
}

function tripStayParams(stay: GuestStay): URLSearchParams {
  const params = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    ...guestCount(stay.adults, stay.children),
    locale: "zh-HK",
    curr: "HKD",
  });
  if (stay.lat != null && stay.lng != null) {
    params.set("lat", stay.lat.toFixed(6));
    params.set("lon", stay.lng.toFixed(6));
  }
  return params;
}

function withTripCity(params: URLSearchParams, city: string): void {
  const cityId = tripCityId(city);
  params.set("cityName", city);
  params.set("destName", city);
  params.set("display", city);
  if (cityId != null) {
    params.set("city", String(cityId));
    params.set("optionId", String(cityId));
    params.set("optionType", "City");
  }
}

export function googleFlightsUrl(from: string, to: string, date?: string | null, adults = 1): string {
  const parts = [
    from && to ? `Flights from ${placeLabel(from)} to ${placeLabel(to)}` : "Flights",
    date ? `on ${date}` : "",
    adults > 1 ? `${adults} adults` : "",
  ].filter(Boolean);
  const params = new URLSearchParams({
    hl: "zh-TW",
    curr: "HKD",
    q: parts.join(" "),
  });
  return `https://www.google.com/travel/flights?${params.toString()}`;
}

function cleanHotelQuery(value: string): string {
  return value
    .replace(/^hotels near /i, "")
    .replace(/\+/g, " ")
    .split(",")[0]
    ?.trim() || "";
}

/** 從 Google / Trip.com 連結抽出店名；不是網址就當店名。 */
export function parseHotelPaste(raw: string): { name: string; source: string | null } {
  const text = raw.trim();
  if (!text) return { name: "", source: null };
  try {
    const url = new URL(text);
    const fromParam =
      url.searchParams.get("q") ||
      url.searchParams.get("query") ||
      url.searchParams.get("searchWord") ||
      url.searchParams.get("destName") ||
      url.searchParams.get("hotelName");
    if (fromParam) {
      const name = cleanHotelQuery(fromParam);
      if (name) return { name, source: text };
    }
    const dest = url.searchParams.get("destination");
    if (dest) {
      const name = cleanHotelQuery(dest);
      if (name) return { name, source: text };
    }
    const placePath = url.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/);
    if (placePath?.[1]) {
      const name = cleanHotelQuery(decodeURIComponent(placePath[1]));
      if (name) return { name, source: text };
    }
    const dirPath = url.pathname.match(/\/maps\/dir\/([^/]+)\/([^/@]+)/);
    if (dirPath?.[2]) {
      const name = cleanHotelQuery(decodeURIComponent(dirPath[2]));
      if (name) return { name, source: text };
    }
    const trip = url.pathname.match(/\/hotels\/(?:detail\/)?([^/?]+)/);
    if (trip?.[1] && !["list", "search", "city"].includes(trip[1].toLowerCase())) {
      const name = cleanHotelQuery(decodeURIComponent(trip[1]).replace(/-/g, " "));
      if (name) return { name, source: text };
    }
  } catch {
    /* 不是網址 */
  }
  return { name: text, source: null };
}

export function googleSearchUrl(placeQuery: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;
}

/** 從此點出發的路線：可在附近找下一站，或直接輸入目的地。 */
export function googleDirExploreUrl(origin: string): string {
  const params = new URLSearchParams({
    api: "1",
    origin,
    travelmode: "walking",
    hl: "zh-TW",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function looksLikeMapsLink(raw: string): boolean {
  return /google\.[^/\s]+\/maps|maps\.app\.goo\.gl|maps\.google\./i.test(raw);
}

export function googleHotelsNearUrl(placeQuery: string, lat?: number | null, lng?: number | null): string {
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/Hotels/@${lat},${lng},15z`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`hotels near ${placeQuery}`)}`;
}

export function googleEmbedUrl(query: string, lat?: number | null, lng?: number | null, zoom = 15): string {
  const q = lat != null && lng != null ? `${lat},${lng}` : query;
  const params = new URLSearchParams({
    q,
    hl: "zh-TW",
    z: String(zoom),
    output: "embed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

export function googleHotelsEmbedUrl(placeQuery: string, lat?: number | null, lng?: number | null): string {
  const q = lat != null && lng != null ? `hotels near ${lat},${lng}` : `hotels near ${placeQuery}`;
  return googleEmbedUrl(q, null, null, 15);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function hexByte(value: number): string {
  return value.toString(16).padStart(2, "0");
}

function varintYear(year: number): string {
  return hexByte((year & 0x7f) | 0x80) + hexByte(year >> 7);
}

/** Google Hotels 真正認的日期：protobuf `ts`，不是 checkin= 查詢字。 */
export function googleHotelTs(checkIn: string, checkOut: string): string {
  const [ciY, ciM, ciD] = checkIn.split("-").map(Number);
  const [coY, coM, coD] = checkOut.split("-").map(Number);
  const nights = nightsBetween(checkIn, checkOut);
  const hex =
    "08011a200a021a00121a12140a0708" +
    varintYear(ciY) +
    "10" +
    hexByte(ciM) +
    "18" +
    hexByte(ciD) +
    "120708" +
    varintYear(coY) +
    "10" +
    hexByte(coM) +
    "18" +
    hexByte(coD) +
    "18" +
    hexByte(nights) +
    "32020801";
  const bytes = hex.match(/.{2}/g)?.map((part) => Number.parseInt(part, 16)) ?? [];
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "");
}

function googleStayParams(
  query: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  lat?: number | null,
  lng?: number | null,
): URLSearchParams {
  const params = new URLSearchParams({
    q: query,
    hl: "zh-TW",
    gl: "hk",
    curr: "HKD",
    qs: "CAE4AA",
    ts: googleHotelTs(checkIn, checkOut),
    ap: "MAE",
    adults: String(Math.max(1, adults)),
  });
  if (lat != null && lng != null) params.set("rllat", String(lat));
  if (lat != null && lng != null) params.set("rllng", String(lng));
  return params;
}

export function googleHotelsLiveUrl(
  placeQuery: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  lat?: number | null,
  lng?: number | null,
): string {
  return `https://www.google.com/travel/search?${googleStayParams(`hotels near ${placeQuery}`, checkIn, checkOut, adults, lat, lng)}`;
}

export function googleHotelStayUrl(
  placeQuery: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  lat?: number | null,
  lng?: number | null,
): string {
  return `https://www.google.com/travel/search?${googleStayParams(placeQuery, checkIn, checkOut, adults, lat, lng)}`;
}

function mapsTravelMode(mode: string): string {
  if (mode === "walk") return "walking";
  if (mode === "taxi" || mode === "private_car") return "driving";
  if (mode === "flight") return "driving";
  return "transit";
}

function mapsDirFlag(mode: string): string {
  const travel = mapsTravelMode(mode);
  if (travel === "walking") return "w";
  if (travel === "driving") return "d";
  return "r";
}

function withCityHint(stop: string, placeQuery: string): string {
  if (stop.includes(",")) return stop;
  const parts = placeQuery.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts.length >= 2 ? parts[parts.length - 2] : parts[1];
  return city ? `${stop}, ${city}` : stop;
}

export function transitOrigin(transport: Transport): string {
  const stop = transport.fromStop?.trim();
  if (stop) return withCityHint(stop, transport.fromPlaceQuery || transport.toPlaceQuery);
  return transport.fromPlaceQuery.trim();
}

export function transitDestination(transport: Transport): string {
  const stop = transport.toStop?.trim();
  if (stop) return withCityHint(stop, transport.toPlaceQuery || transport.fromPlaceQuery);
  return transport.toPlaceQuery.trim();
}

export function googleDirUrl(transport: Transport): string {
  const params = new URLSearchParams({
    api: "1",
    origin: transitOrigin(transport),
    destination: transitDestination(transport),
    travelmode: mapsTravelMode(transport.mode),
    hl: "zh-TW",
  });
  return `https://www.google.com/maps/dir/?api=1&${params.toString()}`;
}

export function googleDirEmbedUrl(transport: Transport): string {
  const params = new URLSearchParams({
    saddr: transitOrigin(transport),
    daddr: transitDestination(transport),
    hl: "zh-TW",
    dirflg: mapsDirFlag(transport.mode),
    output: "embed",
  });
  return `https://maps.google.com/maps?${params.toString()}`;
}

export function canEmbedDirections(transport: Transport): boolean {
  const from = transitOrigin(transport);
  const to = transitDestination(transport);
  if (!from || !to || from === to) return false;
  return transport.mode !== "flight";
}

export function stopLabel(value: string | null, fallback: string): string {
  return (value?.trim() || placeLabel(fallback) || fallback).trim();
}

export function placeLabel(placeQuery: string): string {
  return placeQuery.split(",")[0]?.trim() || placeQuery.trim();
}

export function tripPlaceUrl(
  placeQuery: string,
  city: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children = 0,
  lat?: number | null,
  lng?: number | null,
): string {
  const params = tripStayParams({ checkIn, checkOut, adults, children, lat, lng });
  withTripCity(params, city);
  const label = placeLabel(placeQuery) || city;
  params.set("searchWord", label);
  params.set("destName", label);
  params.set("display", label);
  params.set("searchBoxArg", "t");
  return `https://hk.trip.com/hotels/list?${params.toString()}`;
}

export function tripHotelUrl(
  name: string,
  city: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children = 0,
  lat?: number | null,
  lng?: number | null,
): string {
  const params = tripStayParams({ checkIn, checkOut, adults, children, lat, lng });
  withTripCity(params, city);
  params.set("searchWord", name);
  params.set("searchType", "N");
  params.set("searchBoxArg", "t");
  return `https://hk.trip.com/hotels/list?${params.toString()}`;
}

export function tripCityUrl(
  city: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children = 0,
  lat?: number | null,
  lng?: number | null,
): string {
  const params = tripStayParams({ checkIn, checkOut, adults, children, lat, lng });
  withTripCity(params, city);
  params.set("searchType", "CT");
  params.set("searchBoxArg", "t");
  return `https://hk.trip.com/hotels/list?${params.toString()}`;
}

export function withKlookDate(url: string, date?: string | null): string {
  if (!date || !url.includes("klook.com")) return url;
  try {
    const next = new URL(url);
    next.searchParams.set("date", date);
    next.searchParams.set("start_date", date);
    next.searchParams.set("end_date", date);
    return next.toString();
  } catch {
    return url;
  }
}

export function klookUrl(query: string, date?: string | null, adults?: number): string {
  const params = new URLSearchParams({
    query,
    search_scope: "main_search",
  });
  if (date) {
    params.set("start_date", date);
    params.set("end_date", date);
    params.set("date", date);
  }
  if (adults && adults > 0) params.set("participants", String(adults));
  return `https://www.klook.com/zh-HK/search/result/?${params.toString()}`;
}

export function googleFoodNearUrl(kind: "restaurants" | "cafes" | "bars", lat: number, lng: number): string {
  return `https://www.google.com/maps/search/${kind}/@${lat},${lng},16z`;
}

export function googleFoodSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function googleReserveSearchUrl(name: string, city: string): string {
  return `https://www.google.com/search?hl=zh-HK&q=${encodeURIComponent(`${name} ${city} 訂位 reservation`)}`;
}

export function theForkSearchUrl(query: string): string {
  return `https://www.thefork.com/search?searchText=${encodeURIComponent(query)}`;
}

export function openTableSearchUrl(query: string, covers: number, date?: string, time?: string): string {
  const params = new URLSearchParams({
    covers: String(Math.max(1, covers)),
    term: query,
  });
  if (date) params.set("dateTime", `${date}T${time || "19:00"}`);
  return `https://www.opentable.com/s?${params.toString()}`;
}
