import { useEffect, useMemo, useState } from "react";
import { areaBookLinks, eatRegionOf, placeBookLinks } from "../lib/eatBook";
import {
  amenityLabel,
  cuisineLabel,
  fetchNearbyEats,
  formatWalk,
  nearbyFromCache,
  rankEats,
  skipStopEats,
  stopEatSlot,
  walkMeters,
  type NearbyEat,
} from "../lib/eats";
import { chooseStopEat, clearStopEatChoice, skipStopEatsChoice } from "../lib/editTrip";
import { findMealExpense, removeMealExpense, upsertMealExpense } from "../lib/life";
import type { LatLng } from "../lib/geocode";
import { googleFoodNearUrl, googleFoodSearchUrl, googleSearchUrl } from "../lib/links";
import type { Day, EatCandidate, TimelineItem, TripDoc } from "../types";

export function StopEats({
  item,
  itemIndex,
  dayIndex,
  point,
  city,
  day,
  tripKey: _tripKey,
  covers,
  doc,
  onChange,
}: {
  item: TimelineItem;
  itemIndex: number;
  dayIndex: number;
  point?: LatLng;
  city: string;
  day: Day;
  tripKey: string;
  covers: number;
  doc: TripDoc;
  onChange: (next: TripDoc) => void;
}) {
  const curated = item.eats ?? [];
  const hasCurated = curated.length > 0;

  if (skipStopEats(item.type)) return null;

  if (hasCurated) {
    return (
      <CuratedEats
        item={item}
        itemIndex={itemIndex}
        dayIndex={dayIndex}
        city={city}
        day={day}
        doc={doc}
        onChange={onChange}
      />
    );
  }

  return (
    <NearbyFallback
      item={item}
      point={point}
      city={city}
      day={day}
      covers={covers}
      doc={doc}
      onChange={onChange}
    />
  );
}

function CuratedEats({
  item,
  itemIndex,
  dayIndex,
  city,
  day,
  doc,
  onChange,
}: {
  item: TimelineItem;
  itemIndex: number;
  dayIndex: number;
  city: string;
  day: Day;
  doc: TripDoc;
  onChange: (next: TripDoc) => void;
}) {
  const area = city && city !== "in_transit" ? city : item.displayNameZh || item.title;
  const chosen = item.chosenEat;
  const skipped = item.eatSkipped;

  function selectEat(eat: EatCandidate) {
    let next = chooseStopEat(doc, dayIndex, itemIndex, eat.name);
    next = upsertMealExpense(next, {
      date: day.date,
      slot: `stop-${itemIndex}`,
      slotLabel: `${item.displayNameZh || item.title} 附近`,
      placeId: eat.placeQuery || eat.name,
      placeName: eat.displayNameZh || eat.name,
      place: area,
      url: eat.bookingUrl || eat.mapsUrl || null,
    });
    onChange(next);
  }

  function skipAll() {
    let next = skipStopEatsChoice(doc, dayIndex, itemIndex);
    if (chosen) {
      const eat = item.eats.find((row) => row.name === chosen);
      if (eat) next = removeMealExpense(next, day.date, `stop-${itemIndex}`, eat.placeQuery || eat.name);
    }
    onChange(next);
  }

  function resetChoice() {
    let next = clearStopEatChoice(doc, dayIndex, itemIndex);
    if (chosen) {
      const eat = item.eats.find((row) => row.name === chosen);
      if (eat) next = removeMealExpense(next, day.date, `stop-${itemIndex}`, eat.placeQuery || eat.name);
    }
    onChange(next);
  }

  return (
    <details className="stop-eats" open={!skipped && !chosen} onClick={(event) => event.stopPropagation()}>
      <summary>
        附近高評分餐廳
        <span className="stop-eats-meta">
          {skipped
            ? "已略過"
            : chosen
              ? `已選 · ${chosen}`
              : `Google Maps ≥4.0 · ${item.eats.length} 間`}
        </span>
      </summary>
      {skipped ? (
        <p className="empty">
          已略過此站餐廳推薦。
          <button type="button" className="text-btn" onClick={resetChoice}>
            重新選擇
          </button>
        </p>
      ) : (
        <>
          <ul className="stop-eats-list">
            {item.eats.map((eat) => {
              const selected = chosen === eat.name;
              const mapsHref =
                eat.mapsUrl || googleSearchUrl(`${eat.placeQuery || eat.name}, ${area}`);
              return (
                <li key={eat.placeQuery || eat.name} className={selected ? "pinned" : undefined}>
                  <div className="eat-main">
                    <strong>
                      {eat.displayNameZh || eat.name}
                      {eat.rating > 0 ? <em className="eat-rating">★ {eat.rating.toFixed(1)}</em> : null}
                    </strong>
                    <span>
                      {eat.name !== eat.displayNameZh ? eat.name : ""}
                      {eat.notes ? `${eat.displayNameZh && eat.name !== eat.displayNameZh ? " · " : ""}${eat.notes}` : ""}
                    </span>
                  </div>
                  <div className="eat-actions">
                    <a href={mapsHref} target="_blank" rel="noreferrer">
                      地圖
                    </a>
                    {eat.bookingUrl ? (
                      <a href={eat.bookingUrl} target="_blank" rel="noreferrer">
                        訂位
                      </a>
                    ) : null}
                    <button
                      type="button"
                      className={`text-btn${selected ? " on" : ""}`}
                      onClick={() => selectEat(eat)}
                    >
                      {selected ? "已選" : "選這間"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="more-links">
            <button type="button" className="text-btn" onClick={skipAll}>
              略過這些餐廳
            </button>
            {chosen ? (
              <button type="button" className="text-btn" onClick={resetChoice}>
                清除選擇
              </button>
            ) : null}
          </div>
        </>
      )}
    </details>
  );
}

/** Fallback when trip JSON has no AI eats[] yet (old imports). */
function NearbyFallback({
  item,
  point,
  city,
  day,
  covers,
  doc,
  onChange,
}: {
  item: TimelineItem;
  point?: LatLng;
  city: string;
  day: Day;
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

  const ranked = rankEats(places, slot, 8);
  const visible = expanded ? ranked : ranked.slice(0, 3);
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

  function toggleLedger(place: NearbyEat, bookHref?: string | null) {
    const placeId = place.id;
    const existing = findMealExpense(doc, day.date, slot.id, placeId);
    if (existing) {
      onChange(removeMealExpense(doc, day.date, slot.id, placeId));
      return;
    }
    onChange(
      upsertMealExpense(doc, {
        date: day.date,
        slot: slot.id,
        slotLabel: slot.label,
        placeId,
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
        附近美食（地圖搜尋）
        <span className="stop-eats-meta">
          {loading ? "搜尋中…" : ranked.length ? `${ranked.length} 間 · 無 AI 推薦時後備` : "無 AI 推薦"}
        </span>
      </summary>
      <p className="empty">此行程尚未帶入 AI 高評分餐廳；以下為即時地圖搜尋後備。</p>
      {loading && <p className="empty">正在尋找此景點附近…</p>}
      {!loading && ranked.length === 0 && <p className="empty">未列出店名。請用下方連結自行搜尋。</p>}
      {visible.length > 0 && (
        <ul className="stop-eats-list">
          {visible.map((place) => {
            const meters =
              slot.lat != null && slot.lng != null ? walkMeters(slot.lat, slot.lng, place.lat, place.lng) : null;
            const books = placeBookLinks(place.name, area, region, covers, day.date, slot.bookTime);
            const bookHref = place.website || books[0]?.href;
            const inLedger = Boolean(findMealExpense(doc, day.date, slot.id, place.id));
            return (
              <li key={place.id} className={inLedger ? "pinned" : undefined}>
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
                  <button
                    type="button"
                    className={`text-btn${inLedger ? " on" : ""}`}
                    onClick={() => toggleLedger(place, bookHref)}
                  >
                    {inLedger ? "已記入食" : "選這間／記入食"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {ranked.length > 3 && (
        <button type="button" className="text-btn stop-eats-more" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "收起" : `查看另外 ${ranked.length - 3} 間`}
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
