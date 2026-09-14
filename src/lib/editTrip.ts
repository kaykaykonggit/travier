import type { BackupPlace, Money, TimelineItem, Transport, TripDoc } from "../types";

function emptyMoney(currency: string): Money {
  return { amount: null, currency, estimated: true, source: null, asOf: null };
}

export function walkTransport(from: string, to: string, currency: string): Transport {
  return {
    mode: "walk",
    fromPlaceQuery: from,
    toPlaceQuery: to,
    fromStop: null,
    toStop: null,
    line: null,
    operator: null,
    durationMin: null,
    cost: emptyMoney(currency),
    booking: null,
  };
}

function patchDay(doc: TripDoc, dayIndex: number, timeline: TimelineItem[]): TripDoc {
  return {
    ...doc,
    days: doc.days.map((day, index) => (index === dayIndex ? { ...day, timeline } : day)),
  };
}

export function setItemLocked(doc: TripDoc, dayIndex: number, itemIndex: number, locked: boolean): TripDoc {
  const day = doc.days[dayIndex];
  if (!day) return doc;
  return patchDay(
    doc,
    dayIndex,
    day.timeline.map((item, index) => (index === itemIndex ? { ...item, locked } : item)),
  );
}

export function applyBackup(
  doc: TripDoc,
  dayIndex: number,
  itemIndex: number,
  backup: BackupPlace,
  currency: string,
): TripDoc {
  const day = doc.days[dayIndex];
  const current = day?.timeline[itemIndex];
  if (!current) return doc;
  const prev = previousPlace(doc, dayIndex, itemIndex) || current.transport.fromPlaceQuery;
  const next = day.timeline[itemIndex + 1];
  const replaced: TimelineItem = {
    ...current,
    title: backup.title || current.title,
    displayNameZh: backup.displayNameZh || backup.title,
    placeQuery: backup.placeQuery,
    type: backup.type || current.type,
    notes: backup.notes || backup.why,
    ticket: backup.ticket,
    imageUrl: backup.imageUrl,
    transport: walkTransport(prev, backup.placeQuery, currency),
    mustSee: false,
  };
  const timeline = day.timeline.map((item, index) => {
    if (index === itemIndex) return replaced;
    if (index === itemIndex + 1 && next) {
      return { ...next, transport: { ...next.transport, fromPlaceQuery: backup.placeQuery || next.transport.fromPlaceQuery } };
    }
    return item;
  });
  return patchDay(doc, dayIndex, timeline);
}

export function deleteTimelineItem(doc: TripDoc, dayIndex: number, itemIndex: number): TripDoc {
  const day = doc.days[dayIndex];
  if (!day || day.timeline.length <= 1) return doc;
  const prev = previousPlace(doc, dayIndex, itemIndex);
  const next = day.timeline[itemIndex + 1];
  const timeline = day.timeline.filter((_, index) => index !== itemIndex).map((item, index) => {
    if (index === itemIndex && next && prev) {
      return { ...item, transport: { ...item.transport, fromPlaceQuery: prev } };
    }
    return item;
  });
  return patchDay(doc, dayIndex, timeline);
}

export function insertPlaceAfter(
  doc: TripDoc,
  dayIndex: number,
  itemIndex: number,
  place: { name: string; placeQuery: string; source?: string | null; imageUrl?: string | null },
  currency: string,
): TripDoc {
  const day = doc.days[dayIndex];
  const current = day?.timeline[itemIndex];
  if (!current) return doc;
  const from = current.placeQuery || current.transport.toPlaceQuery;
  const next = day.timeline[itemIndex + 1];
  const added: TimelineItem = {
    start: next?.start || current.end || current.start,
    end: null,
    endNextDay: false,
    type: "attraction",
    title: place.name,
    placeQuery: place.placeQuery,
    displayNameZh: place.name,
    lat: null,
    lng: null,
    mustSee: false,
    notes: "從 Google 地圖加入，交通與票價未搜。",
    locked: false,
    imageUrl: place.imageUrl ?? null,
    transport: walkTransport(from, place.placeQuery, currency),
    ticket: { name: null, cost: emptyMoney(currency) },
    backups: [],
  };
  if (place.source) added.ticket.cost.source = place.source;
  const timeline = [
    ...day.timeline.slice(0, itemIndex + 1),
    added,
    ...day.timeline.slice(itemIndex + 1).map((item, offset) =>
      offset === 0 ? { ...item, transport: { ...item.transport, fromPlaceQuery: place.placeQuery } } : item,
    ),
  ];
  return patchDay(doc, dayIndex, timeline);
}

export function repairTimelinePlace(
  doc: TripDoc,
  dayIndex: number,
  itemIndex: number,
  place: { name: string; placeQuery: string; source?: string | null; imageUrl?: string | null },
): TripDoc {
  const day = doc.days[dayIndex];
  const current = day?.timeline[itemIndex];
  if (!current) return doc;
  const timeline = day.timeline.map((item, index) => {
    if (index !== itemIndex) {
      if (index === itemIndex + 1) {
        return { ...item, transport: { ...item.transport, fromPlaceQuery: place.placeQuery } };
      }
      return item;
    }
    return {
      ...item,
      title: place.name,
      displayNameZh: place.name,
      placeQuery: place.placeQuery,
      imageUrl: place.imageUrl ?? item.imageUrl,
      transport: { ...item.transport, toPlaceQuery: place.placeQuery },
      notes: item.notes.includes("未搜") ? item.notes : item.notes,
    };
  });
  return patchDay(doc, dayIndex, timeline);
}

function previousPlace(doc: TripDoc, dayIndex: number, itemIndex: number): string {
  const day = doc.days[dayIndex];
  if (itemIndex > 0) return day.timeline[itemIndex - 1]?.placeQuery || "";
  const prevDay = doc.days[dayIndex - 1];
  return prevDay?.timeline[prevDay.timeline.length - 1]?.placeQuery || "";
}

export function itemLabel(item: TimelineItem): string {
  return item.displayNameZh || item.title;
}
