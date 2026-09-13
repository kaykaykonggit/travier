import type { TripDoc } from "../types";
import { parseTripDoc } from "./parse";

const KEY = "travier.trip.v1";

export function loadStoredTrip(): TripDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = parseTripDoc(JSON.parse(raw));
    return parsed.ok ? parsed.doc : null;
  } catch {
    return null;
  }
}

export function saveTrip(doc: TripDoc): void {
  localStorage.setItem(KEY, JSON.stringify(doc));
}

export function clearTrip(): void {
  localStorage.removeItem(KEY);
}
