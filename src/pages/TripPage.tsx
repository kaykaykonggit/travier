import { useEffect, useMemo, useRef, useState } from "react";
import { BookingBox } from "../components/BookingBox";
import { DayEats } from "../components/DayEats";
import { DayMap, type MapStop } from "../components/DayMap";
import { InfoTip } from "../components/InfoTip";
import { LockButton } from "../components/LockButton";
import { PlacePhoto } from "../components/PlacePhoto";
import { StopEats } from "../components/StopEats";
import { TimelineEdit } from "../components/TimelineEdit";
import { TransitBox, TransitStops } from "../components/TransitBox";
import { TripMap, type TripMapStop } from "../components/TripMap";
import { geocodeMany, mergePoints, pointsFromCache, type GeocodeQuery } from "../lib/geocode";
import { chosenHotel, collectCurrencies, fetchRates, formatMoney, itemCost, partySize, priceNote, summarizeCosts, summarizeDay, type RateTable } from "../lib/costs";
import { dayHeadline, dayPlace, shortPlace } from "../lib/dayLead";
import { addDays, formatDateZh, labelOf, MODE_LABEL, NIGHT_LABEL, PACE_LABEL, starsText, TYPE_LABEL, weekdayZh } from "../lib/labels";
import { dayKlookItems, isKlookable, klookHref, matchKlook } from "../lib/klook";
import { skipStopEats, tripEatKey } from "../lib/eats";
import { googleDirUrl, googleHotelsLiveUrl, googleHotelStayUrl, googleSearchUrl, klookUrl, parseHotelPaste, placeLabel, tripHotelUrl, withKlookDate } from "../lib/links";
import { hotelAccessTransport, lastSightOfDay, nightRestPoint } from "../lib/restPoint";
import { applyBackup, deleteTimelineItem, insertPlaceAfter, repairTimelinePlace, setItemLocked } from "../lib/editTrip";
import { isHomeAirportStop } from "../lib/homeStop";
import { isBareUrl, isShortMapsUrl, resolvePlaceInput } from "../lib/resolvePlace";
import { dayColor, tripStopNumbers } from "../lib/stops";
import { doneKey, loadDone, saveDone, toggleDone } from "../lib/progress";
import { initialDayIndex, leadOfDay } from "../lib/leadStop";
import { applyTripUpdate } from "../lib/patch";
import { buildTweakPrompt } from "../lib/tweakPrompt";
import { needsBooking, bookingFallbackUrl } from "../lib/booking";
import type { Day, HotelCandidate, Night, TripDoc } from "../types";

function nightForDay(doc: TripDoc, day: Day): Night | undefined {
  return doc.nights.find((night) => night.date === day.date);
}

function placeInput(query: string, ...aliases: Array<string | null | undefined>): GeocodeQuery {
  const trimmed = query.trim();
  return { query: trimmed, aliases: aliases.filter((item): item is string => Boolean(item && item.trim() && item.trim() !== trimmed)) };
}

function allPlaceInputs(doc: TripDoc): GeocodeQuery[] {
  const inputs: GeocodeQuery[] = [];
  for (const entry of doc.days) {
    for (const item of entry.timeline) {
      inputs.push(placeInput(item.placeQuery, item.displayNameZh, item.title));
      for (const backup of item.backups) {
        inputs.push(placeInput(backup.placeQuery, backup.displayNameZh, backup.title));
      }
    }
  }
  for (const stay of doc.nights) {
    if (stay.nearPlaceQuery) inputs.push(placeInput(stay.nearPlaceQuery));
    for (const hotel of stay.candidates) inputs.push(placeInput(hotel.placeQuery, hotel.name));
  }
  return inputs;
}

function allPlaceQueries(doc: TripDoc): string[] {
  return allPlaceInputs(doc).map((item) => item.query);
}

export function TripPage({ doc, onChange, onReset }: { doc: TripDoc; onChange: (doc: TripDoc) => void; onReset: () => void }) {
  const [dayIndex, setDayIndex] = useState(() => initialDayIndex(doc.days));
  const [rates, setRates] = useState<RateTable>({ [doc.trip.currencies.display]: 1 });
  const [points, setPoints] = useState(() => pointsFromCache(allPlaceQueries(doc)));
  const [mapLoading, setMapLoading] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [mapScope, setMapScope] = useState<"day" | "trip">("day");
  const [customHotel, setCustomHotel] = useState({ name: "", amount: "" });
  const [done, setDone] = useState(() => loadDone(doc));
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [tweakWish, setTweakWish] = useState("");
  const [tweakCopied, setTweakCopied] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const mapPanelRef = useRef<HTMLElement | null>(null);
  const dayBarRef = useRef<HTMLElement | null>(null);
  const jumpRef = useRef<HTMLDivElement | null>(null);
  const failedLinks = useRef(new Set<string>());
  const swipeX = useRef<number | null>(null);

  const day = doc.days[dayIndex] ?? doc.days[0];
  const night = nightForDay(doc, day);
  const tomorrow = doc.days[dayIndex + 1];
  const rest = night ? nightRestPoint(night, day, tomorrow) : null;
  const listedKlooks = doc.klook.filter((item) => item.date === day.date);
  const klooks = dayKlookItems(day.date, listedKlooks, day.timeline);
  const adults = doc.trip.travelers.adults;
  const children = doc.trip.travelers.children;
  const heads = partySize(adults, children);
  const display = doc.trip.currencies.display;
  const local = doc.trip.currencies.local;

  const summary = useMemo(() => summarizeCosts(doc, rates, heads), [doc, rates, heads]);
  const dayTotals = useMemo(
    () =>
      doc.days.map((item) => summarizeDay(item, nightForDay(doc, item), local, display, rates, heads)),
    [doc, local, display, rates, heads],
  );
  const todayCost = dayTotals[dayIndex] ?? dayTotals[0];
  const pickedHotel = chosenHotel(night);
  const lead = useMemo(
    () => leadOfDay(day, (index) => done.has(doneKey(day.date, index, day.timeline[index]?.start ?? ""))),
    [day, done],
  );
  const numbersByDay = useMemo(() => tripStopNumbers(doc.days), [doc.days]);
  const stopNumbers = numbersByDay[dayIndex] ?? [];
  const focusQuery = focusIndex != null ? day.timeline[focusIndex]?.placeQuery.trim() || null : null;
  const focusNumber = focusIndex != null ? stopNumbers[focusIndex] ?? null : null;

  const stops: MapStop[] = useMemo(() => {
    const list: MapStop[] = [];
    day.timeline.forEach((item, index) => {
      const query = item.placeQuery.trim();
      const number = stopNumbers[index] ?? 0;
      if (!query || !number) return;
      list.push({
        query,
        name: item.displayNameZh || item.title,
        mustSee: item.mustSee,
        number,
        index,
      });
    });
    return list;
  }, [day, stopNumbers]);

  const tripStops: TripMapStop[] = useMemo(() => {
    const list: TripMapStop[] = [];
    doc.days.forEach((entry, di) => {
      entry.timeline.forEach((item, ii) => {
        const query = item.placeQuery.trim();
        const number = numbersByDay[di]?.[ii];
        if (!query || !number || isHomeAirportStop(item, doc.trip.origin)) return;
        list.push({
          query,
          name: item.displayNameZh || item.title,
          number,
          dayIndex: di,
          itemIndex: ii,
          dayLabel: `${formatDateZh(entry.date)} · ${dayHeadline(entry)}`,
          type: item.type,
        });
      });
    });
    return list;
  }, [doc.days, numbersByDay, doc.trip.origin]);

  const mapQuery = focusQuery || stops[0]?.query || day.stayCity;

  function updateNight(date: string, patch: Partial<Night>) {
    onChange({
      ...doc,
      nights: doc.nights.map((item) => (item.date === date ? { ...item, ...patch } : item)),
    });
  }

  function selectHotel(nightDate: string, hotel: HotelCandidate) {
    const current = doc.nights.find((item) => item.date === nightDate);
    if (!current) return;
    const exists = current.candidates.some((item) => item.name === hotel.name);
    updateNight(nightDate, {
      chosenName: hotel.name,
      candidates: exists ? current.candidates : [hotel, ...current.candidates],
    });
  }

  function addCustomHotel(nightDate: string, city: string) {
    const pasted = parseHotelPaste(customHotel.name);
    const name = pasted.name.trim();
    const amount = Number(customHotel.amount);
    if (!name || !Number.isFinite(amount) || amount < 0) return;
    selectHotel(nightDate, {
      name,
      placeQuery: `${name}, ${city}`,
      stars: null,
      cost: {
        amount,
        currency: local,
        estimated: false,
        source: pasted.source || googleSearchUrl(`${name}, ${city}`),
        asOf: new Date().toISOString().slice(0, 10),
      },
    });
    setCustomHotel({ name: "", amount: "" });
  }

  function markDone(index: number, start: string) {
    const next = toggleDone(done, doneKey(day.date, index, start));
    setDone(next);
    saveDone(doc, next);
  }

  function applyJson() {
    const result = applyTripUpdate(doc, jsonDraft);
    if (!result.ok) {
      setJsonErrors(result.errors);
      setApplyNote(null);
      return;
    }
    setJsonErrors([]);
    setJsonDraft("");
    setApplyNote(result.mode === "patch" ? "已合併 patch" : "已用完整 JSON 取代");
    window.setTimeout(() => setApplyNote(null), 2500);
    onChange(result.doc);
  }

  async function copyTweak() {
    await navigator.clipboard.writeText(buildTweakPrompt(doc, done, tweakWish, day.date));
    setTweakCopied(true);
    window.setTimeout(() => setTweakCopied(false), 2000);
  }

  function goToDay(index: number) {
    if (index < 0 || index >= doc.days.length) return;
    setDayIndex(index);
    setFocusIndex(null);
    setFocusToken(0);
    dayBarRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function focusItem(index: number, scroll = true) {
    setFocusIndex(index);
    setFocusToken(Date.now());
    if (scroll) mapPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "ArrowLeft") goToDay(dayIndex - 1);
      if (event.key === "ArrowRight") goToDay(dayIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dayIndex, doc.days.length]);

  useEffect(() => {
    jumpRef.current?.querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [dayIndex]);

  useEffect(() => {
    let cancelled = false;
    fetchRates(doc.trip.currencies.display, collectCurrencies(doc)).then((table) => {
      if (!cancelled) setRates(table);
    });
    return () => {
      cancelled = true;
    };
  }, [doc]);

  useEffect(() => {
    let cancelled = false;
    const allInputs = allPlaceInputs(doc);
    const dayKeys = new Set(
      [
        ...day.timeline.map((item) => item.placeQuery.trim()),
        ...day.timeline.flatMap((item) => item.backups.map((backup) => backup.placeQuery.trim())),
        night?.nearPlaceQuery?.trim() ?? "",
        ...(night?.candidates.map((hotel) => hotel.placeQuery.trim()) ?? []),
      ].filter(Boolean),
    );
    const cached = pointsFromCache(allInputs.map((item) => item.query));
    setPoints(cached);
    const dayMissing = allInputs.filter((item) => dayKeys.has(item.query) && !cached.has(item.query));
    setMapLoading(dayMissing.length > 0);

    async function run() {
      if (dayMissing.length) {
        const found = await geocodeMany(dayMissing);
        if (cancelled) return;
        setPoints((prev) => mergePoints(prev, found));
        setMapLoading(false);
      }
      const rest = allInputs.filter((item) => !cached.has(item.query) && !dayKeys.has(item.query));
      if (!rest.length) return;
      const found = await geocodeMany(rest);
      if (cancelled) return;
      setPoints((prev) => mergePoints(prev, found));
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [doc, day.date, night]);

  useEffect(() => {
    let cancelled = false;
    async function repair() {
      let current = doc;
      let changed = false;
      for (let di = 0; di < current.days.length; di += 1) {
        const stayCity = current.days[di].stayCity;
        for (let ii = 0; ii < current.days[di].timeline.length; ii += 1) {
          const item = current.days[di].timeline[ii];
          const raw = item.placeQuery.trim() || item.title.trim();
          if (!isBareUrl(raw) && !isShortMapsUrl(raw)) continue;
          if (failedLinks.current.has(raw)) continue;
          const resolved = await resolvePlaceInput(raw, stayCity === "in_transit" ? "" : stayCity);
          if (cancelled) return;
          if (!resolved || isBareUrl(resolved.name)) {
            failedLinks.current.add(raw);
            continue;
          }
          current = repairTimelinePlace(current, di, ii, resolved);
          changed = true;
        }
      }
      if (changed) onChange(current);
    }
    void repair();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <div className="trip-page">
      <header className="trip-top compact">
        <div className="trip-top-row">
          <p className="brand sm">Travier</p>
          <button type="button" className="text-btn" onClick={onReset}>
            換一份行程
          </button>
        </div>
        <h1>{doc.trip.title}</h1>
        <p className="trip-meta">
          {formatDateZh(doc.trip.startDate)} – {formatDateZh(doc.trip.endDate)} · {doc.days.length} 日 · 人均{" "}
          {formatMoney(summary.perPersonDisplay, display)}
        </p>
        <details className="quiet-details trip-cost-details">
          <summary>花費明細 · {adults} 大人{doc.trip.travelers.children ? ` ${doc.trip.travelers.children} 小孩` : ""} · {labelOf(PACE_LABEL, doc.trip.pace)}</summary>
          <div className="cost-bar">
            <div>
              <span className="cost-label">全團已填（估算）</span>
              <strong>{formatMoney(summary.totalDisplay, display)}</strong>
            </div>
            <div>
              <span className="cost-label">人均消費（{heads} 人）</span>
              <strong>{formatMoney(summary.perPersonDisplay, display)}</strong>
            </div>
            <div>
              <span className="cost-label">住宿人均（一房除人數）</span>
              <strong>
                {summary.hotelPerPersonDisplay == null
                  ? "未提供"
                  : formatMoney(summary.hotelPerPersonDisplay, display)}
              </strong>
            </div>
          </div>
          <p className="cost-note">
            機票與交通按全團合計。酒店是一房一晚再除人數；餐飲也按人均看。已填 {summary.knownCount} · 未填 {summary.unknownCount}
          </p>
          {doc.trip.notes && <p className="trip-notes">{doc.trip.notes}</p>}
        </details>
        <details className="quiet-details trip-cost-details tweak-panel">
          <summary>微改行程</summary>
          <div className="tweak-row">
            <span className="import-label">用法</span>
            <InfoTip title="點樣微改行程">
              <ol>
                <li>時間軸解鎖想改嘅站；鎖住嘅站 AI 唔准郁。</li>
                <li>喺「想點改」寫清楚日子同動作，例如「第三日下午唔好去美泉宮」。</li>
                <li>撳「複製微改」→ 貼去會搜網嘅 AI（ChatGPT／Gemini 等）。</li>
                <li>AI 只應交細份 <strong>patch</strong>（<code>schemaVersion: "1.0.0-patch"</code>），唔使成份行程，手機生成會快好多。</li>
                <li>將 AI 回覆貼返「貼上 AI 回覆」→「套用」。已打勾去過嘅進度會留住。</li>
              </ol>
              <p>換後備、刪站、貼地圖加站、改酒店：直接喺當日時間軸改就得，唔使開 AI。</p>
              <p>由零重新規劃：去「換一份行程」匯入頁。</p>
            </InfoTip>
          </div>
          <div className="tweak-row">
            <label className="import-label" htmlFor="tweak-wish">
              想點改
            </label>
            <InfoTip title="想點改點寫">
              <p>呢格會寫入複製俾 AI 嘅 prompt。愈具體愈穩。</p>
              <ul>
                <li>改景點：「12月20日下午唔好去美泉宮，改近市區步行景點」</li>
                <li>改酒店：「維也納嗰晚改近火車站」</li>
                <li>改節奏：「第三日唔好咁密，刪一個下午景點」</li>
              </ul>
              <p>留空＝只准 AI 改明顯錯誤（重複景點、離譜交通／時間），其他幾乎原樣。</p>
            </InfoTip>
          </div>
          <textarea
            id="tweak-wish"
            className="json-update"
            value={tweakWish}
            onChange={(event) => setTweakWish(event.target.value)}
            placeholder="例如：呢日下午換近啲嘅景點"
          />
          <button type="button" className="btn btn-primary" onClick={() => void copyTweak()}>
            {tweakCopied ? "已複製" : "複製微改"}
          </button>
          <div className="tweak-row tweak-paste-label">
            <label className="import-label" htmlFor="tweak-json">
              貼上 AI 回覆
            </label>
            <InfoTip title="貼上邊種 JSON">
              <p>
                <strong>首選 patch</strong>：AI 應回類似
                <code>{`{"schemaVersion":"1.0.0-patch","days":[...],"nights":[],"klook":[]}`}</code>
                。只放有改過嘅日子；App 會合併，鎖住站同已選酒店會保留。
              </p>
              <p>
                <strong>完整行程</strong>：若 AI 交返有 <code>trip</code>＋全日 <code>days</code> 嘅大 JSON，會整份取代而家行程（打勾進度仍保留）。
              </p>
              <p>貼完撳「套用」。若報錯，多數係 JSON 唔完整或 AI 加咗 Markdown 說明——叫佢淨係輸出 JSON 再試。</p>
            </InfoTip>
          </div>
          <textarea
            id="tweak-json"
            className="json-update"
            value={jsonDraft}
            onChange={(event) => setJsonDraft(event.target.value)}
            placeholder='{"schemaVersion":"1.0.0-patch","days":[...]}'
            spellCheck={false}
          />
          {jsonErrors.length > 0 && (
            <ul className="import-errors">
              {jsonErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
          {applyNote && <p className="cost-note">{applyNote}</p>}
          <button type="button" className="btn btn-primary" disabled={!jsonDraft.trim()} onClick={applyJson}>
            套用
          </button>
        </details>
      </header>

      <nav
        ref={dayBarRef}
        className="day-bar"
        aria-label="當天行程"
        onTouchStart={(event) => {
          swipeX.current = event.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          if (swipeX.current == null) return;
          const dx = event.changedTouches[0].clientX - swipeX.current;
          swipeX.current = null;
          if (dx > 56) goToDay(dayIndex - 1);
          if (dx < -56) goToDay(dayIndex + 1);
        }}
      >
        <button type="button" className="day-arrow" aria-label="前一天" disabled={dayIndex === 0} onClick={() => goToDay(dayIndex - 1)}>
          ‹
        </button>
        <div className="day-now">
          <span className="kicker">
            第 {dayIndex + 1} / {doc.days.length} 日 · {formatDateZh(day.date)} 週{weekdayZh(day.date)}
          </span>
          <strong>{dayHeadline(day)}</strong>
          <small>{dayPlace(day)}</small>
        </div>
        <button
          type="button"
          className="day-arrow"
          aria-label="後一天"
          disabled={dayIndex >= doc.days.length - 1}
          onClick={() => goToDay(dayIndex + 1)}
        >
          ›
        </button>
      </nav>

      <div className="day-jump" ref={jumpRef} role="tablist" aria-label="跳到某一天">
        {doc.days.map((item, index) => (
          <button
            key={item.date}
            type="button"
            role="tab"
            aria-selected={index === dayIndex}
            className={index === dayIndex ? "day-dot on" : "day-dot"}
            onClick={() => goToDay(index)}
          >
            <i style={{ background: dayColor(index) }} />
            {index + 1}
            <small>{shortPlace(item)}</small>
          </button>
        ))}
      </div>

      {lead ? (
        <button type="button" className="next-card" onClick={() => focusItem(lead.index, false)}>
          <span className="kicker">{lead.kind === "now" ? "現在" : "下一站"}</span>
          <strong>{lead.item.displayNameZh || lead.item.title}</strong>
          <small>
            {lead.item.start}
            {lead.item.end ? `–${lead.item.end}` : ""}
            {" · "}
            {labelOf(TYPE_LABEL, lead.item.type)}
            {lead.item.transport.line ? ` · ${lead.item.transport.line}` : ` · ${labelOf(MODE_LABEL, lead.item.transport.mode)}`}
          </small>
        </button>
      ) : (
        <p className="next-card">
          <span className="kicker">這天</span>
          <strong>已走完</strong>
          <small>{pickedHotel ? `今晚 ${pickedHotel.name}` : "可以休息了"}</small>
        </p>
      )}

      <section className="day-stage" ref={mapPanelRef} id="day-map">
        <div className="panel-head">
          <div className="map-switch">
            <button type="button" className={mapScope === "day" ? "on" : ""} onClick={() => setMapScope("day")}>
              當天
            </button>
            <button type="button" className={mapScope === "trip" ? "on" : ""} onClick={() => setMapScope("trip")}>
              全程
            </button>
          </div>
          <a href={googleSearchUrl(mapQuery)} target="_blank" rel="noreferrer">
            Google 地圖
          </a>
        </div>
        {mapScope === "trip" ? (
          <TripMap
            stops={tripStops}
            points={points}
            loading={mapLoading}
            focusNumber={focusNumber}
            activeDay={dayIndex}
            dayCount={doc.days.length}
            showLegend={false}
            onSelect={(di, ii) => {
              setDayIndex(di);
              setFocusIndex(ii);
              setFocusToken(Date.now());
            }}
          />
        ) : (
          <DayMap
            key={day.date}
            stops={stops}
            points={points}
            loading={mapLoading}
            focusNumber={focusNumber}
            focusToken={focusToken}
            color={dayColor(dayIndex)}
            onSelect={(index) => focusItem(index, false)}
          />
        )}
        <p className="day-spend">
          當天人均 {formatMoney(todayCost.perPersonDisplay, display)} · 全團 {formatMoney(todayCost.totalDisplay, display)}
          {pickedHotel ? ` · 今晚 ${pickedHotel.name}` : ""}
        </p>
      </section>

      {(day.routeLogic || day.tip || day.highlights.length > 0) && (
        <details className="quiet-details day-notes">
          <summary>當天怎麼走 · 叮嚀</summary>
          {day.routeLogic && <p className="route">{day.routeLogic}</p>}
          {day.tip && <p className="tip">叮嚀：{day.tip}</p>}
          <p className="day-spend-break">
            交通／機票 {formatMoney(todayCost.transportDisplay, display)}（全團）
            {" · "}
            餐飲人均 {formatMoney(todayCost.mealPerPersonDisplay, display)}
            {" · "}
            門票 {formatMoney(todayCost.ticketDisplay, display)}
            {todayCost.hotelPerPersonDisplay != null
              ? ` · 住宿人均 ${formatMoney(todayCost.hotelPerPersonDisplay, display)}${chosenHotel(night) ? `（${chosenHotel(night)?.name}）` : "（未選則用最平參考）"}`
              : " · 當晚無酒店"}
          </p>
          {day.highlights.length > 0 && (
            <ul className="highlights">
              {day.highlights.map((item) => (
                <li key={`${item.name}-${item.placeQuery}`}>
                  <span className="stars">{starsText(item.stars)}</span>
                  <span>{item.name}</span>
                  {item.bonus && <em>加料</em>}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}

      <section className="panel timeline-panel">
        <ol className="timeline">
          {day.timeline.map((item, index) => {
            const lineTotal = itemCost(item, display, rates);
            const ticketLabel = item.type === "meal" ? "餐費" : "門票";
            const stopNo = stopNumbers[index] ?? 0;
            const focused = focusIndex === index;
            const finished = done.has(doneKey(day.date, index, item.start));
            const bookUrl = needsBooking(item.transport) ? bookingFallbackUrl(item.transport, day.date, adults) : null;
            return (
            <li
              key={`${item.start}-${item.title}-${index}`}
              className={`${item.mustSee ? "must" : ""} ${focused ? "on" : ""} ${finished ? "is-done" : ""}`.trim()}
              onClick={() => focusItem(index)}
            >
              <div className="time">
                <div className="stop-row">
                  <label className="done-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={finished}
                      onChange={() => markDone(index, item.start)}
                      aria-label="已完成"
                    />
                  </label>
                  <LockButton
                    locked={item.locked}
                    onToggle={() => onChange(setItemLocked(doc, dayIndex, index, !item.locked))}
                  />
                  {stopNo > 0 && <span className="stop-order">第 {stopNo} 點</span>}
                </div>
                <strong>
                  {item.start}
                  {item.end ? `–${item.end}` : ""}
                </strong>
                {item.endNextDay && <small>跨日</small>}
                <span>{labelOf(TYPE_LABEL, item.type)}</span>
              </div>
              <div className="body">
                <div className="spot-main">
                  <PlacePhoto
                    imageUrl={item.imageUrl}
                    query={item.placeQuery || item.title}
                    title={item.title}
                    kind={item.type}
                    point={points.get(item.placeQuery.trim())}
                    alt={item.displayNameZh || item.title}
                  />
                  <div className="spot-copy">
                    <div className="item-head">
                      <h4>
                        {item.displayNameZh || item.title}
                        {item.mustSee ? <em className="must-tag">必看</em> : null}
                      </h4>
                      <strong className="item-price">{formatMoney(lineTotal, display)}</strong>
                    </div>
                    {item.displayNameZh && item.title !== item.displayNameZh && <p className="en">{item.title}</p>}
                    <p className="move">
                      {labelOf(MODE_LABEL, item.transport.mode)}
                      {item.transport.line ? ` · ${item.transport.line}` : ""}
                      {item.transport.durationMin != null ? ` · ${item.transport.durationMin} 分` : ""}
                      {item.transport.cost.amount != null
                        ? ` · ${formatMoney(item.transport.cost.amount, item.transport.cost.currency)}`
                        : ""}
                      {priceNote(item.transport.cost) ? ` · ${priceNote(item.transport.cost)}` : ""}
                    </p>
                    <TransitStops transport={item.transport} />
                    {(item.ticket.name || item.ticket.cost.amount != null) && (
                      <p className="ticket">
                        {ticketLabel}
                        {item.ticket.name ? ` ${item.ticket.name}` : ""}
                        {` · ${formatMoney(item.ticket.cost.amount, item.ticket.cost.currency)}`}
                        {priceNote(item.ticket.cost) ? ` · ${priceNote(item.ticket.cost)}` : ""}
                        {item.ticket.cost.source?.startsWith("http") && (
                          <>
                            {" · "}
                            <a href={item.ticket.cost.source} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                              來源
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {item.notes && <p className="notes">{item.notes}</p>}
                    <div className="links" onClick={(e) => e.stopPropagation()}>
                      <a href={googleSearchUrl(item.placeQuery)} target="_blank" rel="noreferrer">
                        地圖
                      </a>
                      {isKlookable(item) && (
                        <a href={klookHref(item, matchKlook(listedKlooks, item), day.date, adults)} target="_blank" rel="noreferrer">
                          Klook 搜門票
                        </a>
                      )}
                      {bookUrl && (
                        <a href={bookUrl} target="_blank" rel="noreferrer">
                          預約
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                {!skipStopEats(item.type) && (
                  <StopEats
                    item={item}
                    point={points.get(item.placeQuery.trim())}
                    city={day.stayCity}
                    day={day}
                    tripKey={tripEatKey(doc.trip.title, doc.trip.startDate, doc.trip.endDate)}
                    covers={heads}
                  />
                )}
                <TransitBox transport={item.transport} title={item.displayNameZh || item.title} />
                {(needsBooking(item.transport) || !item.locked) && (
                  <details className="quiet-details" onClick={(event) => event.stopPropagation()}>
                    <summary>{item.locked ? "訂票說明" : "修改此站"}</summary>
                    <BookingBox transport={item.transport} title={item.displayNameZh || item.title} date={day.date} adults={adults} />
                    <TimelineEdit
                      item={item}
                      onBackup={(backup) => onChange(applyBackup(doc, dayIndex, index, backup, local))}
                      onDelete={() => onChange(deleteTimelineItem(doc, dayIndex, index))}
                      onAddPlace={(place) => onChange(insertPlaceAfter(doc, dayIndex, index, place, local))}
                    />
                  </details>
                )}
              </div>
            </li>
            );
          })}
        </ol>
      </section>

      <details className="quiet-details day-eats-later">
        <summary>按時段訂午餐晚餐</summary>
        <DayEats
          day={day}
          points={points}
          hotelQuery={pickedHotel?.placeQuery || night?.nearPlaceQuery}
          city={day.stayCity}
          tripKey={tripEatKey(doc.trip.title, doc.trip.startDate, doc.trip.endDate)}
          covers={heads}
        />
      </details>

      <section className="panel">
        <div className="panel-head">
          <h3>今晚</h3>
          <span>{night ? labelOf(NIGHT_LABEL, night.type) : "沒有對應夜晚"}</span>
        </div>
        {!night && <p className="empty">這天沒有 nights 資料。</p>}
        {night && night.type !== "hotel" && (
          <div className="stay-card">
            <h4>{night.type === "night_train" ? "夜火車上過夜" : night.type === "flight" ? "飛行中過夜" : "今晚不住房"}</h4>
            {(night.transport || day.timeline.find((item) => item.transport.mode === "night_train" || item.transport.mode === "flight")) && (
              <details className="quiet-details stay-tools">
                <summary>訂票說明</summary>
                <BookingBox
                  transport={
                    night.transport ??
                    day.timeline.find((item) => item.transport.mode === "night_train" || item.transport.mode === "flight")!.transport
                  }
                  title={night.type === "night_train" ? "夜火車" : "當晚交通"}
                  date={night.date}
                  adults={adults}
                />
              </details>
            )}
          </div>
        )}
        {night?.type === "hotel" && rest && (
          <div className="stay">
            {pickedHotel ? (
              <div className="stay-card">
                <h4>{pickedHotel.name}</h4>
                <p className="hotel-meta">
                  {night.area || placeLabel(rest.query)} · {formatDateZh(night.date)} 入住
                  {" · "}
                  一房 {formatMoney(pickedHotel.cost.amount, pickedHotel.cost.currency)}
                  {pickedHotel.cost.amount != null ? ` · 人均 ${formatMoney(pickedHotel.cost.amount / heads, pickedHotel.cost.currency)}` : ""}
                </p>
                <div className="more-links">
                  <a
                    href={googleHotelStayUrl(
                      pickedHotel.placeQuery,
                      night.date,
                      addDays(night.date, 1),
                      adults,
                      points.get(pickedHotel.placeQuery.trim())?.lat,
                      points.get(pickedHotel.placeQuery.trim())?.lng,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查這間房價
                  </a>
                </div>
              </div>
            ) : (
              <p className="empty">還沒選今晚酒店。打開下面貼連結或從參考名單選。</p>
            )}
            <details className="quiet-details stay-extra">
              <summary>{pickedHotel ? "改酒店／貼連結" : "選酒店或貼連結"}</summary>
              {rest.reason && <p className="stay-why">{rest.reason}</p>}
              <div className="more-links">
                <a
                  href={googleHotelsLiveUrl(
                    rest.query,
                    night.date,
                    addDays(night.date, 1),
                    adults,
                    points.get(rest.query)?.lat,
                    points.get(rest.query)?.lng,
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  Google 查這帶
                </a>
                <a
                  href={tripHotelUrl(placeLabel(rest.query), night.city, night.date, addDays(night.date, 1), adults, children)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Trip.com 查這帶
                </a>
              </div>
              <form
                className="hotel-pick"
                onSubmit={(event) => {
                  event.preventDefault();
                  addCustomHotel(night.date, night.city);
                }}
              >
                <input
                  value={customHotel.name}
                  onChange={(event) => setCustomHotel({ ...customHotel, name: event.target.value })}
                  placeholder="貼 Google／Trip.com 連結，或打酒店英文名"
                />
                <input
                  value={customHotel.amount}
                  onChange={(event) => setCustomHotel({ ...customHotel, amount: event.target.value })}
                  placeholder={`一房一晚（${local}）`}
                  inputMode="decimal"
                />
                <button type="submit" className="text-btn">
                  加入當天酒店
                </button>
              </form>
              {night.candidates.length > 0 && (
                <ul className="hotels">
                {night.candidates.map((hotel) => {
                  const here = points.get(hotel.placeQuery.trim());
                  const fromQuery = lastSightOfDay(day)?.placeQuery || rest.query;
                  const access = hotelAccessTransport(fromQuery, hotel.placeQuery, night.transport);
                  const selected = night.chosenName === hotel.name;
                  const checkOut = addDays(night.date, 1);
                  return (
                  <li key={hotel.name} className={selected ? "hotel-card chosen" : "hotel-card"}>
                    <div className="hotel-card-top">
                      <div>
                        <h4>{hotel.name}{selected ? " · 已選" : ""}</h4>
                        <p className="hotel-meta">
                          {hotel.stars ? `${hotel.stars} 星 · ` : ""}
                          一房 {formatMoney(hotel.cost.amount, hotel.cost.currency)}
                          {hotel.cost.amount != null ? ` · 人均 ${formatMoney(hotel.cost.amount / heads, hotel.cost.currency)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="hotel-actions">
                      <a
                        className="hotel-main"
                        href={googleHotelStayUrl(hotel.placeQuery, night.date, checkOut, adults, here?.lat, here?.lng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        查這間 {formatDateZh(night.date)} 房價
                      </a>
                      <button type="button" className="text-btn" onClick={() => selectHotel(night.date, hotel)}>
                        {selected ? "已計入總額" : "用這間計總額"}
                      </button>
                    </div>
                    <div className="more-links">
                      <a
                        href={tripHotelUrl(hotel.name, night.city, night.date, checkOut, adults, children, here?.lat, here?.lng)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Trip.com 備用
                      </a>
                      <a href={googleDirUrl(access)} target="_blank" rel="noreferrer">
                        Google 交通
                      </a>
                    </div>
                  </li>
                  );
                })}
                </ul>
              )}
            </details>
          </div>
        )}
      </section>

      {klooks.length > 0 && (
      <section className="panel">
        <div className="panel-head">
          <h3>Klook</h3>
          <span>{klooks.length} 項</span>
        </div>
          <ul className="klooks">
            {klooks.map((item) => (
              <li key={`${item.date}-${item.name}`}>
                <div>
                  <strong>{item.name}</strong>
                  <p>
                    {formatMoney(item.cost.amount, item.cost.currency)}
                    {priceNote(item.cost) ? ` · ${priceNote(item.cost)}` : ""}
                  </p>
                </div>
                <a href={item.cost.source?.includes("klook.com") ? withKlookDate(item.cost.source, item.date) : klookUrl(item.searchQuery, item.date, adults)} target="_blank" rel="noreferrer">
                  在 Klook 搜尋
                </a>
              </li>
            ))}
          </ul>
      </section>
      )}
    </div>
  );
}
