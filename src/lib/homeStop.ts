import type { TimelineItem, Trip } from "../types";

/** 出發地／回程機場，不應出現在旅遊國總地圖上。 */
export function isHomeAirportStop(item: TimelineItem, origin: Trip["origin"]): boolean {
  const blob = [
    item.placeQuery,
    item.title,
    item.displayNameZh,
    item.transport.fromPlaceQuery,
    item.transport.toPlaceQuery,
  ]
    .join(" ")
    .toLowerCase();
  const keys = [origin.city, origin.iata, origin.country].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());
  const mentionsHome = keys.some((key) => key.length >= 2 && blob.includes(key));
  const airport = /airport|機場|chek lap kok|hkg\b/.test(blob);
  if (item.type === "flight" || item.transport.mode === "flight") return mentionsHome;
  return mentionsHome && airport;
}
