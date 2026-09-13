import type { TripDoc } from "../types";
import { parseTripDoc } from "./parse";

const ACTIVE_KEY = "travier.trip.v1";
const LIBRARY_KEY = "travier.trips.library.v1";

export type SavedTripMeta = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  savedAt: string;
};

export type SavedTrip = SavedTripMeta & { doc: TripDoc };

export function loadStoredTrip(): TripDoc | null {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (!raw) return null;
    const parsed = parseTripDoc(JSON.parse(raw));
    return parsed.ok ? parsed.doc : null;
  } catch {
    return null;
  }
}

export function saveTrip(doc: TripDoc): void {
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(doc));
}

export function clearTrip(): void {
  localStorage.removeItem(ACTIVE_KEY);
}

function tripId(doc: TripDoc): string {
  return `${doc.trip.title}|${doc.trip.startDate}|${doc.trip.endDate}`;
}

function readLibrary(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SavedTrip[];
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        const parsed = parseTripDoc(entry.doc);
        if (!parsed.ok) return null;
        return {
          id: entry.id || tripId(parsed.doc),
          title: parsed.doc.trip.title,
          startDate: parsed.doc.trip.startDate,
          endDate: parsed.doc.trip.endDate,
          savedAt: entry.savedAt || new Date().toISOString(),
          doc: parsed.doc,
        } satisfies SavedTrip;
      })
      .filter((item): item is SavedTrip => item != null);
  } catch {
    return [];
  }
}

function writeLibrary(list: SavedTrip[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

export function listSavedTrips(): SavedTripMeta[] {
  return readLibrary().map(({ id, title, startDate, endDate, savedAt }) => ({
    id,
    title,
    startDate,
    endDate,
    savedAt,
  }));
}

export function loadSavedTrip(id: string): TripDoc | null {
  return readLibrary().find((item) => item.id === id)?.doc ?? null;
}

/** Archive current itinerary into the on-device library (no backend yet). */
export function archiveTrip(doc: TripDoc): SavedTripMeta {
  const list = readLibrary().filter((item) => item.id !== tripId(doc));
  const entry: SavedTrip = {
    id: tripId(doc),
    title: doc.trip.title,
    startDate: doc.trip.startDate,
    endDate: doc.trip.endDate,
    savedAt: new Date().toISOString(),
    doc,
  };
  writeLibrary([entry, ...list].slice(0, 20));
  saveTrip(doc);
  return entry;
}

export function deleteSavedTrip(id: string): void {
  writeLibrary(readLibrary().filter((item) => item.id !== id));
}
