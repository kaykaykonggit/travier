import type { TripDoc } from "../types";

const KEY = "travier.done.v1";

function tripId(doc: TripDoc): string {
  return `${doc.trip.startDate}:${doc.trip.title}`;
}

export function doneKey(date: string, index: number, start: string): string {
  return `${date}#${index}#${start}`;
}

function loadAll(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadDone(doc: TripDoc): Set<string> {
  return new Set(loadAll()[tripId(doc)] ?? []);
}

export function saveDone(doc: TripDoc, done: Set<string>): void {
  const all = loadAll();
  all[tripId(doc)] = [...done];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function toggleDone(done: Set<string>, key: string): Set<string> {
  const next = new Set(done);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}
