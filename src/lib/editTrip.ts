import type { BackupPlace, Money, TimelineItem, Transport, TripDoc } from "../types";
import { doneKey } from "./progress";
import { applyDwell, cascadeTimelineTimes, rewireTransportLinks } from "./timelineTime";

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

export function replaceDayTimeline(doc: TripDoc, dayIndex: number, timeline: TimelineItem[]): TripDoc {
  return patchDay(doc, dayIndex, timeline);
}

export function setTicketSource(doc: TripDoc, dayIndex: number, itemIndex: number, url: string): TripDoc {
  const day = doc.days[dayIndex];
  if (!day) return doc;
  return patchDay(
    doc,
    dayIndex,
    day.timeline.map((item, index) =>
      index === itemIndex
        ? {
            ...item,
            ticket: {
              ...item.ticket,
              cost: { ...item.ticket.cost, source: url || null },
            },
          }
        : item,
    ),
  );
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
    notes: "從 Google 地圖加入，交通與票價尚未搜尋。",
    locked: false,
    imageUrl: place.imageUrl ?? null,
    transport: walkTransport(from, place.placeQuery, currency),
    ticket: { name: null, cost: emptyMoney(currency) },
    backups: [],
    eats: [],
    chosenEat: null,
    eatSkipped: false,
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
      notes: item.notes,
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

function mapIndexAfterMove(index: number, from: number, to: number): number {
  if (from === to) return index;
  if (index === from) return to;
  if (from < to) {
    if (index > from && index <= to) return index - 1;
    return index;
  }
  if (index >= to && index < from) return index + 1;
  return index;
}

export function reorderTimelineItem(doc: TripDoc, dayIndex: number, fromIndex: number, toIndex: number): TripDoc {
  const day = doc.days[dayIndex];
  if (!day) return doc;
  if (fromIndex === toIndex) return doc;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= day.timeline.length || toIndex >= day.timeline.length) return doc;

  const moving = day.timeline[fromIndex];
  const without = day.timeline.filter((_, index) => index !== fromIndex);
  const reordered = [...without.slice(0, toIndex), moving, ...without.slice(toIndex)];
  const linked = rewireTransportLinks(reordered);
  const cascaded = cascadeTimelineTimes(linked, 0);
  return patchDay(doc, dayIndex, cascaded);
}

export function setTimelineDuration(
  doc: TripDoc,
  dayIndex: number,
  itemIndex: number,
  durationMin: number,
): TripDoc {
  const day = doc.days[dayIndex];
  const current = day?.timeline[itemIndex];
  if (!current) return doc;
  const updated = day.timeline.map((item, index) =>
    index === itemIndex ? { ...item, ...applyDwell(item.start, durationMin) } : item,
  );
  const cascaded = cascadeTimelineTimes(updated, itemIndex);
  return patchDay(doc, dayIndex, cascaded);
}

export function remapDoneKeysForMove(
  done: Set<string>,
  date: string,
  fromIndex: number,
  toIndex: number,
  nextTimeline: TimelineItem[],
  prevTimeline: TimelineItem[],
): Set<string> {
  const next = new Set<string>();
  for (const key of done) {
    if (!key.startsWith(`${date}#`)) {
      next.add(key);
      continue;
    }
    const parts = key.split("#");
    const oldIndex = Number(parts[1]);
    if (!Number.isFinite(oldIndex)) {
      next.add(key);
      continue;
    }
    const newIndex = mapIndexAfterMove(oldIndex, fromIndex, toIndex);
    const start = nextTimeline[newIndex]?.start ?? prevTimeline[oldIndex]?.start ?? parts[2] ?? "";
    next.add(doneKey(date, newIndex, start));
  }
  return next;
}

export function remapDoneKeysForDuration(
  done: Set<string>,
  date: string,
  itemIndex: number,
  nextTimeline: TimelineItem[],
  prevTimeline: TimelineItem[],
): Set<string> {
  const next = new Set<string>();
  for (const key of done) {
    if (!key.startsWith(`${date}#`)) {
      next.add(key);
      continue;
    }
    const parts = key.split("#");
    const index = Number(parts[1]);
    if (!Number.isFinite(index)) {
      next.add(key);
      continue;
    }
    if (index < itemIndex) {
      next.add(key);
      continue;
    }
    const start = nextTimeline[index]?.start ?? prevTimeline[index]?.start ?? parts[2] ?? "";
    next.add(doneKey(date, index, start));
  }
  return next;
}

export function chooseStopEat(doc: TripDoc, dayIndex: number, itemIndex: number, eatName: string): TripDoc {
  const day = doc.days[dayIndex];
  const item = day?.timeline[itemIndex];
  if (!item) return doc;
  const timeline = day.timeline.map((row, index) =>
    index === itemIndex ? { ...row, chosenEat: eatName, eatSkipped: false } : row,
  );
  return patchDay(doc, dayIndex, timeline);
}

export function skipStopEatsChoice(doc: TripDoc, dayIndex: number, itemIndex: number): TripDoc {
  const day = doc.days[dayIndex];
  if (!day?.timeline[itemIndex]) return doc;
  const timeline = day.timeline.map((row, index) =>
    index === itemIndex ? { ...row, chosenEat: null, eatSkipped: true } : row,
  );
  return patchDay(doc, dayIndex, timeline);
}

export function clearStopEatChoice(doc: TripDoc, dayIndex: number, itemIndex: number): TripDoc {
  const day = doc.days[dayIndex];
  if (!day?.timeline[itemIndex]) return doc;
  const timeline = day.timeline.map((row, index) =>
    index === itemIndex ? { ...row, chosenEat: null, eatSkipped: false } : row,
  );
  return patchDay(doc, dayIndex, timeline);
}
