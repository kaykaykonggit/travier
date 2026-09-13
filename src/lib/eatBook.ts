import type { Day } from "../types";
import { openTableSearchUrl, theForkSearchUrl } from "./links";

export type EatRegion = "japan" | "europe" | "other";

export type BookLink = {
  label: string;
  href: string;
};

const JAPAN_RE =
  /japan|日本|tokyo|osaka|kyoto|hokkaido|okinawa|fukuoka|nagoya|yokohama|sapporo|nara|hiroshima|kanazawa|nikko|hakone|sendai|kobe|nagasaki|kamakura|takayama|大阪|京都|東京|北海道|沖繩|沖縄|福岡|名古屋|橫濱|横浜|札幌|奈良|廣島|広島|金澤|日光|箱根|\bjpy\b/i;

const EUROPE_RE =
  /austria|italy|france|spain|germany|portugal|belgium|netherlands|switzerland|greece|czech|hungary|poland|sweden|denmark|norway|finland|ireland|vienna|rome|milan|florence|venice|paris|barcelona|madrid|munich|berlin|amsterdam|lisbon|prague|budapest|維也納|羅馬|米蘭|佛羅倫薩|威尼斯|巴黎|奧地利|意大利|法國/i;

export function eatRegionOf(day: Day, ...hints: string[]): EatRegion {
  const blob = [day.stayCity, day.title, ...day.countries, ...hints].join(" ");
  if (JAPAN_RE.test(blob)) return "japan";
  if (EUROPE_RE.test(blob)) return "europe";
  return "other";
}

export function tabelogSearchUrl(query: string, lat?: number | null, lng?: number | null): string {
  const params = new URLSearchParams({ sw: query, vs: "1" });
  if (lat != null && lng != null) {
    params.set("lat", lat.toFixed(5));
    params.set("lon", lng.toFixed(5));
  }
  return `https://tabelog.com/rstLst/?${params.toString()}`;
}

export function hotPepperSearchUrl(query: string): string {
  return `https://www.hotpepper.jp/CSP/psh010/doBasic?FWT=${encodeURIComponent(query)}`;
}

export function gurunaviSearchUrl(query: string): string {
  return `https://r.gnavi.co.jp/search/?fw=${encodeURIComponent(query)}`;
}

export function ikyuSearchUrl(query: string): string {
  return `https://restaurant.ikyu.com/search?keyword=${encodeURIComponent(query)}`;
}

export function tableCheckSearchUrl(query: string): string {
  return `https://www.tablecheck.com/en/shops?q=${encodeURIComponent(query)}`;
}

export function placeBookLinks(
  name: string,
  city: string,
  region: EatRegion,
  covers: number,
  date: string,
  time: string,
): BookLink[] {
  const q = `${name} ${city}`.trim();
  if (region === "japan") {
    return [
      { label: "Tabelog", href: tabelogSearchUrl(q) },
      { label: "ホットペッパー", href: hotPepperSearchUrl(q) },
    ];
  }
  return [
    { label: "TheFork", href: theForkSearchUrl(q) },
    { label: "OpenTable", href: openTableSearchUrl(q, covers, date, time) },
  ];
}

export function areaBookLinks(
  query: string,
  region: EatRegion,
  covers: number,
  date: string,
  time: string,
  lat?: number | null,
  lng?: number | null,
): BookLink[] {
  if (region === "japan") {
    return [
      { label: "Tabelog 呢帶", href: tabelogSearchUrl(query, lat, lng) },
      { label: "ホットペッパー", href: hotPepperSearchUrl(query) },
      { label: "ぐるなび", href: gurunaviSearchUrl(query) },
      { label: "一休", href: ikyuSearchUrl(query) },
      { label: "TableCheck", href: tableCheckSearchUrl(query) },
    ];
  }
  return [
    { label: "TheFork 訂位", href: theForkSearchUrl(query) },
    { label: "OpenTable", href: openTableSearchUrl(query, covers, date, time) },
  ];
}
