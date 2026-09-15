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
import { findMealExpense, removeMealExpense, upsertMealExpense } from "../lib/life";
import type { LatLng } from "../lib/geocode";
import { googleFoodNearUrl, googleFoodSearchUrl, googleSearchUrl } from "../lib/links";
import type { Day, TimelineItem, TripDoc } from "../types";

export function StopEats({
  item,
  point,
  city,
  day,
  tripKey,
  covers,
  doc,
  onChange,
}: {
  item: TimelineItem;
  point?: LatLng;
  city: string;
  day: Day;
  tripKey: string;
  covers: number;
  doc: TripDoc;
  onChange: (next: TripDoc) => void;
}) {
  const slot = useMemo(() => stopEatSlot(item, point), [item, point]);
  const region = eatRegionOf(day, slot.nearQuery, city, item.placeQuery);
  const [places, setPlaces] = useState<NearbyEat[]>(() =>
    slot.lat != null && slot.lng != null ? nearbyFromCache(slot.lat, slot.lng) ?? [] : [],
  );
  const [loading, setLoading] = useState(
    () => slot.lat != null && slot.lng != null && !nearbyFromCache(slot.lat, slot.lng),
  );
  const [pins, setPins] = useState(() => loadEatPins(tripKey, day.date));
  const [expanded, setExpanded] = useState(false);

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
  const shown = [...pins.filter((pin) => pin.slot === slot.id), ...ranked.filter((place) => !pinIds.has(place.id))];
  const visible = expanded ? shown : shown.slice(0, 3);
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
  const meta = [
    slot.label,
    slot.plannedTitle ? "行程已有此餐" : null,
    !loading && shown.length ? `${shown.length} 間` : loading ? "搜尋中…" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function pinPlace(place: NearbyEat) {
    setPins(
      toggleEatPin({
        ...place,
        tripKey,
        date: day.date,
        slot: slot.id,
      }),
    );
  }

  function toggleLedger(place: NearbyEat, bookHref?: string | null) {
    const existing = findMealExpense(doc, day.date, slot.id, place.id);
    if (existing) {
      onChange(removeMealExpense(doc, day.date, slot.id, place.id));
      return;
    }
    if (!isPinned(pins, place.id)) pinPlace(place);
    onChange(
      upsertMealExpense(doc, {
        date: day.date,
        slot: slot.id,
        slotLabel: slot.label,
        placeId: place.id,
        placeName: place.name,
        place: area,
        url: place.website || bookHref || null,
        time: slot.bookTime,
      }),
    );
  }

  return (
    <details className="stop-eats" onClick={(event) => event.stopPropagation()}>
      <summary>
        附近美食與訂位
        {meta ? <span className="stop-eats-meta">{meta}</span> : null}
      </summary>
      {loading && <p className="empty">正在尋找此景點附近…</p>}
      {!loading && shown.length === 0 && <p className="empty">未列出店名。請用下方連結在此景點旁先搜／訂位。</p>}
      {visible.length > 0 && (
        <ul className="stop-eats-list">
          {visible.map((place) => {
            const meters =
              slot.lat != null && slot.lng != null ? walkMeters(slot.lat, slot.lng, place.lat, place.lng) : null;
            const books = placeBookLinks(place.name, area, region, covers, day.date, slot.bookTime);
            const bookHref = place.website || books[0]?.href;
            const extras = place.website ? books : books.slice(1);
            const inLedger = Boolean(findMealExpense(doc, day.date, slot.id, place.id));
            return (
              <li key={place.id} className={isPinned(pins, place.id) || inLedger ? "pinned" : undefined}>
                <div className="eat-main">
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
                      {place.website ? "官網" : books[0]?.label || "訂位"}
                    </a>
                  )}
                  {extras.map((link) => (
                    <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                  <button type="button" className="text-btn" onClick={() => pinPlace(place)}>
                    {isPinned(pins, place.id) ? "不想吃" : "想吃"}
                  </button>
                  <button
                    type="button"
                    className={`text-btn${inLedger ? " on" : ""}`}
                    onClick={() => toggleLedger(place, bookHref)}
                  >
                    {inLedger ? "已記入食" : "記入食"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > 3 && (
        <button type="button" className="text-btn stop-eats-more" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起" : `查看另外 ${shown.length - 3} 間`}
        </button>
      )}
      <div className="more-links">
        <a href={nearMaps} target="_blank" rel="noreferrer">
          Google 這裡
        </a>
        {areaLinks.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </details>
  );
}
