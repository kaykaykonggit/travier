import type { Day, KlookItem, Night, TimelineItem, TripDoc } from "../types";
import { parseDay, parseKlook, parseNight, parseTripDoc, type ParseResult } from "./parse";
import { sanitizeTripJson } from "./sanitize";

export type TripPatch = {
  schemaVersion: string;
  days: Day[];
  nights: Night[];
  klook: KlookItem[];
};

export type ApplyUpdateResult =
  | { ok: true; doc: TripDoc; mode: "full" | "patch" }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function looksLikePatch(data: unknown): boolean {
  if (!isRecord(data)) return false;
  const version = typeof data.schemaVersion === "string" ? data.schemaVersion : "";
  if (version.includes("patch")) return true;
  if (isRecord(data.trip) && Array.isArray(data.days) && data.days.length > 0) return false;
  return Array.isArray(data.days) || Array.isArray(data.nights) || Array.isArray(data.klook);
}

function mergeTimelinePreserveLocked(oldItems: TimelineItem[], nextItems: TimelineItem[]): TimelineItem[] {
  const lockedByStart = new Map(oldItems.filter((item) => item.locked).map((item) => [item.start, item]));
  const used = new Set<string>();
  const merged = nextItems.map((item) => {
    const locked = lockedByStart.get(item.start);
    if (locked) {
      used.add(item.start);
      return locked;
    }
    return item;
  });
  for (const [start, locked] of lockedByStart) {
    if (used.has(start)) continue;
    const insertAt = merged.findIndex((item) => item.start > start);
    if (insertAt < 0) merged.push(locked);
    else merged.splice(insertAt, 0, locked);
  }
  return merged;
}

function mergeDay(oldDay: Day, nextDay: Day): Day {
  // Empty timeline = metadata-only tweak (title/tip/etc); keep existing stops.
  if (!nextDay.timeline.length) {
    return {
      ...oldDay,
      title: nextDay.title || oldDay.title,
      stayCity: nextDay.stayCity || oldDay.stayCity,
      countries: nextDay.countries.length ? nextDay.countries : oldDay.countries,
      routeLogic: nextDay.routeLogic || oldDay.routeLogic,
      tip: nextDay.tip || oldDay.tip,
      highlights: nextDay.highlights.length ? nextDay.highlights : oldDay.highlights,
    };
  }
  return {
    ...nextDay,
    day: oldDay.day,
    date: oldDay.date,
    timeline: mergeTimelinePreserveLocked(oldDay.timeline, nextDay.timeline),
  };
}

function mergeNight(oldNight: Night | undefined, nextNight: Night): Night {
  if (!oldNight) return nextNight;
  return {
    ...nextNight,
    date: oldNight.date,
    chosenName: nextNight.chosenName?.trim() ? nextNight.chosenName : oldNight.chosenName,
  };
}

export function parseTripPatch(data: unknown): { ok: true; patch: TripPatch } | { ok: false; errors: string[] } {
  if (!isRecord(data)) return { ok: false, errors: ["最外層必須是一個物件。"] };
  const days = Array.isArray(data.days) ? data.days.map(parseDay).filter((d): d is Day => d != null) : [];
  const nights = Array.isArray(data.nights) ? data.nights.map(parseNight).filter((n): n is Night => n != null) : [];
  const klook = Array.isArray(data.klook) ? data.klook.map(parseKlook).filter((k): k is KlookItem => k != null) : [];
  if (!days.length && !nights.length && !klook.length) {
    return { ok: false, errors: ["patch 至少須包含 days、nights 或 klook 其中一項。"] };
  }
  return {
    ok: true,
    patch: {
      schemaVersion: typeof data.schemaVersion === "string" ? data.schemaVersion : "1.0.0-patch",
      days,
      nights,
      klook,
    },
  };
}

export function applyTripPatch(doc: TripDoc, patch: TripPatch): ParseResult {
  const errors: string[] = [];
  let days = doc.days;
  let nights = doc.nights;
  let klook = doc.klook;

  if (patch.days.length) {
    const byDate = new Map(doc.days.map((day) => [day.date, day]));
    days = doc.days.map((day) => {
      const next = patch.days.find((item) => item.date === day.date);
      return next ? mergeDay(day, next) : day;
    });
    for (const next of patch.days) {
      if (byDate.has(next.date)) continue;
      errors.push(`patch 包含未知日期的 days：${next.date}（不會新增天數，僅可修改現有天數）`);
    }
  }

  if (patch.nights.length) {
    const existing = new Map(doc.nights.map((night) => [night.date, night]));
    nights = doc.nights.map((night) => {
      const next = patch.nights.find((item) => item.date === night.date);
      return next ? mergeNight(night, next) : night;
    });
    for (const next of patch.nights) {
      if (existing.has(next.date)) continue;
      if (!doc.days.some((day) => day.date === next.date)) {
        errors.push(`patch 包含未知日期的 nights：${next.date}`);
        continue;
      }
      nights = [...nights, mergeNight(undefined, next)];
    }
  }

  if (patch.klook.length) {
    const dates = new Set(patch.klook.map((item) => item.date));
    const unknown = [...dates].filter((date) => !doc.days.some((day) => day.date === date));
    for (const date of unknown) errors.push(`patch 包含未知日期的 klook：${date}`);
    klook = [...doc.klook.filter((item) => !dates.has(item.date)), ...patch.klook.filter((item) => !unknown.includes(item.date))];
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    doc: {
      ...doc,
      days,
      nights,
      klook,
    },
  };
}

export function applyTripUpdate(current: TripDoc, raw: string): ApplyUpdateResult {
  let data: unknown;
  try {
    data = JSON.parse(sanitizeTripJson(raw));
  } catch (error) {
    const detail = error instanceof SyntaxError ? error.message : "";
    return {
      ok: false,
      errors: [
        "這不是合法的 JSON。常見原因是 AI 在 true/false 後面多打了字，或將 source 寫成 Markdown 連結。",
        detail,
      ].filter(Boolean),
    };
  }

  if (looksLikePatch(data)) {
    const parsed = parseTripPatch(data);
    if (!parsed.ok) return parsed;
    const merged = applyTripPatch(current, parsed.patch);
    if (!merged.ok) return merged;
    return { ok: true, doc: merged.doc, mode: "patch" };
  }

  const full = parseTripDoc(data);
  if (!full.ok) return full;
  return { ok: true, doc: full.doc, mode: "full" };
}
