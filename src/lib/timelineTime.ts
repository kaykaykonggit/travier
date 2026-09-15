import type { TimelineItem } from "../types";

export function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Stay length in minutes. Defaults to 45 when end is missing. */
export function dwellMinutes(item: TimelineItem): number {
  const start = toMinutes(item.start);
  if (!item.end) return 45;
  let end = toMinutes(item.end);
  if (item.endNextDay || end <= start) end += 24 * 60;
  return Math.max(15, end - start);
}

export function applyDwell(start: string, dwell: number): Pick<TimelineItem, "end" | "endNextDay"> {
  const endTotal = toMinutes(start) + Math.max(15, dwell);
  return {
    end: fromMinutes(endTotal),
    endNextDay: endTotal >= 24 * 60,
  };
}

export function travelGapMinutes(item: TimelineItem): number {
  return item.transport.durationMin != null && item.transport.durationMin >= 0 ? item.transport.durationMin : 0;
}

/** Keep each stop's dwell + travel gap; recompute start/end from an anchor. */
export function cascadeTimelineTimes(timeline: TimelineItem[], fromIndex = 0): TimelineItem[] {
  if (!timeline.length) return timeline;
  const next = timeline.map((item) => ({ ...item, transport: { ...item.transport } }));
  const anchor = Math.max(0, Math.min(fromIndex, next.length - 1));

  for (let i = anchor; i < next.length; i += 1) {
    const dwell = dwellMinutes(next[i]);
    if (i === anchor) {
      next[i] = { ...next[i], ...applyDwell(next[i].start, dwell) };
      continue;
    }
    const prev = next[i - 1];
    const prevEnd = toMinutes(prev.start) + dwellMinutes(prev);
    const gap = travelGapMinutes(next[i]);
    const startTotal = prevEnd + gap;
    const start = fromMinutes(startTotal);
    next[i] = {
      ...next[i],
      start,
      ...applyDwell(start, dwell),
    };
  }
  return next;
}

export function rewireTransportLinks(timeline: TimelineItem[]): TimelineItem[] {
  return timeline.map((item, index) => {
    const prev = timeline[index - 1];
    const from = prev?.placeQuery || item.transport.fromPlaceQuery;
    const to = item.placeQuery || item.transport.toPlaceQuery;
    return {
      ...item,
      transport: {
        ...item.transport,
        fromPlaceQuery: from,
        toPlaceQuery: to,
      },
    };
  });
}

export const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240] as const;

export function nearestDurationOption(minutes: number): number {
  let best: number = DURATION_OPTIONS[0];
  let bestDiff = Math.abs(minutes - best);
  for (const option of DURATION_OPTIONS) {
    const diff = Math.abs(minutes - option);
    if (diff < bestDiff) {
      best = option;
      bestDiff = diff;
    }
  }
  return best;
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!rest) return `${hours} 小時`;
  return `${hours} 小時 ${rest} 分`;
}
