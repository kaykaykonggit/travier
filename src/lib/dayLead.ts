import type { Day } from "../types";
import { cityZh } from "./labels";

const SKIP = new Set(["transit", "flight", "meal", "hotel", "rest"]);

/** 日子軸上的重頭戲：必看景點／最高星亮點／當日標題，避免只看到日期。 */
export function dayHeadline(day: Day): string {
  const must = day.timeline.find((item) => item.mustSee && !SKIP.has(item.type));
  if (must) return must.displayNameZh || must.title;
  const ranked = [...day.highlights].sort((a, b) => b.stars - a.stars);
  if (ranked[0]?.name) return ranked[0].name;
  if (day.title.trim()) return day.title.trim();
  return dayPlace(day);
}

export function dayPlace(day: Day): string {
  if (day.stayCity === "in_transit") return "移動中";
  return cityZh(day.stayCity);
}

export function shortPlace(day: Day): string {
  const place = dayPlace(day);
  if (place === "移動中") return "移動";
  return place.length > 4 ? place.slice(0, 4) : place;
}
