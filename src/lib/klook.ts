import { klookUrl, withKlookDate } from "./links";
import type { KlookItem, TimelineItem } from "../types";

const SKIP_TYPES = new Set(["meal", "flight", "hotel", "transit", "rest", "free", "night_train"]);

export function isKlookable(item: TimelineItem): boolean {
  if (SKIP_TYPES.has(item.type)) return false;
  if (item.ticket.cost.amount != null && item.ticket.cost.amount > 0) return true;
  return item.type === "activity";
}

export function klookSearchText(item: TimelineItem): string {
  const ticket = item.ticket.name?.trim() ?? "";
  if (ticket && !/^free/i.test(ticket)) return `${ticket} ${item.displayNameZh || item.title}`.trim();
  return (item.displayNameZh || item.title || item.placeQuery).trim();
}

export function matchKlook(klooks: KlookItem[], item: TimelineItem): KlookItem | null {
  const place = item.placeQuery.trim().toLowerCase();
  const names = [item.title, item.displayNameZh, item.ticket.name].map((n) => n?.trim().toLowerCase()).filter(Boolean);
  return (
    klooks.find((k) => {
      const kPlace = k.placeQuery.trim().toLowerCase();
      const kName = k.name.trim().toLowerCase();
      const kQuery = k.searchQuery.trim().toLowerCase();
      if (place && kPlace && kPlace === place) return true;
      if (names.includes(kName)) return true;
      return names.some((name) => name && (kQuery.includes(name) || name.includes(kName)));
    }) ?? null
  );
}

export function klookHref(item: TimelineItem, match: KlookItem | null, date: string, adults = 1): string {
  const source = match?.cost.source || item.ticket.cost.source;
  if (source?.includes("klook.com")) return withKlookDate(source, date);
  return klookUrl(match?.searchQuery || klookSearchText(item), date, adults);
}

export function dayKlookItems(dayDate: string, listed: KlookItem[], timeline: TimelineItem[]): KlookItem[] {
  const extra = timeline.filter(isKlookable).flatMap((item) => {
    if (matchKlook(listed, item)) return [];
    return [
      {
        date: dayDate,
        name: item.displayNameZh || item.title,
        searchQuery: klookSearchText(item),
        placeQuery: item.placeQuery,
        cost: item.ticket.cost,
      },
    ];
  });
  return [...listed, ...extra];
}
