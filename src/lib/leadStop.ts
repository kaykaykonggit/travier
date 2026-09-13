import type { Day, TimelineItem } from "../types";

export type LeadKind = "now" | "next" | "done";

export type DayLead = {
  kind: LeadKind;
  index: number;
  item: TimelineItem;
};

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

function todayIso(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function leadOfDay(day: Day, isDone: (index: number) => boolean, now = new Date()): DayLead | null {
  const pending = day.timeline.map((item, index) => ({ item, index })).filter((row) => !isDone(row.index));
  if (!pending.length) return null;

  if (day.date !== todayIso(now)) {
    return { kind: "next", index: pending[0].index, item: pending[0].item };
  }

  const clock = now.getHours() * 60 + now.getMinutes();
  for (const row of pending) {
    const start = toMinutes(row.item.start);
    const end = row.item.end ? toMinutes(row.item.end) : start + 45;
    const last = row.item.endNextDay ? end + 24 * 60 : end;
    if (clock >= start && clock < last) return { kind: "now", index: row.index, item: row.item };
    if (clock < start) return { kind: "next", index: row.index, item: row.item };
  }
  return { kind: "next", index: pending[pending.length - 1].index, item: pending[pending.length - 1].item };
}

export function initialDayIndex(days: { date: string }[], now = new Date()): number {
  const today = todayIso(now);
  const index = days.findIndex((item) => item.date === today);
  return index >= 0 ? index : 0;
}
