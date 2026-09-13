import { useEffect, useMemo, useState } from "react";
import { areaBookLinks, eatRegionOf, placeBookLinks } from "../lib/eatBook";
import {
  amenityLabel,
  cuisineLabel,
  fetchNearbyEats,
  formatWalk,
  isPinned,
  loadEatPins,
  nearbyFromCache,
  rankEats,
  skipStopEats,
  stopEatSlot,
  toggleEatPin,
  walkMeters,
  type NearbyEat,
} from "../lib/eats";
import type { LatLng } from "../lib/geocode";
import { googleFoodNearUrl, googleFoodSearchUrl, googleSearchUrl } from "../lib/links";
import type { Day, TimelineItem } from "../types";

export function StopEats({
  item,
  point,
  city,
  day,
  tripKey,
  covers,
}: {
  item: TimelineItem;
  point?: LatLng;
  city: string;
  day: Day;
  tripKey: string;
  covers: number;
}) {
  const slot = useMemo(() => stopEatSlot(item, point), [item, point]);
  const region = eatRegionOf(day, slot.nearQuery, city, item.placeQuery);
  const [places, setPlaces] = useState<NearbyEat[]>(() =>
    slot.lat != null && slot.lng != null ? nearbyFromCache(slot.lat, slot.lng) ?? [] : [],
  );
  const [loading, setLoading] = useState(() => slot.lat != null && slot.lng != null && !nearbyFromCache(slot.lat, slot.lng));
  const [pins, setPins] = useState(() => loadEatPins(tripKey, day.date));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (slot.lat == null || slot.lng == null) {
      setPlaces([]);
      setLoading(false);
      return;
    }
    const lat = slot.lat;
    const lng = slot.lng;
    const cached = nearbyFromCache(lat, lng);
    setPlaces(cached ?? []);
    setLoading(!cached);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 18000);
    void fetchNearbyEats(lat, lng).then((found) => {
      if (cancelled) return;
      window.clearTimeout(timer);
      setPlaces(found);
      setLoading(false);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slot.lat, slot.lng]);

  useEffect(() => {
    setPins(loadEatPins(tripKey, day.date));
  }, [tripKey, day.date]);

  if (skipStopEats(item.type)) return null;

  const ranked = rankEats(places, slot, 8);
  const pinIds = new Set(pins.filter((pin) => pin.slot === slot.id).map((pin) => pin.id));
  const shown = [
    ...pins.filter((pin) => pin.slot === slot.id),
    ...ranked.filter((place) => !pinIds.has(place.id)),
  ];
  const visible = open ? shown : shown.slice(0, 3);
  const area = city && city !== "in_transit" ? city : slot.nearName;
  const mapsKind = slot.id === "snack" || slot.id === "breakfast" ? "cafes" : slot.id === "late" ? "bars" : "restaurants";
  const nearMaps =
    slot.lat != null && slot.lng != null
      ? googleFoodNearUrl(mapsKind, slot.lat, slot.lng)
      : googleFoodSearchUrl(`${mapsKind} near ${slot.nearQuery || area}`);
  const areaLinks = areaBookLinks(
    `${slot.nearName} ${area}`,
    region,
    covers,
    day.date,
    slot.bookTime,
    slot.lat,
    slot.lng,
  );

  return (
    <div className="stop-eats" onClick={(event) => event.stopPropagation()}>
      <p className="stop-eats-label">
        呢度附近食 · {slot.label}
        {slot.plannedTitle ? " · 行程已有呢餐" : ""}
      </p>
      {loading && <p className="empty">緊搵呢個景點附近…</p>}
      {!loading && shown.length === 0 && (
        <p className="empty">未列到店名。用下面喺呢個景點旁邊先訂。</p>
      )}
      {visible.length > 0 && (
        <ul className="stop-eats-list">
          {visible.map((place) => {
            const meters =
              slot.lat != null && slot.lng != null ? walkMeters(slot.lat, slot.lng, place.lat, place.lng) : null;
            const books = placeBookLinks(place.name, area, region, covers, day.date, slot.bookTime);
            const bookHref = place.website || books[0]?.href;
            const extras = place.website ? books : books.slice(1);
            return (
              <li key={place.id} className={isPinned(pins, place.id) ? "pinned" : undefined}>
                <div>
                  <strong>{place.name}</strong>
                  <span>
                    {[amenityLabel(place.amenity), cuisineLabel(place.cuisine)].filter(Boolean).join(" · ")}
                    {meters != null ? ` · ${formatWalk(meters)}` : ""}
                  </span>
                </div>
                <div className="eat-actions">
                  <a href={googleSearchUrl(`${place.name}, ${area}`)} target="_blank" rel="noreferrer">
                    地圖
                  </a>
                  {bookHref && (
                    <a href={bookHref} target="_blank" rel="noreferrer">
                      {place.website ? "官網／訂位" : books[0]?.label || "訂位"}
                    </a>
                  )}
                  {extras.map((link) => (
                    <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                  <button
                    type="button"
                    className="text-btn"
                    onClick={() =>
                      setPins(
                        toggleEatPin({
                          ...place,
                          tripKey,
                          date: day.date,
                          slot: slot.id,
                        }),
                      )
                    }
                  >
                    {isPinned(pins, place.id) ? "唔想食" : "想食"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 3 && (
        <button type="button" className="text-btn stop-eats-more" onClick={() => setOpen((value) => !value)}>
          {open ? "收起" : `再睇 ${shown.length - 3} 間呢度附近`}
        </button>
      )}
      <div className="more-links">
        <a href={nearMaps} target="_blank" rel="noreferrer">
          Google 呢度
        </a>
        {areaLinks.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
