import type { TimelineItem } from "../types";
import { cityZh } from "./labels";

const POI_HINT =
  /airport|bahnhof|station|palace|cathedral|church|museum|opera|castle|temple|shrine|beach|park|market|cafe|café|restaurant|hotel|dom|kirche|basilica|gallery|tower|bridge|garden|zoo|aquarium|harbour|harbor|pier|terminal|大學|机场|機場|車站|教堂|博物館|宮殿|城堡|公園|海灘|酒店/i;

const AREA_HINT =
  /stadt|district|quartier|arrondissement|centro|centre|center|altstadt|old town|historic|innere|prater|duomo|trastevere|monti|navigli|zona|區|市中心|老城|站前/i;

export type StopPlace = {
  city: string;
  area: string;
  label: string;
  key: string;
};

function partsOf(query: string): string[] {
  return query
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function looksLikeArea(name: string, city = ""): boolean {
  if (!name) return false;
  if (city && name.toLowerCase().includes(city.toLowerCase())) return false;
  if (POI_HINT.test(name)) return false;
  if (AREA_HINT.test(name)) return true;
  return name.length <= 22 && !/\d/.test(name) && name.split(/\s+/).length <= 3;
}

export function parsePlaceQuery(query: string, fallbackCity = ""): { name: string; city: string; country: string } {
  const parts = partsOf(query);
  if (parts.length >= 3) {
    return { name: parts[0], city: parts[parts.length - 2], country: parts[parts.length - 1] };
  }
  if (parts.length === 2) return { name: parts[0], city: parts[1], country: "" };
  if (parts.length === 1) return { name: parts[0], city: fallbackCity, country: "" };
  return { name: "", city: fallbackCity === "in_transit" ? "" : fallbackCity, country: "" };
}

export function placeBreakLabel(place: StopPlace): string {
  if (place.label.includes("→")) return place.label;
  return cityZh(place.city) || place.label;
}

export function stopPlaceOf(item: TimelineItem, stayCity: string): StopPlace {
  const fallback = stayCity === "in_transit" ? "" : stayCity;
  const here = parsePlaceQuery(item.placeQuery, fallback);
  const from = parsePlaceQuery(item.transport.fromPlaceQuery, here.city || fallback);
  const to = parsePlaceQuery(item.transport.toPlaceQuery, here.city || fallback);

  if (
    (item.type === "transit" || item.type === "flight" || item.transport.mode === "train" || item.transport.mode === "flight" || item.transport.mode === "night_train") &&
    from.city &&
    to.city &&
    from.city.toLowerCase() !== to.city.toLowerCase()
  ) {
    return {
      city: to.city,
      area: "",
      label: `${cityZh(from.city)} → ${cityZh(to.city)}`,
      key: `${from.city}>${to.city}`.toLowerCase(),
    };
  }

  const city = here.city || fallback;
  const area = looksLikeArea(here.name, city) ? here.name : "";
  const label = [area ? cityZh(area) : "", city ? cityZh(city) : ""].filter(Boolean).join(" · ");
  return {
    city,
    area,
    label,
    key: city.trim().toLowerCase(),
  };
}
