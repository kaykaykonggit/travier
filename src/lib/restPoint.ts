import type { Day, Night, TimelineItem, Transport } from "../types";

const SKIP_TYPES = new Set(["transit", "flight", "night_train", "hotel", "rest"]);

function isSight(item: TimelineItem): boolean {
  return Boolean(item.placeQuery.trim()) && !SKIP_TYPES.has(item.type);
}

export function lastSightOfDay(day: Day): TimelineItem | null {
  for (let i = day.timeline.length - 1; i >= 0; i -= 1) {
    const item = day.timeline[i];
    if (isSight(item) && item.type !== "meal") return item;
  }
  for (let i = day.timeline.length - 1; i >= 0; i -= 1) {
    if (isSight(day.timeline[i])) return day.timeline[i];
  }
  return null;
}

export function firstSightOfDay(day: Day): TimelineItem | null {
  return day.timeline.find((item) => isSight(item) && item.type !== "meal") ?? null;
}

export function nightRestPoint(
  night: Night,
  today: Day,
  tomorrow?: Day,
): { query: string; reason: string } {
  if (night.nearPlaceQuery) {
    return { query: night.nearPlaceQuery, reason: restReasonText(night.nearReason ?? "") };
  }
  const evening = lastSightOfDay(today);
  const morning = tomorrow ? firstSightOfDay(tomorrow) : null;
  if (evening) {
    const eveningName = evening.displayNameZh || evening.title;
    const morningName = morning ? morning.displayNameZh || morning.title : "";
    const reason = morningName
      ? `今日行程結束於「${eveningName}」，明早出發去「${morningName}」`
      : `今日行程結束於「${eveningName}」`;
    return { query: evening.placeQuery, reason };
  }
  if (night.area) return { query: `${night.area}, ${night.city}`, reason: restReasonText(night.nearReason ?? "") };
  return { query: night.city, reason: "" };
}

export function restReasonText(reason: string): string {
  return reason
    .replace(/今晚收工近/g, "今日行程結束於")
    .replace(/今晚(.+?)收工/g, "今日行程結束於$1")
    .replace(/收工近/g, "行程結束於");
}

export function hotelAccessTransport(fromQuery: string, hotelQuery: string, hint?: Transport | null): Transport {
  return {
    mode: hint?.mode && hint.mode !== "flight" ? hint.mode : "metro",
    fromPlaceQuery: fromQuery,
    toPlaceQuery: hotelQuery,
    fromStop: hint?.fromStop ?? null,
    toStop: hint?.toStop ?? null,
    line: hint?.line ?? null,
    operator: hint?.operator ?? null,
    durationMin: hint?.durationMin ?? null,
    cost: hint?.cost ?? { amount: null, currency: "EUR", estimated: true, source: null, asOf: null },
    booking: hint?.booking ?? null,
  };
}
