import type { ExpenseItem, LifeCategory, Money, TripDoc } from "../types";
import { cleanSourceUrl } from "./sanitize";

export type { ExpenseItem, LifeCategory } from "../types";

export const LIFE_CATEGORIES: { id: LifeCategory; label: string; hint: string; addLabel: string }[] = [
  { id: "yi", label: "衣", hint: "購物／裝備", addLabel: "新增一筆衣物" },
  { id: "shi", label: "食", hint: "餐飲", addLabel: "新增一筆餐飲" },
  { id: "zhu", label: "住", hint: "酒店／民宿", addLabel: "新增一筆住宿" },
  { id: "xing", label: "行", hint: "機票／交通", addLabel: "新增一筆交通" },
  { id: "wan", label: "玩", hint: "門票／體驗", addLabel: "新增一筆遊玩" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function money(amount: number | null, currency: string, previous?: Money | null, source?: string | null): Money {
  return {
    amount,
    currency,
    estimated: false,
    source: source !== undefined ? source : previous?.source ?? null,
    asOf: todayIso(),
  };
}

export function normalizeExpenseUrl(raw: string): string {
  const cleaned = cleanSourceUrl(raw) ?? raw.trim();
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (/^[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(cleaned)) return `https://${cleaned}`;
  return cleaned;
}

export function expenseLinkHref(url: string): string {
  return normalizeExpenseUrl(url) || url.trim();
}

export function expenseLinkLabel(url: string): string {
  const href = expenseLinkHref(url).toLowerCase();
  if (!href) return "開啟連結";
  if (href.includes("klook.")) return "Klook";
  if (href.includes("trip.com") || href.includes("ctrip.")) return "Trip.com";
  if (href.includes("booking.com")) return "Booking.com";
  if (href.includes("airbnb.")) return "Airbnb";
  if (href.includes("agoda.")) return "Agoda";
  if (href.includes("google.") && href.includes("map")) return "地圖";
  try {
    return new URL(expenseLinkHref(url)).hostname.replace(/^www\./, "");
  } catch {
    return "開啟連結";
  }
}

export function expenseUrlPlaceholder(category: LifeCategory): string {
  if (category === "wan") return "貼上 Klook／門票／其他連結";
  if (category === "zhu") return "貼上訂房連結（Klook／Trip.com／其他）";
  if (category === "xing") return "貼上機票／車票連結";
  if (category === "shi") return "貼上訂位／店舖連結";
  return "貼上商品／店舖連結";
}

function inheritedUrl(prevUrl: string | undefined, source: string | null | undefined): string {
  if (prevUrl?.trim()) return prevUrl;
  if (source && /^https?:\/\//i.test(source)) return source;
  return "";
}

function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isFlightStop(item: { type: string; transport: { mode: string } }): boolean {
  return item.type === "flight" || item.transport.mode === "flight";
}

/** Keep linked hotel/flight rows in sync without wiping manual / meal expenses. */
export function ensureLifeExpenses(doc: TripDoc): TripDoc {
  const existing = doc.expenses ?? [];
  const preserved = existing
    .filter((item) => item.link?.kind !== "hotel" && item.link?.kind !== "flight")
    .map((item) => ({ ...item, url: item.url ?? "" }));
  const next: ExpenseItem[] = [...preserved];

  for (const night of doc.nights) {
    if (night.type !== "hotel") continue;
    const prev = existing.find((item) => item.link?.kind === "hotel" && item.link.nightDate === night.date);
    const picked = night.candidates.find((hotel) => hotel.name === night.chosenName) ?? night.candidates[0] ?? null;
    const amount =
      prev?.amount != null && prev.amount > 0
        ? prev.amount
        : picked?.cost.amount != null && picked.cost.amount > 0
          ? picked.cost.amount
          : null;
    next.push({
      id: prev?.id ?? `hotel-${night.date}`,
      category: "zhu",
      title: picked?.name || prev?.title || "酒店",
      place: night.area || night.city || prev?.place || "",
      date: night.date,
      time: prev?.time ?? null,
      amount,
      currency: prev?.currency || picked?.cost.currency || doc.trip.currencies.local,
      notes: prev?.notes ?? "一房一晚",
      url: inheritedUrl(prev?.url, picked?.cost.source),
      link: { kind: "hotel", nightDate: night.date },
    });
  }

  doc.days.forEach((day, dayIndex) => {
    day.timeline.forEach((item, itemIndex) => {
      if (!isFlightStop(item)) return;
      const prev = existing.find(
        (row) => row.link?.kind === "flight" && row.link.dayIndex === dayIndex && row.link.itemIndex === itemIndex,
      );
      const amount =
        prev?.amount != null && prev.amount > 0
          ? prev.amount
          : item.ticket.cost.amount != null && item.ticket.cost.amount > 0
            ? item.ticket.cost.amount
            : null;
      next.push({
        id: prev?.id ?? `flight-${day.date}-${itemIndex}`,
        category: "xing",
        title: item.displayNameZh || item.title || "機票",
        place: item.placeQuery || prev?.place || "",
        date: day.date,
        time: prev?.time ?? item.start ?? null,
        amount,
        currency: prev?.currency || item.ticket.cost.currency || doc.trip.currencies.display,
        notes: prev?.notes ?? "全團機票",
        url: inheritedUrl(prev?.url, item.ticket.cost.source),
        link: { kind: "flight", dayIndex, itemIndex },
      });
    });
  });

  return { ...doc, expenses: next };
}

export function addExpense(doc: TripDoc, category: LifeCategory): TripDoc {
  const base = ensureLifeExpenses(doc);
  const currency = category === "zhu" ? doc.trip.currencies.local : doc.trip.currencies.display;
  const item: ExpenseItem = {
    id: newId(category),
    category,
    title: "",
    place: "",
    date: doc.trip.startDate,
    time: null,
    amount: null,
    currency,
    notes: "",
    url: "",
    link: null,
  };
  return { ...base, expenses: [item, ...(base.expenses ?? [])] };
}

export function updateExpense(doc: TripDoc, id: string, patch: Partial<Omit<ExpenseItem, "id" | "link">>): TripDoc {
  const base = ensureLifeExpenses(doc);
  const expenses = (base.expenses ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item));
  let next: TripDoc = { ...base, expenses };
  const updated = expenses.find((item) => item.id === id);
  if (!updated?.link) return next;

  if (updated.link.kind === "hotel") {
    const nightDate = updated.link.nightDate;
    next = {
      ...next,
      nights: next.nights.map((night) => {
        if (night.date !== nightDate || night.type !== "hotel") return night;
        const targetName = updated.title.trim() || night.chosenName || night.candidates[0]?.name || "已訂酒店";
        const currency = updated.currency || doc.trip.currencies.local;
        const previous = night.candidates.find((hotel) => hotel.name === targetName)?.cost;
        const nextCost = money(updated.amount, currency, previous, normalizeExpenseUrl(updated.url) || null);
        const exists = night.candidates.some((hotel) => hotel.name === targetName);
        const candidates = exists
          ? night.candidates.map((hotel) => (hotel.name === targetName ? { ...hotel, cost: nextCost } : hotel))
          : [{ name: targetName, placeQuery: `${targetName}, ${night.city}`, stars: null, cost: nextCost }, ...night.candidates];
        return { ...night, chosenName: targetName, candidates };
      }),
    };
  }

  if (updated.link.kind === "flight") {
    const { dayIndex, itemIndex } = updated.link;
    next = {
      ...next,
      days: next.days.map((day, di) => {
        if (di !== dayIndex) return day;
        return {
          ...day,
          timeline: day.timeline.map((item, ii) => {
            if (ii !== itemIndex || !isFlightStop(item)) return item;
            return {
              ...item,
              ticket: {
                name: item.ticket.name || "機票（全團）",
                cost: money(
                  updated.amount,
                  updated.currency || item.ticket.cost.currency || doc.trip.currencies.display,
                  item.ticket.cost,
                  normalizeExpenseUrl(updated.url) || null,
                ),
              },
            };
          }),
        };
      }),
    };
  }

  return next;
}

export function deleteExpense(doc: TripDoc, id: string): TripDoc {
  const base = ensureLifeExpenses(doc);
  const target = (base.expenses ?? []).find((item) => item.id === id);
  if (target?.link?.kind === "meal") {
    return { ...base, expenses: (base.expenses ?? []).filter((item) => item.id !== id) };
  }
  if (target?.link) return updateExpense(base, id, { amount: null });
  return { ...base, expenses: (base.expenses ?? []).filter((item) => item.id !== id) };
}

export function findMealExpense(
  doc: TripDoc,
  date: string,
  slot: string,
  placeId: string,
): ExpenseItem | undefined {
  return (doc.expenses ?? []).find(
    (item) =>
      item.link?.kind === "meal" &&
      item.link.date === date &&
      item.link.slot === slot &&
      item.link.placeId === placeId,
  );
}

/** Add or refresh a 食 row linked to a restaurant from 訂餐 / 附近美食. */
export function upsertMealExpense(
  doc: TripDoc,
  input: {
    date: string;
    slot: string;
    slotLabel: string;
    placeId: string;
    placeName: string;
    place: string;
    url?: string | null;
    time?: string | null;
  },
): TripDoc {
  const base = ensureLifeExpenses(doc);
  const prev = findMealExpense(base, input.date, input.slot, input.placeId);
  const url = normalizeExpenseUrl(input.url ?? "") || prev?.url || "";
  const item: ExpenseItem = {
    id: prev?.id ?? `meal-${input.date}-${input.slot}-${input.placeId}`.slice(0, 48),
    category: "shi",
    title: input.placeName || prev?.title || "餐飲",
    place: input.place || prev?.place || "",
    date: input.date,
    time: prev?.time ?? input.time ?? null,
    amount: prev?.amount ?? null,
    currency: prev?.currency || doc.trip.currencies.display,
    notes: prev?.notes || input.slotLabel,
    url,
    link: { kind: "meal", date: input.date, slot: input.slot, placeId: input.placeId },
  };
  const expenses = prev
    ? (base.expenses ?? []).map((row) => (row.id === prev.id ? item : row))
    : [item, ...(base.expenses ?? [])];
  return { ...base, expenses };
}

export function removeMealExpense(doc: TripDoc, date: string, slot: string, placeId: string): TripDoc {
  const base = ensureLifeExpenses(doc);
  const target = findMealExpense(base, date, slot, placeId);
  if (!target) return base;
  return deleteExpense(base, target.id);
}

export function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

export function manualExpenseTotal(
  doc: TripDoc,
  display: string,
  rates: Record<string, number>,
): { total: number; known: number; unknown: number } {
  let total = 0;
  let known = 0;
  let unknown = 0;
  for (const item of doc.expenses ?? []) {
    if (item.link) continue;
    if (item.amount == null || item.amount <= 0) {
      unknown += 1;
      continue;
    }
    if (item.currency === display) total += item.amount;
    else if (rates[item.currency]) total += item.amount * rates[item.currency];
    else {
      unknown += 1;
      continue;
    }
    known += 1;
  }
  return { total, known, unknown };
}
