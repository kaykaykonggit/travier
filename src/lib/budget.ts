import type { HotelCandidate, Money, TimelineItem, TripDoc } from "../types";
import { chosenHotel } from "./costs";

export type FlightBudgetRow = {
  key: string;
  dayIndex: number;
  itemIndex: number;
  date: string;
  label: string;
  cost: Money;
};

export type HotelBudgetRow = {
  key: string;
  nightIndex: number;
  date: string;
  label: string;
  city: string;
  cost: Money;
  chosen: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function moneyOf(amount: number | null, currency: string, previous?: Money | null): Money {
  return {
    amount,
    currency,
    estimated: false,
    source: previous?.source ?? null,
    asOf: todayIso(),
  };
}

export function isFlightItem(item: TimelineItem): boolean {
  return item.type === "flight" || item.transport.mode === "flight";
}

/** Whole-party flight fare lives on ticket.cost (template rule: multiply by heads first). */
export function listFlightBudgets(doc: TripDoc): FlightBudgetRow[] {
  const rows: FlightBudgetRow[] = [];
  doc.days.forEach((day, dayIndex) => {
    day.timeline.forEach((item, itemIndex) => {
      if (!isFlightItem(item)) return;
      rows.push({
        key: `${day.date}|${itemIndex}|${item.start}`,
        dayIndex,
        itemIndex,
        date: day.date,
        label: item.displayNameZh || item.title || "機票",
        cost: item.ticket.cost,
      });
    });
  });
  return rows;
}

export function listHotelBudgets(doc: TripDoc): HotelBudgetRow[] {
  return doc.nights
    .map((night, nightIndex) => {
      if (night.type !== "hotel") return null;
      const picked = chosenHotel(night);
      const fallback = night.candidates[0];
      const hotel = picked ?? fallback;
      return {
        key: night.date,
        nightIndex,
        date: night.date,
        label: hotel?.name || night.area || night.city || "未選酒店",
        city: night.city,
        cost: hotel?.cost ?? { amount: null, currency: doc.trip.currencies.local, estimated: true, source: null, asOf: null },
        chosen: Boolean(picked),
      } satisfies HotelBudgetRow;
    })
    .filter((row): row is HotelBudgetRow => row != null);
}

export function setFlightTicketCost(doc: TripDoc, dayIndex: number, itemIndex: number, amount: number | null, currency: string): TripDoc {
  return {
    ...doc,
    days: doc.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return {
        ...day,
        timeline: day.timeline.map((item, ii) => {
          if (ii !== itemIndex || !isFlightItem(item)) return item;
          return {
            ...item,
            ticket: {
              name: item.ticket.name || "機票（全團）",
              cost: moneyOf(amount, currency || item.ticket.cost.currency || doc.trip.currencies.display, item.ticket.cost),
            },
          };
        }),
      };
    }),
  };
}

export function setHotelNightCost(doc: TripDoc, nightIndex: number, amount: number | null, currency: string, nameHint?: string): TripDoc {
  return {
    ...doc,
    nights: doc.nights.map((night, index) => {
      if (index !== nightIndex || night.type !== "hotel") return night;
      const picked = chosenHotel(night);
      const targetName = picked?.name || nameHint || night.candidates[0]?.name || "已訂酒店";
      const currencyCode = currency || picked?.cost.currency || doc.trip.currencies.local;
      const nextCost = moneyOf(amount, currencyCode, picked?.cost ?? night.candidates[0]?.cost);
      const exists = night.candidates.some((item) => item.name === targetName);
      const candidates: HotelCandidate[] = exists
        ? night.candidates.map((item) => (item.name === targetName ? { ...item, cost: nextCost } : item))
        : [
            {
              name: targetName,
              placeQuery: `${targetName}, ${night.city}`,
              stars: null,
              cost: nextCost,
            },
            ...night.candidates,
          ];
      return {
        ...night,
        chosenName: targetName,
        candidates,
      };
    }),
  };
}

export function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
