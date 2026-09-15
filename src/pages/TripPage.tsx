import { useEffect, useMemo, useRef, useState } from "react";
import { BookingBox } from "../components/BookingBox";
import { DurationWheel } from "../components/DurationWheel";
import { EditBar } from "../components/EditBar";
import { TripTabs } from "../components/LifeIcons";
import { LifeLedger } from "../components/LifeLedger";
import { DayEats } from "../components/DayEats";
import { DayMap, type MapStop } from "../components/DayMap";
import { InfoTip } from "../components/InfoTip";
import { LockButton } from "../components/LockButton";
import { PlacePhoto } from "../components/PlacePhoto";
import { StopDragHandle } from "../components/StopDragHandle";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { StopEats } from "../components/StopEats";
import { TimelineEdit } from "../components/TimelineEdit";
import { TransitBox, TransitStops } from "../components/TransitBox";
import { TripMap, type TripMapStop } from "../components/TripMap";
import { geocodeMany, mergePoints, pointsFromCache, rememberPoint, type GeocodeQuery, type LatLng } from "../lib/geocode";
import { chosenHotel, collectCurrencies, fetchRates, formatMoney, itemCost, partySize, priceNote, summarizeDay, type RateTable } from "../lib/costs";
import { dayHeadline, dayPlace, shortPlace } from "../lib/dayLead";
import { addDays, formatDateZh, labelOf, MODE_LABEL, NIGHT_LABEL, PACE_LABEL, starsText, TYPE_LABEL, weekdayZh } from "../lib/labels";
import { dayKlookItems, isKlookable, klookHref, matchKlook } from "../lib/klook";
import { skipStopEats, tripEatKey } from "../lib/eats";
import { googleDirUrl, googleHotelsLiveUrl, googleHotelStayUrl, googleSearchUrl, klookUrl, parseHotelPaste, placeLabel, tripHotelUrl, withKlookDate } from "../lib/links";
import { hotelAccessTransport, lastSightOfDay, nightRestPoint } from "../lib/restPoint";
import {
  applyBackup,
  deleteTimelineItem,
  insertPlaceAfter,
  remapDoneKeysForDuration,
  remapDoneKeysForMove,
  repairTimelinePlace,
  replaceDayTimeline,
  reorderTimelineItem,
  setItemLocked,
  setTicketSource,
  setTimelineDuration,
} from "../lib/editTrip";
import { normalizeExpenseUrl } from "../lib/life";
import { isHomeAirportStop } from "../lib/homeStop";
import { isBareUrl, isShortMapsUrl, resolvePlaceInput } from "../lib/resolvePlace";
import { dayColor, tripStopNumbers } from "../lib/stops";
import { doneKey, loadDone, saveDone, toggleDone } from "../lib/progress";
import { initialDayIndex, leadOfDay } from "../lib/leadStop";
import { applyTripUpdate } from "../lib/patch";
import { stopPlaceOf, placeBreakLabel } from "../lib/stopPlace";
import { dwellMinutes, formatDurationLabel } from "../lib/timelineTime";
import { buildTweakPrompt } from "../lib/tweakPrompt";
import { buildSampleEditPrompt } from "../lib/template";
import { needsBooking, bookingFallbackUrl } from "../lib/booking";
import { archiveTrip } from "../lib/storage";
import { applyTheme, loadTheme, saveTheme, type ThemeId } from "../lib/theme";
import type { Day, HotelCandidate, Night, TimelineItem, TripDoc } from "../types";

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

function explicitPoints(doc: TripDoc): Map<string, LatLng> {
  const result = new Map<string, LatLng>();
  for (const entry of doc.days) {
    for (const item of entry.timeline) {
      const query = item.placeQuery.trim();
      if (!query || item.lat == null || item.lng == null) continue;
      const point = { lat: item.lat, lng: item.lng, label: item.displayNameZh || item.title || query };
      result.set(query, point);
      rememberPoint(query, point);
    }
  }
  return result;
}


export function TripPage({ doc, onChange, onReset }: { doc: TripDoc; onChange: (doc: TripDoc) => void; onReset: () => void }) {
  const [dayIndex, setDayIndex] = useState(() => initialDayIndex(doc.days));
  const [rates, setRates] = useState<RateTable>({ [doc.trip.currencies.display]: 1 });
  const [points, setPoints] = useState(() => mergePoints(pointsFromCache(allPlaceQueries(doc)), explicitPoints(doc)));
  const [mapLoading, setMapLoading] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [mapScope, setMapScope] = useState<"day" | "trip">("day");
  const [customHotel, setCustomHotel] = useState({ name: "", amount: "" });
  const [done, setDone] = useState(() => loadDone(doc));
  const [jsonDraft, setJsonDraft] = useState("");
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [tweakWish, setTweakWish] = useState("");
  const [tweakCopied, setTweakCopied] = useState<"day" | "full" | null>(null);
  const [applyNote, setApplyNote] = useState<string | null>(null);
  const [archivedMsg, setArchivedMsg] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<"trip" | "life">("trip");
  const [stopEdit, setStopEdit] = useState<{ dayIndex: number; itemIndex: number; snapshot: TimelineItem[] } | null>(null);
  const [stopTicketUrl, setStopTicketUrl] = useState("");
  const [hotelEditing, setHotelEditing] = useState(false);
  const [hotelSnapshot, setHotelSnapshot] = useState<Night | null>(null);
  const [durationIndex, setDurationIndex] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeId>(() => loadTheme());
  const mapPanelRef = useRef<HTMLElement | null>(null);
  const dayBarRef = useRef<HTMLElement | null>(null);
  const jumpRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<HTMLElement | null>(null);
  const failedLinks = useRef(new Set<string>());
  const swipeX = useRef<number | null>(null);

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

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
  const focusNumber =
    focusIndex != null
      ? stopNumbers[focusIndex] || null
      : lead
        ? stopNumbers[lead.index] || null
        : null;

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

  function startStopEdit(index: number) {
    const item = day.timeline[index];
    if (!item) return;
    setStopEdit({ dayIndex, itemIndex: index, snapshot: structuredClone(day.timeline) });
    setStopTicketUrl(item.ticket.cost.source ?? "");
    setFocusIndex(index);
    if (item.locked) onChange(setItemLocked(doc, dayIndex, index, false));
  }

  function saveStopEdit() {
    const index = stopEdit?.itemIndex ?? focusIndex;
    const di = stopEdit?.dayIndex ?? dayIndex;
    if (index == null) return;
    let next = setTicketSource(doc, di, index, normalizeExpenseUrl(stopTicketUrl));
    next = setItemLocked(next, di, index, true);
    onChange(next);
    setStopEdit(null);
    setStopTicketUrl("");
  }

  function cancelStopEdit() {
    if (stopEdit) {
      const restored = stopEdit.snapshot.map((item, index) =>
        index === stopEdit.itemIndex ? { ...item, locked: true } : item,
      );
      onChange(replaceDayTimeline(doc, stopEdit.dayIndex, restored));
    } else if (focusIndex != null) {
      onChange(setItemLocked(doc, dayIndex, focusIndex, true));
    }
    setStopEdit(null);
    setStopTicketUrl("");
  }

  function startHotelEdit() {
    if (!night || night.type !== "hotel") return;
    setHotelSnapshot(structuredClone(night));
    setHotelEditing(true);
  }

  function saveHotelEdit() {
    setHotelEditing(false);
    setHotelSnapshot(null);
    setCustomHotel({ name: "", amount: "" });
  }

  function cancelHotelEdit() {
    if (hotelSnapshot) {
      onChange({
        ...doc,
        nights: doc.nights.map((item) => (item.date === hotelSnapshot.date ? hotelSnapshot : item)),
      });
    }
    setHotelEditing(false);
    setHotelSnapshot(null);
    setCustomHotel({ name: "", amount: "" });
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

  function moveStop(from: number, to: number) {
    if (from === to) return;
    const prevTimeline = day.timeline;
    const nextDoc = reorderTimelineItem(doc, dayIndex, from, to);
    const nextTimeline = nextDoc.days[dayIndex]?.timeline ?? prevTimeline;
    const nextDone = remapDoneKeysForMove(done, day.date, from, to, nextTimeline, prevTimeline);
    setDone(nextDone);
    saveDone(nextDoc, nextDone);
    onChange(nextDoc);
    setFocusIndex(to);
    setFocusToken(Date.now());
    setDurationIndex(null);
  }

  function applyDuration(index: number, minutes: number) {
    const prevTimeline = day.timeline;
    const nextDoc = setTimelineDuration(doc, dayIndex, index, minutes);
    const nextTimeline = nextDoc.days[dayIndex]?.timeline ?? prevTimeline;
    const nextDone = remapDoneKeysForDuration(done, day.date, index, nextTimeline, prevTimeline);
    setDone(nextDone);
    saveDone(nextDoc, nextDone);
    onChange(nextDoc);
    setDurationIndex(null);
    setFocusIndex(index);
    setFocusToken(Date.now());
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
    setTweakCopied("day");
    window.setTimeout(() => setTweakCopied(null), 2000);
  }

  async function copyFull() {
    await navigator.clipboard.writeText(buildSampleEditPrompt(doc.trip.title, doc));
    setTweakCopied("full");
    window.setTimeout(() => setTweakCopied(null), 2000);
  }

  function goToDay(index: number) {
    if (index < 0 || index >= doc.days.length) return;
    setDayIndex(index);
    setFocusToken(0);
    dayBarRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function focusItem(index: number, scroll = true) {
    setFocusIndex(index);
    setFocusToken(Date.now());
    if (!scroll) return;
    // Wait for the expanded stop detail to layout, then scroll it into view
    // (timeline may live inside an overflow panel on desktop).
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`stop-${day.date}-${index}`);
        if (!el) return;
        const panel = timelineRef.current;
        if (panel && panel.scrollHeight > panel.clientHeight + 4) {
          const panelRect = panel.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const nextTop = panel.scrollTop + (elRect.top - panelRect.top) - 12;
          panel.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      });
    });
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
    setFocusIndex(null);
    setFocusToken(0);
    setDurationIndex(null);
  }, [day.date]);

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
    const pinned = explicitPoints(doc);
    const cached = mergePoints(pointsFromCache(allInputs.map((item) => item.query)), pinned);
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
    <div className={`trip-page trip-outing${mainTab === "life" ? " tab-life" : " tab-trip"}`}>
      {mainTab === "life" ? (
        <>
          <LifeLedger doc={doc} rates={rates} onChange={onChange} />
          <TripTabs tab="life" onChange={setMainTab} />
        </>
      ) : (
        <>

      <header className="trip-top compact">
        <div className="trip-top-row">
          <div className="trip-id">
            <p className="trip-title-line">{doc.trip.title}</p>
            <p className="trip-meta-desk">
              {formatDateZh(doc.trip.startDate)} – {formatDateZh(doc.trip.endDate)} · {doc.days.length} 天 · {adults} 大人
              {children ? ` ${children} 小孩` : ""} · {labelOf(PACE_LABEL, doc.trip.pace)}
            </p>
          </div>
          <div className="trip-top-actions">
            <ThemeSwitch value={theme} onChange={setTheme} />
            <details className="quiet-details trip-plan-tools tweak-panel">
              <summary>改當日</summary>
              <div className="trip-plan-pop">
          <div className="tweak-row">
            <span className="import-label">用法</span>
            <InfoTip title="如何改當天行程">
              <ol>
                <li>先切到要改的那一天。</li>
                <li>小改（換後備、刪站、貼地圖加站、換酒店）直接在時間軸操作，不必找 AI。</li>
                <li>要重排整天：解鎖想改的站 → 寫「想怎麼改」→「複製當日」貼到 ChatGPT／Gemini。</li>
                <li>要改日期、人數或整份大翻：用「複製全程」，AI 會拿到完整行程 JSON。</li>
                <li>AI 只改當天時回傳 <strong>patch</strong>（<code>schemaVersion: "1.0.0-patch"</code>）。整份大改則回傳完整行程 JSON。</li>
                <li>把回復貼回「貼上 AI 回復」→「套用」。其他日子與已打勾進度會保留。</li>
              </ol>
              <p>從零重新規劃：用「換行程」回到匯入頁。</p>
            </InfoTip>
          </div>
          <div className="tweak-row">
            <label className="import-label" htmlFor="tweak-wish">
              想怎麼改這一天
            </label>
            <InfoTip title="想怎麼改該怎麼寫">
              <p>只針對你正在查看的那一天。越具體越穩定。</p>
              <ul>
                <li>改景點：「下午不要去美泉宮，改去市區附近的步行景點」</li>
                <li>改酒店：「今晚改到火車站附近」</li>
                <li>改節奏：「不要太緊湊，刪掉一個下午景點」</li>
              </ul>
              <p>留空＝僅允許 AI 修改這一天明顯錯誤的交通／時間，其餘幾乎保持原樣。</p>
            </InfoTip>
          </div>
          <textarea
            id="tweak-wish"
            className="json-update"
            value={tweakWish}
            onChange={(event) => setTweakWish(event.target.value)}
            placeholder="例如：下午換成步行可到的景點"
          />
          <button type="button" className="btn btn-primary" onClick={() => void copyTweak()}>
            {tweakCopied === "day" ? "已複製當日" : "複製當日"}
          </button>
          <button type="button" className="text-btn" onClick={() => void copyFull()}>
            {tweakCopied === "full" ? "已複製全程" : "複製全程"}
          </button>
          <div className="tweak-row tweak-paste-label">
            <label className="import-label" htmlFor="tweak-json">
              貼上 AI 回復
            </label>
            <InfoTip title="貼上哪種 JSON">
              <p>
                <strong>首選 patch</strong>：AI 應回傳
                <code>{`{"schemaVersion":"1.0.0-patch","days":[...],"nights":[],"klook":[]}`}</code>
                ，而且 <code>days</code> 只放你改的那一天。App 會合併，已鎖定站點與已選酒店會保留。
              </p>
              <p>
                <strong>完整行程</strong>：若 AI 回傳包含整週 <code>days</code> 的大型 JSON，會整份取代（打勾進度仍會保留）。請要求它只改當天。
              </p>
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
              </div>
            </details>
            <details className="quiet-details trip-plan-tools">
              <summary>設定</summary>
              <div className="trip-plan-pop">
          <p className="trip-meta trip-meta-inline">
            {formatDateZh(doc.trip.startDate)} – {formatDateZh(doc.trip.endDate)} · {adults} 大人
            {doc.trip.travelers.children ? ` ${doc.trip.travelers.children} 小孩` : ""}
          </p>
          {doc.trip.notes && <p className="trip-notes">{doc.trip.notes}</p>}
              </div>
            </details>
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                const saved = archiveTrip(doc);
                setArchivedMsg(`已存「${saved.title}」。按「換行程」可再打開。`);
                window.setTimeout(() => setArchivedMsg(null), 4000);
              }}
            >
              封存
            </button>
            <button type="button" className="text-btn" onClick={onReset}>
              換行程
            </button>
          </div>
        </div>
        {archivedMsg ? <p className="archive-toast">{archivedMsg}</p> : null}
      </header>

      <div className="trip-workspace">
      <div className="trip-chrome">
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
            第 {dayIndex + 1} / {doc.days.length} 天 · {formatDateZh(day.date)} 週{weekdayZh(day.date)}
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
      </div>

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
            onSelect={(index) => focusItem(index, true)}
          />
        )}
        <p className="day-spend">
          當天人均 {formatMoney(todayCost.perPersonDisplay, display)} · 全團 {formatMoney(todayCost.totalDisplay, display)}
          {pickedHotel ? ` · 今晚 ${pickedHotel.name}` : ""}
        </p>
      </section>

      <div className="trip-rail">
      <section className="panel timeline-panel" ref={timelineRef}>
        <ol className="timeline">
          {day.timeline.map((item, index) => {
            const lineTotal = itemCost(item, display, rates);
            const ticketLabel = item.type === "meal" ? "餐費" : "門票";
            const stopNo = stopNumbers[index] ?? 0;
            const focused = focusIndex === index;
            const editingThis = stopEdit?.dayIndex === dayIndex && stopEdit?.itemIndex === index;
            const isLead = lead?.index === index;
            const finished = done.has(doneKey(day.date, index, item.start));
            const bookUrl = needsBooking(item.transport) ? bookingFallbackUrl(item.transport, day.date, adults) : null;
            const place = stopPlaceOf(item, day.stayCity);
            const prevPlace = index > 0 ? stopPlaceOf(day.timeline[index - 1], day.stayCity) : null;
            const cityBreak = Boolean(place.key && prevPlace && prevPlace.key && prevPlace.key !== place.key);
            const away = Boolean(place.city && day.stayCity !== "in_transit" && place.city.toLowerCase() !== day.stayCity.toLowerCase());
            return (
            <li
              id={`stop-${day.date}-${index}`}
              key={`${item.start}-${item.title}-${index}`}
              data-stop-index={index}
              className={`timeline-stop ${item.mustSee ? "must" : ""} ${focused ? "on" : ""} ${isLead ? "is-lead" : ""} ${finished ? "is-done" : ""}`.trim()}
            >
              {cityBreak ? (
                <p className="place-break">
                  <span>{placeBreakLabel(place)}</span>
                </p>
              ) : null}
              <div className="stop-compact-row">
                <div className="stop-index-col">
                  <StopDragHandle
                    index={index}
                    disabled={day.timeline.length <= 1}
                    onReorder={moveStop}
                  />
                  <span className="stop-num" style={{ background: dayColor(dayIndex) }}>
                    {stopNo > 0 ? stopNo : "·"}
                  </span>
                </div>
                <button type="button" className="stop-compact" onClick={() => focusItem(index, true)}>
                  <span className="stop-time">
                    {item.start}
                    {item.end ? `–${item.end}` : ""}
                  </span>
                  <span className="stop-copy">
                    <span className="stop-name">
                      {item.displayNameZh || item.title}
                      {item.mustSee ? <em className="must-tag">必看</em> : null}
                    </span>
                    {place.label ? (
                      <span className={`stop-place${away ? " is-away" : ""}`}>{place.label}</span>
                    ) : null}
                  </span>
                  <span className="stop-meta">{labelOf(TYPE_LABEL, item.type)}</span>
                </button>
                <div className="stop-compact-actions">
                  <button
                    type="button"
                    className={`text-btn stop-duration-btn${durationIndex === index ? " on" : ""}`}
                    onClick={() => setDurationIndex((current) => (current === index ? null : index))}
                    aria-label="調整活動時長"
                    title="時長"
                  >
                    {formatDurationLabel(dwellMinutes(item))}
                  </button>
                  <label className="done-check">
                    <input
                      type="checkbox"
                      checked={finished}
                      onChange={() => markDone(index, item.start)}
                      aria-label="已完成"
                    />
                  </label>
                  <LockButton
                    locked={item.locked && !editingThis}
                    onToggle={() => {
                      if (item.locked && !editingThis) startStopEdit(index);
                      else saveStopEdit();
                    }}
                  />
                </div>
              </div>
              {durationIndex === index ? (
                <DurationWheel
                  valueMin={dwellMinutes(item)}
                  onClose={() => setDurationIndex(null)}
                  onConfirm={(minutes) => applyDuration(index, minutes)}
                />
              ) : null}
              {focused ? (
              <div className="stop-detail body">
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
                      <h4>{item.displayNameZh || item.title}</h4>
                      <strong className={`item-price${lineTotal ? "" : " is-zero"}`}>{lineTotal ? formatMoney(lineTotal, display) : "—"}</strong>
                    </div>
                    {item.displayNameZh && item.title !== item.displayNameZh && <p className="en">{item.title}</p>}
                    {place.label ? <p className="stop-place-detail">{place.label}</p> : null}
                    <p className="move">
                      {labelOf(MODE_LABEL, item.transport.mode)}
                      {item.transport.line ? ` · ${item.transport.line}` : ""}
                      {item.transport.durationMin != null ? ` · ${item.transport.durationMin} 分鐘` : ""}
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
                    <div className="stop-tools" onClick={(e) => e.stopPropagation()}>
                      <a className="tool-chip" href={googleSearchUrl(item.placeQuery)} target="_blank" rel="noreferrer">
                        地圖
                      </a>
                      {isKlookable(item) && (
                        <a
                          className="tool-chip"
                          href={klookHref(item, matchKlook(listedKlooks, item), day.date, adults)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          門票
                        </a>
                      )}
                      {bookUrl && (
                        <a className="tool-chip" href={bookUrl} target="_blank" rel="noreferrer">
                          預約
                        </a>
                      )}
                      <TransitBox transport={item.transport} title={item.displayNameZh || item.title} />
                      {needsBooking(item.transport) && (
                        <details className="tool-details">
                          <summary>訂票</summary>
                          <BookingBox transport={item.transport} title={item.displayNameZh || item.title} date={day.date} adults={adults} />
                        </details>
                      )}
                      <EditBar
                        editing={editingThis}
                        onEdit={() => startStopEdit(index)}
                        onSave={saveStopEdit}
                        onCancel={cancelStopEdit}
                      />
                    </div>
                    {editingThis ? (
                      <TimelineEdit
                        item={item}
                        ticketUrl={stopTicketUrl}
                        onTicketUrl={setStopTicketUrl}
                        onBackup={(backup) => onChange(applyBackup(doc, dayIndex, index, backup, local))}
                        onDelete={() => onChange(deleteTimelineItem(doc, dayIndex, index))}
                        onAddPlace={(place) => onChange(insertPlaceAfter(doc, dayIndex, index, place, local))}
                      />
                    ) : null}
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
              </div>
              ) : null}
            </li>
            );
          })}
        </ol>
      </section>

      <div className="trip-extras">
      <details className="quiet-details extras-stay">
        <summary>
          今晚
          {pickedHotel
            ? ` · ${pickedHotel.name}`
            : night?.type === "hotel"
              ? " · 未選酒店"
              : night
                ? ` · ${labelOf(NIGHT_LABEL, night.type)}`
                : ""}
        </summary>
      <section className="panel extras-stay-panel">
        <div className="panel-head">
          <h3>今晚</h3>
          <span>{night ? labelOf(NIGHT_LABEL, night.type) : "沒有對應的夜晚"}</span>
          {night?.type === "hotel" ? (
            <EditBar editing={hotelEditing} onEdit={startHotelEdit} onSave={saveHotelEdit} onCancel={cancelHotelEdit} />
          ) : null}
        </div>
        {!night && <p className="empty">這天沒有 nights 資料。</p>}
        {night && night.type !== "hotel" && (
          <div className="stay-card">
            <h4>{night.type === "night_train" ? "在夜火車上過夜" : night.type === "flight" ? "在飛行中過夜" : "今晚不住宿"}</h4>
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
                    查詢這間房價
                  </a>
                </div>
              </div>
            ) : (
              <p className="empty">尚未選擇今晚酒店。請按「修改」貼上連結或從參考名單中選擇。</p>
            )}
            {hotelEditing ? (
              <div className="stay-edit">
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
                  Google 查詢這一帶
                </a>
                <a
                  href={tripHotelUrl(placeLabel(rest.query), night.city, night.date, addDays(night.date, 1), adults, children)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Trip.com 查詢這一帶
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
                  placeholder="貼上 Google／Trip.com 連結，或輸入酒店英文名稱"
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
                        <h4>{hotel.name}{selected ? " · 已選擇" : ""}</h4>
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
                        查詢這間房價
                      </a>
                      <button type="button" className="text-btn" onClick={() => selectHotel(night.date, hotel)}>
                        {selected ? "已計入總額" : "使用這間計算總額"}
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
              </div>
            ) : null}
          </div>
        )}
      </section>
      </details>

      <details className="quiet-details extras-eats">
        <summary>訂餐</summary>
        <DayEats
          day={day}
          points={points}
          hotelQuery={pickedHotel?.placeQuery || night?.nearPlaceQuery}
          city={day.stayCity}
          tripKey={tripEatKey(doc.trip.title, doc.trip.startDate, doc.trip.endDate)}
          covers={heads}
        />
      </details>

      <details className="quiet-details extras-more">
        <summary>叮嚀{klooks.length ? ` · 門票 ${klooks.length}` : ""}</summary>
      {(day.routeLogic || day.tip || day.highlights.length > 0) && (
        <div className="day-notes">
          {day.routeLogic && <p className="route">{day.routeLogic}</p>}
          {day.tip && <p className="tip">叮嚀：{day.tip}</p>}
          <p className="day-spend-break">
            交通／機票 {formatMoney(todayCost.transportDisplay, display)}（全團）
            {" · "}
            餐飲人均 {formatMoney(todayCost.mealPerPersonDisplay, display)}
            {" · "}
            門票 {formatMoney(todayCost.ticketDisplay, display)}
            {todayCost.hotelPerPersonDisplay != null
              ? ` · 住宿人均 ${formatMoney(todayCost.hotelPerPersonDisplay, display)}${chosenHotel(night) ? `（${chosenHotel(night)?.name}）` : "（未選擇則使用最低價參考）"}`
              : " · 當晚無住宿"}
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
        </div>
      )}
      {klooks.length > 0 && (
      <section className="panel">
        <div className="panel-head">
          <h3>Klook</h3>
          <span>{klooks.length} 項目</span>
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
      {!day.routeLogic && !day.tip && day.highlights.length === 0 && klooks.length === 0 ? (
        <p className="empty">這天沒有額外叮嚀。</p>
      ) : null}
      </details>
      </div>
      </div>
      </div>
          <TripTabs tab="trip" onChange={setMainTab} />
        </>
      )}
    </div>
  );
}
