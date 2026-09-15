import { useEffect, useMemo, useState } from "react";
import {
  amenityLabel,
  buildEatSlots,
  cuisineLabel,
  defaultEatSlot,
  fetchNearbyEats,
  formatWalk,
  nearbyFromCache,
  rankEats,
  walkMeters,
  type EatSlot,
  type EatSlotId,
  type NearbyEat,
} from "../lib/eats";
import { areaBookLinks, eatRegionOf, placeBookLinks, type EatRegion } from "../lib/eatBook";
import { findMealExpense, removeMealExpense, upsertMealExpense } from "../lib/life";
import type { LatLng } from "../lib/geocode";
import { googleFoodNearUrl, googleFoodSearchUrl, googleSearchUrl } from "../lib/links";
import type { Day, TripDoc } from "../types";

export function DayEats({
  day,
  points,
  hotelQuery,
  city,
  tripKey: _tripKey,
  covers,
  doc,
  onChange,
}: {
  day: Day;
  points: Map<string, LatLng>;
  hotelQuery?: string | null;
  city: string;
  tripKey: string;
  covers: number;
  doc: TripDoc;
  onChange: (next: TripDoc) => void;
}) {
  const slots = useMemo(() => buildEatSlots(day, points, hotelQuery), [day, points, hotelQuery]);
  const [slotId, setSlotId] = useState<EatSlotId>(() => defaultEatSlot(slots, day.date));
  const [places, setPlaces] = useState<NearbyEat[]>([]);
  const [loading, setLoading] = useState(false);

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


  if (!slot) return null;

  const ranked = rankEats(places, slot);
  const shown = ranked.slice(0, 6);
  const area = city && city !== "in_transit" ? city : slot.nearName;
  const mapsKind = slot.id === "snack" || slot.id === "breakfast" ? "cafes" : slot.id === "late" ? "bars" : "restaurants";
  const nearMaps =
    slot.lat != null && slot.lng != null
      ? googleFoodNearUrl(mapsKind, slot.lat, slot.lng)
      : googleFoodSearchUrl(`${mapsKind} near ${slot.nearQuery}`);
  const bookQuery = `${slot.nearName} ${area}`;
  const region = eatRegionOf(day, slot.nearQuery, area);
  const areaLinks = areaBookLinks(bookQuery, region, covers, day.date, slot.bookTime, slot.lat, slot.lng);


  function toggleLedger(place: NearbyEat, bookHref?: string | null) {
    const existing = findMealExpense(doc, day.date, slot.id, place.id);
    if (existing) {
      onChange(removeMealExpense(doc, day.date, slot.id, place.id));
      return;
    }
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
    <section className="panel eats-panel" id="day-eats">
      <div className="panel-head">
        <h3>按時段找餐廳、訂位</h3>
        <span>優先用各景點「附近高評分餐廳」。此處為整天彙總／舊行程後備搜尋；選一間「記入食」，或略過不選。</span>
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
        {slot.plannedTitle ? ` · 行程已記載「${slot.plannedTitle}」` : ""}
      </p>
      {loading && <p className="empty">正在尋找這一帶的餐廳…</p>}
      {!loading && shown.length === 0 && (
        <p className="empty">未列出店名。請用下方 Google／訂位連結先搜這一帶；熱門餐廳越早訂越穩。</p>
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
              inLedger={Boolean(findMealExpense(doc, day.date, slot.id, place.id))}
              onLedger={(bookHref) => toggleLedger(place, bookHref)}
            />
          ))}
        </ul>
      )}
      <div className="more-links">
        <a href={nearMaps} target="_blank" rel="noreferrer">
          Google 地圖這一帶
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
  inLedger,
  onLedger,
}: {
  place: NearbyEat;
  slot: EatSlot;
  city: string;
  region: EatRegion;
  covers: number;
  date: string;
  inLedger: boolean;
  onLedger: (bookHref?: string | null) => void;
}) {
  const meters =
    slot.lat != null && slot.lng != null ? walkMeters(slot.lat, slot.lng, place.lat, place.lng) : null;
  const kind = [amenityLabel(place.amenity), cuisineLabel(place.cuisine)].filter(Boolean).join(" · ");
  const books = placeBookLinks(place.name, city, region, covers, date, slot.bookTime);
  const bookHref = place.website || books[0]?.href;
  const extras = place.website ? books : books.slice(1);
  return (
    <li className={inLedger ? "eat-row pinned" : "eat-row"}>
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
        <button type="button" className={`text-btn${inLedger ? " on" : ""}`} onClick={() => onLedger(bookHref)}>
          {inLedger ? "已選／記入食" : "選這間／記入食"}
        </button>
      </div>
    </li>
  );
}
