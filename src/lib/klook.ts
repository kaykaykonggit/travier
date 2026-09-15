import { cityZh } from "./labels";
import { klookUrl, withKlookDate } from "./links";
import type { KlookItem, TimelineItem } from "../types";

const SKIP_TYPES = new Set(["meal", "flight", "hotel", "transit", "rest", "free", "night_train"]);

/** Latin / local country names → zh-HK label for Klook free-text search. */
const COUNTRY_ZH: Record<string, string> = {
  japan: "日本",
  日本: "日本",
  austria: "奧地利",
  奧地利: "奧地利",
  italy: "意大利",
  意大利: "意大利",
  義大利: "意大利",
  france: "法國",
  法國: "法國",
  germany: "德國",
  德國: "德國",
  spain: "西班牙",
  西班牙: "西班牙",
  switzerland: "瑞士",
  瑞士: "瑞士",
  "hong kong": "香港",
  香港: "香港",
  china: "中國",
  中國: "中國",
  taiwan: "台灣",
  台灣: "台灣",
  臺灣: "台灣",
  korea: "韓國",
  "south korea": "韓國",
  韓國: "韓國",
  "united states": "美國",
  usa: "美國",
  美國: "美國",
  "united kingdom": "英國",
  uk: "英國",
  英國: "英國",
  "vatican city": "梵蒂岡",
  梵蒂岡: "梵蒂岡",
};

const OKINAWA_CITIES = new Set([
  "naha",
  "nago",
  "onna",
  "motobu",
  "nakijin",
  "ginoza",
  "kin",
  "uruma",
  "nanjo",
  "ginowan",
  "urasoe",
  "okinawa",
  "chatan",
  "ishigaki",
  "那覇",
  "那霸",
  "名護",
  "恩納",
  "本部",
  "今帰仁",
  "宜野座",
  "金武",
  "うるま",
  "南城",
  "宜野湾",
  "宜野灣",
  "浦添",
  "沖縄",
  "沖繩",
  "北谷",
  "石垣",
]);

type PlaceBits = {
  name: string;
  city: string | null;
  /** Prefecture / region when placeQuery is Name, City, Region, Country. */
  region: string | null;
  country: string | null;
};

function parsePlaceBits(placeQuery: string): PlaceBits {
  const parts = placeQuery.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return {
      name: parts.slice(0, -3).join(", "),
      city: parts[parts.length - 3],
      region: parts[parts.length - 2],
      country: parts[parts.length - 1],
    };
  }
  if (parts.length === 3) {
    return { name: parts[0], city: parts[1], region: null, country: parts[2] };
  }
  if (parts.length === 2) {
    const second = parts[1];
    if (COUNTRY_ZH[second.toLowerCase()] || COUNTRY_ZH[second]) {
      return { name: parts[0], city: null, region: null, country: second };
    }
    return { name: parts[0], city: second, region: null, country: null };
  }
  return { name: placeQuery.trim(), city: null, region: null, country: null };
}

function countryLabelOf(country: string | null | undefined): string {
  if (!country?.trim()) return "";
  const raw = country.trim();
  return COUNTRY_ZH[raw.toLowerCase()] || COUNTRY_ZH[raw] || raw;
}

function isOkinawaPlace(bits: PlaceBits): boolean {
  const city = bits.city?.trim() ?? "";
  const region = bits.region?.trim() ?? "";
  if (OKINAWA_CITIES.has(city.toLowerCase()) || OKINAWA_CITIES.has(city)) return true;
  if (/okinawa|沖繩|沖縄/i.test(region) || /okinawa|沖繩|沖縄/i.test(city)) return true;
  return false;
}

/**
 * Destination prefix for Klook search: country first, then region/city when needed
 * (e.g. 「日本 沖繩」so 琉球村 does not match Taiwan activities).
 */
export function klookDestinationPrefix(placeQuery: string, fallbackCountry?: string | null): string {
  const bits = parsePlaceBits(placeQuery);
  const countryZh = countryLabelOf(bits.country) || countryLabelOf(fallbackCountry);
  const parts: string[] = [];
  if (countryZh) parts.push(countryZh);

  if (countryZh === "日本" && isOkinawaPlace(bits)) {
    parts.push("沖繩");
  } else if (bits.city) {
    const cityLabel = cityZh(bits.city);
    if (cityLabel && cityLabel !== countryZh && !parts.includes(cityLabel)) parts.push(cityLabel);
  }

  return parts.join(" ").trim();
}

/** Ensure search text starts with country (and Okinawa region when relevant). */
export function withKlookCountry(
  searchQuery: string,
  placeQuery: string,
  fallbackCountry?: string | null,
): string {
  const theme = searchQuery.trim().replace(/\s+/g, " ");
  if (!theme) return klookDestinationPrefix(placeQuery, fallbackCountry);
  const prefix = klookDestinationPrefix(placeQuery, fallbackCountry);
  if (!prefix) return theme;

  const lower = theme.toLowerCase();
  const prefixParts = prefix.split(/\s+/);
  // Already starts with the same country / destination tokens.
  if (prefixParts.every((part) => lower.includes(part.toLowerCase()))) {
    // Prefer prefix-first ordering when country is buried mid-query.
    if (lower.startsWith(prefixParts[0].toLowerCase())) return theme;
  }
  return `${prefix} ${theme}`.replace(/\s+/g, " ").trim();
}

export function isKlookable(item: TimelineItem): boolean {
  if (SKIP_TYPES.has(item.type)) return false;
  if (item.ticket.cost.amount != null && item.ticket.cost.amount > 0) return true;
  return item.type === "activity";
}

/** Theme keywords only — no ticket labels like「成人門票x6」(those dilute location signal). */
export function klookSearchText(item: TimelineItem, fallbackCountry?: string | null): string {
  const name = (item.displayNameZh || item.title || parsePlaceBits(item.placeQuery).name || item.placeQuery).trim();
  return withKlookCountry(name, item.placeQuery, fallbackCountry);
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

export function klookHref(item: TimelineItem, match: KlookItem | null, date: string, adults = 1, fallbackCountry?: string | null): string {
  const source = match?.cost.source || item.ticket.cost.source;
  if (source?.includes("klook.com")) return withKlookDate(source, date);
  const query = withKlookCountry(
    match?.searchQuery || klookSearchText(item, fallbackCountry),
    match?.placeQuery || item.placeQuery,
    fallbackCountry,
  );
  return klookUrl(query, date, adults);
}

export function dayKlookItems(
  dayDate: string,
  listed: KlookItem[],
  timeline: TimelineItem[],
  fallbackCountry?: string | null,
): KlookItem[] {
  const enrichedListed = listed.map((item) => ({
    ...item,
    searchQuery: withKlookCountry(item.searchQuery || item.name, item.placeQuery, fallbackCountry),
  }));
  const extra = timeline.filter(isKlookable).flatMap((item) => {
    if (matchKlook(enrichedListed, item)) return [];
    return [
      {
        date: dayDate,
        name: item.displayNameZh || item.title,
        searchQuery: klookSearchText(item, fallbackCountry),
        placeQuery: item.placeQuery,
        cost: item.ticket.cost,
      },
    ];
  });
  return [...enrichedListed, ...extra];
}
