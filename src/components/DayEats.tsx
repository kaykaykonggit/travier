import { useEffect, useMemo, useState } from "react";
import {
  amenityLabel,
  buildEatSlots,
  cuisineLabel,
  defaultEatSlot,
  fetchNearbyEats,
  formatWalk,
  isPinned,
  loadEatPins,
  nearbyFromCache,
  rankEats,
  toggleEatPin,
  walkMeters,
  type EatSlot,
  type EatSlotId,
  type NearbyEat,
} from "../lib/eats";
import { areaBookLinks, eatRegionOf, placeBookLinks, type EatRegion } from "../lib/eatBook";
import type { LatLng } from "../lib/geocode";
import { googleFoodNearUrl, googleFoodSearchUrl, googleSearchUrl } from "../lib/links";
import type { Day } from "../types";

export function DayEats({
  day,
  points,
  hotelQuery,
  city,
  tripKey,
  covers,
}: {
  day: Day;
  points: Map<string, LatLng>;
  hotelQuery?: string | null;
  city: string;
  tripKey: string;
  covers: number;
}) {
  const slots = useMemo(() => buildEatSlots(day, points, hotelQuery), [day, points, hotelQuery]);
  const [slotId, setSlotId] = useState<EatSlotId>(() => defaultEatSlot(slots, day.date));
  const [places, setPlaces] = useState<NearbyEat[]>([]);
  const [loading, setLoading] = useState(false);
  const [pins, setPins] = useState(() => loadEatPins(tripKey, day.date));

  const slot = slots.find((item) => item.id === slotId) ?? slots[0] ?? null;

  useEffect(() => {
    if (!slots.length) return;
    if (!slots.some((item) => item.id === slotId)) setSlotId(defaultEatSlot(slots, day.date));
  }, [slots, slotId, day.date]);

  useEffect(() => {
    if (!slot?.lat || !slot.lng) {
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
    void fetchNearbyEats(lat, lng).then((found) => {
      if (cancelled) return;
      setPlaces(found);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slot?.lat, slot?.lng, slot?.id]);

  useEffect(() => {
    setPins(loadEatPins(tripKey, day.date));
  }, [tripKey, day.date]);

  if (!slot) return null;

  const ranked = rankEats(places, slot);
  const pinIds = new Set(pins.filter((pin) => pin.slot === slot.id).map((pin) => pin.id));
  const shown = [
    ...pins.filter((pin) => pin.slot === slot.id),
    ...ranked.filter((place) => !pinIds.has(place.id)),
  ].slice(0, 6);
  const area = city && city !== "in_transit" ? city : slot.nearName;
  const mapsKind = slot.id === "snack" || slot.id === "breakfast" ? "cafes" : slot.id === "late" ? "bars" : "restaurants";
  const nearMaps =
    slot.lat != null && slot.lng != null
      ? googleFoodNearUrl(mapsKind, slot.lat, slot.lng)
      : googleFoodSearchUrl(`${mapsKind} near ${slot.nearQuery}`);
  const bookQuery = `${slot.nearName} ${area}`;
  const region = eatRegionOf(day, slot.nearQuery, area);
  const areaLinks = areaBookLinks(bookQuery, region, covers, day.date, slot.bookTime, slot.lat, slot.lng);

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

  return (
    <section className="panel eats-panel" id="day-eats">
      <div className="panel-head">
        <h3>按時段訂午餐晚餐</h3>
        <span>景點下面已有附近食；呢度係按早餐／午餐／晚餐一齊睇</span>
      </div>
      <div className="eats-slots" role="tablist" aria-label="用餐時段">
        {slots.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === slot.id}
            className={item.id === slot.id ? "eat-slot on" : "eat-slot"}
            onClick={() => setSlotId(item.id)}
          >
            {item.label}
            {item.plannedTitle ? <small>已有</small> : null}
          </button>
        ))}
      </div>
      <p className="eats-near">
        {slot.timeLabel} · {slot.nearName} 一帶
        {slot.plannedTitle ? ` · 行程已寫「${slot.plannedTitle}」` : ""}
      </p>
      {loading && <p className="empty">緊搵呢帶食店…</p>}
      {!loading && shown.length === 0 && (
        <p className="empty">未列到店名。用下面連結喺地圖同訂位網先睇，熱門餐廳愈早訂愈穩。</p>
      )}
      {shown.length > 0 && (
        <ul className="eats-list">
          {shown.map((place) => (
            <EatRow
              key={place.id}
              place={place}
              slot={slot}
              city={area}
              region={region}
              covers={covers}
              date={day.date}
              pinned={isPinned(pins, place.id)}
              onPin={() => pinPlace(place)}
            />
          ))}
        </ul>
      )}
      <div className="more-links">
        <a href={nearMaps} target="_blank" rel="noreferrer">
          Google 地圖呢帶
        </a>
        {areaLinks.map((link) => (
          <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function EatRow({
  place,
  slot,
  city,
  region,
  covers,
  date,
  pinned,
  onPin,
}: {
  place: NearbyEat;
  slot: EatSlot;
  city: string;
  region: EatRegion;
  covers: number;
  date: string;
  pinned: boolean;
  onPin: () => void;
}) {
  const meters =
    slot.lat != null && slot.lng != null ? walkMeters(slot.lat, slot.lng, place.lat, place.lng) : null;
  const kind = [amenityLabel(place.amenity), cuisineLabel(place.cuisine)].filter(Boolean).join(" · ");
  const books = placeBookLinks(place.name, city, region, covers, date, slot.bookTime);
  const bookHref = place.website || books[0]?.href;
  const extras = place.website ? books : books.slice(1);
  return (
    <li className={pinned ? "eat-row pinned" : "eat-row"}>
      <div>
        <h4>{place.name}</h4>
        <p>
          {kind}
          {meters != null ? ` · ${formatWalk(meters)}` : ""}
        </p>
      </div>
      <div className="eat-actions">
        <a href={googleSearchUrl(`${place.name}, ${city}`)} target="_blank" rel="noreferrer">
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
        <button type="button" className="text-btn" onClick={onPin}>
          {pinned ? "唔想食" : "想食"}
        </button>
      </div>
    </li>
  );
}
