import type { Day, Money, Night, TimelineItem, TripDoc } from "../types";

export type RateTable = Record<string, number>;

export async function fetchRates(display: string, extras: string[]): Promise<RateTable> {
  const unique = [...new Set(extras.filter((c) => c && c !== display))];
  const table: RateTable = { [display]: 1 };
  await Promise.all(
    unique.map(async (from) => {
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${display}`);
        if (!res.ok) return;
        const json = (await res.json()) as { rates?: Record<string, number> };
        const rate = json.rates?.[display];
        if (typeof rate === "number") table[from] = rate;
      } catch {
        /* keep fallback */
      }
    }),
  );
  if (display === "HKD") {
    if (!table.EUR) table.EUR = 8.5;
    if (!table.USD) table.USD = 7.8;
  }
  return table;
}

export function toDisplay(money: Money, display: string, rates: RateTable): number | null {
  if (money.amount == null) return null;
  if (money.currency === display) return money.amount;
  const rate = rates[money.currency];
  if (!rate) return null;
  return money.amount * rate;
}

export function formatMoney(amount: number | null, currency: string): string {
  if (amount == null) return "未提供";
  return `${currency} ${Math.round(amount).toLocaleString("zh-HK")}`;
}

export function priceNote(money: Money): string {
  if (money.amount == null) return "";
  const kind = money.estimated ? "估算" : "搜尋現價";
  return money.asOf ? `${kind} · ${money.asOf}` : kind;
}

export function collectCurrencies(doc: TripDoc): string[] {
  const set = new Set<string>([doc.trip.currencies.local, doc.trip.currencies.display]);
  for (const day of doc.days) {
    for (const item of day.timeline) {
      set.add(item.transport.cost.currency);
      set.add(item.ticket.cost.currency);
    }
  }
  for (const night of doc.nights) {
    for (const hotel of night.candidates) set.add(hotel.cost.currency);
    if (night.transport) set.add(night.transport.cost.currency);
  }
  for (const item of doc.klook) set.add(item.cost.currency);
  return [...set];
}

export type CostSummary = {
  totalDisplay: number | null;
  perPersonDisplay: number | null;
  hotelMinDisplay: number | null;
  hotelMaxDisplay: number | null;
  hotelPerPersonDisplay: number | null;
  knownCount: number;
  unknownCount: number;
};

export type DayCost = {
  activitiesDisplay: number;
  transportDisplay: number;
  mealDisplay: number;
  ticketDisplay: number;
  hotelMinDisplay: number | null;
  hotelMaxDisplay: number | null;
  totalDisplay: number;
  totalLocal: number;
  perPersonDisplay: number;
  mealPerPersonDisplay: number;
  hotelPerPersonDisplay: number | null;
  localCurrency: string;
  unknownCount: number;
};

export function partySize(adults: number, children = 0): number {
  return Math.max(1, adults + children);
}

export function perHead(amount: number | null, heads: number): number | null {
  if (amount == null) return null;
  return amount / Math.max(1, heads);
}

function addMoney(money: Money, display: string, local: string, rates: RateTable, into: { display: number; local: number; unknown: number; known: boolean }) {
  if (money.amount == null) {
    into.unknown += 1;
    return;
  }
  into.display += toDisplay(money, display, rates) ?? 0;
  if (money.currency === local) into.local += money.amount;
  else {
    const asDisplay = toDisplay(money, display, rates);
    const localRate = rates[local];
    if (asDisplay != null && localRate) into.local += asDisplay / localRate;
  }
  into.known = true;
}

function sameMoney(a: Money, b: Money): boolean {
  return a.amount != null && a.amount === b.amount && a.currency === b.currency;
}

export function itemCost(item: TimelineItem, display: string, rates: RateTable): number | null {
  if (sameMoney(item.transport.cost, item.ticket.cost)) {
    return toDisplay(item.transport.cost, display, rates);
  }
  const parts = [toDisplay(item.transport.cost, display, rates), toDisplay(item.ticket.cost, display, rates)];
  if (parts.every((n) => n == null)) return null;
  return (parts[0] ?? 0) + (parts[1] ?? 0);
}

export function chosenHotel(night: Night | undefined) {
  if (!night || night.type !== "hotel") return undefined;
  return night.candidates.find((item) => item.name === night.chosenName) ?? undefined;
}

export function nightHotelRange(night: Night | undefined, display: string, rates: RateTable): { min: number | null; max: number | null } {
  if (!night || night.type !== "hotel") return { min: null, max: null };
  const picked = chosenHotel(night);
  if (picked) {
    const value = toDisplay(picked.cost, display, rates);
    return { min: value, max: value };
  }
  const priced = night.candidates
    .map((c) => toDisplay(c.cost, display, rates))
    .filter((n): n is number => n != null);
  if (!priced.length) return { min: null, max: null };
  return { min: Math.min(...priced), max: Math.max(...priced) };
}

export function summarizeDay(
  day: Day,
  night: Night | undefined,
  local: string,
  display: string,
  rates: RateTable,
  heads = 1,
): DayCost {
  const bucket = { display: 0, local: 0, unknown: 0, known: false };
  const transport = { display: 0, local: 0, unknown: 0, known: false };
  const meals = { display: 0, local: 0, unknown: 0, known: false };
  const tickets = { display: 0, local: 0, unknown: 0, known: false };
  for (const item of day.timeline) {
    addMoney(item.transport.cost, display, local, rates, bucket);
    addMoney(item.transport.cost, display, local, rates, transport);
    if (sameMoney(item.transport.cost, item.ticket.cost)) continue;
    addMoney(item.ticket.cost, display, local, rates, bucket);
    if (item.type === "meal") addMoney(item.ticket.cost, display, local, rates, meals);
    else addMoney(item.ticket.cost, display, local, rates, tickets);
  }
  const hotel = nightHotelRange(night, display, rates);
  const picked = chosenHotel(night);
  const hotelLocal =
    night?.type === "hotel"
      ? (picked
          ? picked.cost.amount != null && picked.cost.currency === local
            ? [picked.cost.amount]
            : []
          : night.candidates
              .map((c) => c.cost)
              .filter((c) => c.amount != null && c.currency === local)
              .map((c) => c.amount as number))
      : [];
  const totalDisplay = bucket.display + (hotel.min ?? 0);
  const size = Math.max(1, heads);
  return {
    activitiesDisplay: bucket.display,
    transportDisplay: transport.display,
    mealDisplay: meals.display,
    ticketDisplay: tickets.display,
    hotelMinDisplay: hotel.min,
    hotelMaxDisplay: hotel.max,
    totalDisplay,
    totalLocal: bucket.local + (hotelLocal.length ? Math.min(...hotelLocal) : 0),
    perPersonDisplay: totalDisplay / size,
    mealPerPersonDisplay: meals.display / size,
    hotelPerPersonDisplay: hotel.min == null ? null : hotel.min / size,
    localCurrency: local,
    unknownCount: bucket.unknown,
  };
}

export function summarizeCosts(doc: TripDoc, rates: RateTable, heads = 1): CostSummary {
  const display = doc.trip.currencies.display;
  let transport = 0;
  let tickets = 0;
  let hotelMin = 0;
  let hotelMax = 0;
  let known = 0;
  let unknown = 0;
  let hasTransport = false;
  let hasTickets = false;
  let hasHotels = false;

  for (const day of doc.days) {
    for (const item of day.timeline) {
      const t = toDisplay(item.transport.cost, display, rates);
      if (item.transport.cost.amount == null) unknown += 1;
      else {
        transport += t ?? 0;
        hasTransport = true;
        known += 1;
      }
      if (sameMoney(item.transport.cost, item.ticket.cost)) {
        /* already counted as transport */
      } else if (item.ticket.cost.amount == null) {
        if (item.ticket.name) unknown += 1;
      } else {
        tickets += toDisplay(item.ticket.cost, display, rates) ?? 0;
        hasTickets = true;
        known += 1;
      }
    }
  }

  for (const item of doc.klook) {
    if (item.cost.amount == null) unknown += 1;
    else known += 1;
  }

  for (const night of doc.nights) {
    if (night.type !== "hotel") continue;
    const picked = chosenHotel(night);
    if (picked) {
      const value = toDisplay(picked.cost, display, rates);
      if (value == null) unknown += 1;
      else {
        hotelMin += value;
        hotelMax += value;
        hasHotels = true;
        known += 1;
      }
      continue;
    }
    const priced = night.candidates
      .map((c) => toDisplay(c.cost, display, rates))
      .filter((n): n is number => n != null);
    if (night.candidates.length === 0) unknown += 1;
    else if (priced.length === 0) unknown += night.candidates.length;
    else {
      hotelMin += Math.min(...priced);
      hotelMax += Math.max(...priced);
      hasHotels = true;
      known += 1;
    }
  }

  const total = (hasTransport ? transport : 0) + (hasTickets ? tickets : 0) + (hasHotels ? hotelMin : 0);
  const size = Math.max(1, heads);
  const totalDisplay = hasTransport || hasTickets || hasHotels ? total : null;
  return {
    totalDisplay,
    perPersonDisplay: totalDisplay == null ? null : totalDisplay / size,
    hotelMinDisplay: hasHotels ? hotelMin : null,
    hotelMaxDisplay: hasHotels ? hotelMax : null,
    hotelPerPersonDisplay: hasHotels ? hotelMin / size : null,
    knownCount: known,
    unknownCount: unknown,
  };
}
