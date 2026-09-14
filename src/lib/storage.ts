import type { TripDoc } from "../types";
import { parseTripDoc } from "./parse";

const ACTIVE_KEY = "travier.trip.v1";
const LIBRARY_KEY = "travier.trips.library.v1";
const LIBRARY_ID_KEY = "travier.trip.libraryId";

export type SavedTripMeta = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  savedAt: string;
  dayCount: number;
  places: string;
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
  syncLinkedLibrary(doc);
}

export function clearTrip(): void {
  localStorage.removeItem(ACTIVE_KEY);
  localStorage.removeItem(LIBRARY_ID_KEY);
}

function tripId(doc: TripDoc): string {
  return `${doc.trip.title}|${doc.trip.startDate}|${doc.trip.endDate}`;
}

function citiesOf(doc: TripDoc): string {
  const firstIndex = new Map<string, number>();
  const cities: string[] = [];
  doc.days.forEach((day, index) => {
    const city = day.stayCity.trim();
    if (!city || city === "in_transit" || firstIndex.has(city)) return;
    firstIndex.set(city, index);
    cities.push(city);
  });
  if (cities.length > 1 && firstIndex.get(cities[cities.length - 1]) === doc.days.length - 1) {
    cities.pop();
  }
  if (cities.length <= 2) return cities.join(" · ");
  return `${cities[0]} → ${cities[cities.length - 1]}`;
}

function toMeta(entry: { id: string; savedAt: string; doc: TripDoc }): SavedTripMeta {
  return {
    id: entry.id,
    title: entry.doc.trip.title,
    startDate: entry.doc.trip.startDate,
    endDate: entry.doc.trip.endDate,
    savedAt: entry.savedAt,
    dayCount: entry.doc.days.length,
    places: citiesOf(entry.doc),
  };
}

function toSaved(entry: { id: string; savedAt: string; doc: TripDoc }): SavedTrip {
  return { ...toMeta(entry), doc: entry.doc };
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
        return toSaved({
          id: entry.id || tripId(parsed.doc),
          savedAt: entry.savedAt || new Date().toISOString(),
          doc: parsed.doc,
        });
      })
      .filter((item): item is SavedTrip => item != null);
  } catch {
    return [];
  }
}

function writeLibrary(list: SavedTrip[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

function setLibraryId(id: string | null): void {
  if (id) localStorage.setItem(LIBRARY_ID_KEY, id);
  else localStorage.removeItem(LIBRARY_ID_KEY);
}

function syncLinkedLibrary(doc: TripDoc): void {
  const linkedId = localStorage.getItem(LIBRARY_ID_KEY);
  if (!linkedId) return;
  const list = readLibrary();
  const index = list.findIndex((item) => item.id === linkedId);
  if (index < 0) {
    setLibraryId(null);
    return;
  }
  const nextId = tripId(doc);
  list[index] = toSaved({
    id: nextId,
    savedAt: new Date().toISOString(),
    doc,
  });
  writeLibrary(list);
  setLibraryId(nextId);
}

export function unlinkLibrary(): void {
  setLibraryId(null);
}

export function listSavedTrips(): SavedTripMeta[] {
  return readLibrary().map(({ doc: _doc, ...meta }) => meta);
}

export function loadSavedTrip(id: string, link = true): TripDoc | null {
  const found = readLibrary().find((item) => item.id === id);
  if (!found) return null;
  if (link) setLibraryId(id);
  return found.doc;
}

/** Archive current itinerary into the on-device library (no backend yet). */
export function archiveTrip(doc: TripDoc): SavedTripMeta {
  const nextId = tripId(doc);
  const list = readLibrary().filter((item) => item.id !== nextId && item.id !== localStorage.getItem(LIBRARY_ID_KEY));
  const entry = toSaved({
    id: nextId,
    savedAt: new Date().toISOString(),
    doc,
  });
  writeLibrary([entry, ...list].slice(0, 20));
  setLibraryId(nextId);
  saveTrip(doc);
  return entry;
}

export function deleteSavedTrip(id: string): void {
  writeLibrary(readLibrary().filter((item) => item.id !== id));
  if (localStorage.getItem(LIBRARY_ID_KEY) === id) setLibraryId(null);
}
