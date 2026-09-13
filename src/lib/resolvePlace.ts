import { looksLikeMapsLink, parseHotelPaste } from "./links";
import { lookupPlacePhotos, osmTileUrl } from "./placePhoto";

export type ResolvedPlace = {
  name: string;
  placeQuery: string;
  source: string | null;
  lat?: number;
  lng?: number;
  imageUrl?: string | null;
};

function decodeName(raw: string): string {
  return decodeURIComponent(raw.replace(/\+/g, " "))
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[·|].*$/, "")
    .replace(/\s*-\s*Google Maps.*$/i, "")
    .trim();
}

export function parseExpandedMapsUrl(url: string): ResolvedPlace | null {
  try {
    const parsed = new URL(url);
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const lat = at ? Number(at[1]) : undefined;
    const lng = at ? Number(at[2]) : undefined;
    const dest = parsed.searchParams.get("destination") || parsed.searchParams.get("q") || parsed.searchParams.get("query");
    const path = parsed.pathname.match(/\/maps\/(?:place|search)\/([^/@]+)/);
    const dir = parsed.pathname.match(/\/maps\/dir\/(?:[^/]+\/)?([^/@]+)/);
    const raw = dest || path?.[1] || dir?.[1] || "";
    const name = decodeName(raw);
    if (!name || /^https?:/i.test(name) || name === "dir") return lat != null ? { name: `${lat.toFixed(4)}, ${lng!.toFixed(4)}`, placeQuery: `${lat},${lng}`, source: url, lat, lng } : null;
    return { name, placeQuery: name, source: url, lat, lng };
  } catch {
    return null;
  }
}

export function isShortMapsUrl(raw: string): boolean {
  return /maps\.app\.goo\.gl|goo\.gl\/maps/i.test(raw);
}

export function isBareUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export async function resolvePlaceInput(raw: string, cityHint = ""): Promise<ResolvedPlace | null> {
  const text = raw.trim();
  if (!text) return null;

  if (isShortMapsUrl(text) || (looksLikeMapsLink(text) && !/\/maps\/place\//i.test(text))) {
    try {
      const res = await fetch(`/api/resolve-maps?url=${encodeURIComponent(text)}`);
      if (res.ok) {
        const data = (await res.json()) as ResolvedPlace & { error?: string };
        if (data.name && !isBareUrl(data.name)) {
          const placeQuery = cityHint && !data.name.includes(",") ? `${data.name}, ${cityHint}` : data.placeQuery || data.name;
          return { ...data, placeQuery };
        }
      }
    } catch {
      /* 本機 Vite 沒有這個 API */
    }
  }

  const fromUrl = parseExpandedMapsUrl(text);
  if (fromUrl && !isBareUrl(fromUrl.name)) {
    const placeQuery = cityHint && !fromUrl.name.includes(",") ? `${fromUrl.name}, ${cityHint}` : fromUrl.placeQuery;
    return { ...fromUrl, placeQuery };
  }

  const pasted = parseHotelPaste(text);
  if (!pasted.name || isBareUrl(pasted.name) || isShortMapsUrl(pasted.name)) return null;
  const placeQuery = cityHint && !pasted.name.includes(",") ? `${pasted.name}, ${cityHint}` : pasted.name;
  return { name: pasted.name, placeQuery, source: pasted.source };
}

export async function wikipediaThumb(query: string): Promise<string | null> {
  if (!query.trim() || isBareUrl(query)) return null;
  const urls = await lookupPlacePhotos({ query, title: query.split(",")[0] ?? query });
  return urls.find((url) => !url.includes("tile.openstreetmap.org")) ?? urls[0] ?? null;
}

export function staticMapUrl(lat: number, lng: number): string {
  return osmTileUrl(lat, lng);
}
