import type { BackupPlace, Day, HotelCandidate, KlookItem, Money, Night, Ticket, TimelineItem, Transport, TripDoc } from "../types";
import { cleanSourceUrl, sanitizeTripJson } from "./sanitize";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeStayCity(value: string): string {
  const key = value.trim().toLowerCase().replace(/\s+/g, "_");
  if (["in_transit", "night_train", "flight", "none", "n/a"].includes(key)) return "in_transit";
  return value;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function imageUrlOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (!/^https?:\/\//i.test(url)) return null;
  if (/\.{3,}|placeholder|example\.com/i.test(url)) return null;
  if (/maps\.app\.goo\.gl|(www\.)?google\.[^/]+\/maps(\/|$)/i.test(url)) return null;
  return url;
}

function money(value: unknown): Money {
  if (!isRecord(value)) return { amount: null, currency: "EUR", estimated: true, source: null, asOf: null };
  return {
    amount: asNumberOrNull(value.amount),
    currency: asString(value.currency, "EUR") || "EUR",
    estimated: value.estimated !== false,
    source: cleanSourceUrl(typeof value.source === "string" ? value.source : null),
    asOf: typeof value.asOf === "string" && value.asOf ? value.asOf : null,
  };
}

function transport(value: unknown): Transport {
  const rec = isRecord(value) ? value : {};
  const fromStop = asString(rec.fromStop) || asString(rec.fromStation);
  const toStop = asString(rec.toStop) || asString(rec.toStation);
  return {
    mode: asString(rec.mode, "walk"),
    fromPlaceQuery: asString(rec.fromPlaceQuery),
    toPlaceQuery: asString(rec.toPlaceQuery),
    fromStop: fromStop || null,
    toStop: toStop || null,
    line: typeof rec.line === "string" ? rec.line : null,
    operator: typeof rec.operator === "string" ? rec.operator : null,
    durationMin: asNumberOrNull(rec.durationMin),
    cost: money(rec.cost),
    booking: bookingInfo(rec.booking),
  };
}

function bookingInfo(value: unknown): Transport["booking"] {
  if (!isRecord(value)) return null;
  const url = typeof value.url === "string" && value.url.trim() ? value.url.trim() : null;
  const how = asString(value.how);
  const why = asString(value.why);
  const required = value.required === true || Boolean(url || how || why);
  if (!required && !url && !how && !why) return null;
  return { required, url, how, why };
}

function ticketOf(value: unknown): Ticket {
  if (!isRecord(value)) return { name: null, cost: money(null) };
  return {
    name: typeof value.name === "string" ? value.name : null,
    cost: money(value.cost),
  };
}

function backupPlace(value: unknown): BackupPlace | null {
  if (!isRecord(value)) return null;
  const placeQuery = asString(value.placeQuery);
  const title = asString(value.title) || asString(value.displayNameZh);
  if (!placeQuery && !title) return null;
  return {
    title: title || placeQuery,
    displayNameZh: asString(value.displayNameZh, title),
    placeQuery: placeQuery || title,
    type: asString(value.type, "attraction"),
    notes: asString(value.notes),
    why: asString(value.why),
    imageUrl: imageUrlOf(value.imageUrl),
    ticket: ticketOf(value.ticket),
  };
}

function timelineItem(value: unknown): TimelineItem | null {
  if (!isRecord(value)) return null;
  const start = asString(value.start);
  if (!start) return null;
  return {
    start,
    end: typeof value.end === "string" ? value.end : null,
    endNextDay: asBool(value.endNextDay),
    type: asString(value.type, "attraction"),
    title: asString(value.title),
    placeQuery: asString(value.placeQuery),
    displayNameZh: asString(value.displayNameZh),
    mustSee: asBool(value.mustSee),
    notes: asString(value.notes),
    locked: value.locked !== false,
    imageUrl: imageUrlOf(value.imageUrl),
    transport: transport(value.transport),
    ticket: ticketOf(value.ticket),
    backups: Array.isArray(value.backups)
      ? value.backups.map(backupPlace).filter((item): item is BackupPlace => item != null)
      : [],
  };
}

function day(value: unknown): Day | null {
  if (!isRecord(value)) return null;
  const dayNum = typeof value.day === "number" ? value.day : Number(value.day);
  const date = asString(value.date);
  if (!date || !Number.isFinite(dayNum)) return null;
  const timeline = Array.isArray(value.timeline)
    ? value.timeline.map(timelineItem).filter((item): item is TimelineItem => item != null)
    : [];
  return {
    day: dayNum,
    date,
    title: asString(value.title),
    stayCity: normalizeStayCity(asString(value.stayCity)),
    countries: Array.isArray(value.countries) ? value.countries.map((c) => asString(c)).filter(Boolean) : [],
    routeLogic: asString(value.routeLogic),
    tip: asString(value.tip),
    highlights: Array.isArray(value.highlights)
      ? value.highlights.filter(isRecord).map((h) => ({
          name: asString(h.name),
          placeQuery: asString(h.placeQuery),
          stars: asNumberOrNull(h.stars) ?? 0,
          bonus: asBool(h.bonus),
        }))
      : [],
    timeline,
  };
}

function hotel(value: unknown): HotelCandidate | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name);
  if (!name) return null;
  return {
    name,
    placeQuery: asString(value.placeQuery, name),
    stars: asNumberOrNull(value.stars),
    cost: money(value.cost),
  };
}

function night(value: unknown): Night | null {
  if (!isRecord(value)) return null;
  const date = asString(value.date);
  if (!date) return null;
  return {
    date,
    city: asString(value.city),
    country: asString(value.country),
    area: typeof value.area === "string" ? value.area : null,
    nearPlaceQuery: typeof value.nearPlaceQuery === "string" && value.nearPlaceQuery.trim() ? value.nearPlaceQuery.trim() : null,
    nearReason: typeof value.nearReason === "string" && value.nearReason.trim() ? value.nearReason.trim() : null,
    type: asString(value.type, "hotel"),
    candidates: Array.isArray(value.candidates)
      ? value.candidates.map(hotel).filter((h): h is HotelCandidate => h != null)
      : [],
    chosenName: typeof value.chosenName === "string" && value.chosenName.trim() ? value.chosenName.trim() : null,
    transport: value.transport && isRecord(value.transport) ? transport(value.transport) : null,
  };
}

function klook(value: unknown): KlookItem | null {
  if (!isRecord(value)) return null;
  const name = asString(value.name);
  const date = asString(value.date);
  if (!name || !date) return null;
  return {
    date,
    name,
    searchQuery: asString(value.searchQuery, name),
    placeQuery: asString(value.placeQuery),
    cost: money(value.cost),
  };
}

export type ParseResult =
  | { ok: true; doc: TripDoc }
  | { ok: false; errors: string[] };

export function parseTripJson(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(sanitizeTripJson(raw));
  } catch (error) {
    const detail = error instanceof SyntaxError ? error.message : "";
    return {
      ok: false,
      errors: [
        "這不是合法 JSON。常見原因是 AI 在 true/false 後面多打了字，或 source 寫成 Markdown 連結。",
        detail,
      ].filter(Boolean),
    };
  }
  return parseTripDoc(data);
}

export function parseTripDoc(data: unknown): ParseResult {
  const errors: string[] = [];
  if (!isRecord(data)) return { ok: false, errors: ["最外層必須是一個物件。"] };
  if (!isRecord(data.trip)) errors.push("缺少 trip。");
  if (!Array.isArray(data.days) || data.days.length === 0) errors.push("days 必須是至少一天的陣列。");
  if (errors.length) return { ok: false, errors };

  const tripRec = data.trip as Record<string, unknown>;
  const origin = isRecord(tripRec.origin) ? tripRec.origin : {};
  const travelers = isRecord(tripRec.travelers) ? tripRec.travelers : {};
  const currencies = isRecord(tripRec.currencies) ? tripRec.currencies : {};
  const rawDays = data.days as unknown[];
  const days = rawDays.map(day).filter((d): d is Day => d != null);
  if (!days.length) return { ok: false, errors: ["days 裡沒有可讀的一天。"] };

  const doc: TripDoc = {
    schemaVersion: asString(data.schemaVersion, "1.0.0"),
    trip: {
      title: asString(tripRec.title, "未命名行程"),
      startDate: asString(tripRec.startDate, days[0].date),
      endDate: asString(tripRec.endDate, days[days.length - 1].date),
      origin: {
        city: asString(origin.city),
        country: asString(origin.country),
        iata: typeof origin.iata === "string" ? origin.iata : null,
      },
      travelers: {
        adults: asNumberOrNull(travelers.adults) ?? 1,
        children: asNumberOrNull(travelers.children) ?? 0,
      },
      currencies: {
        local: asString(currencies.local, "EUR"),
        display: asString(currencies.display, "HKD"),
      },
      pace: asString(tripRec.pace, "normal"),
      language: asString(tripRec.language, "zh-Hant"),
      notes: asString(tripRec.notes),
    },
    days,
    nights: Array.isArray(data.nights) ? data.nights.map(night).filter((n): n is Night => n != null) : [],
    klook: Array.isArray(data.klook) ? data.klook.map(klook).filter((k): k is KlookItem => k != null) : [],
  };

  return { ok: true, doc };
}
