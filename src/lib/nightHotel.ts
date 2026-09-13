import type { HotelCandidate, Night, TripDoc } from "../types";

function money(amount: number, currency: string, source: string | null = null) {
  return {
    amount,
    currency,
    estimated: false,
    source,
    asOf: new Date().toISOString().slice(0, 10),
  };
}

/** Merge a user-confirmed hotel (Maps name + paid price) into nights and the day's hotel stop. */
export function applyNightHotel(
  doc: TripDoc,
  nightDate: string,
  hotel: { name: string; placeQuery: string; amount: number; source?: string | null },
): TripDoc {
  const currency = doc.trip.currencies.local;
  const candidate: HotelCandidate = {
    name: hotel.name,
    placeQuery: hotel.placeQuery,
    stars: null,
    cost: money(hotel.amount, currency, hotel.source ?? null),
  };

  const nights = doc.nights.map((night) => {
    if (night.date !== nightDate) return night;
    const exists = night.candidates.some((item) => item.name === hotel.name);
    return {
      ...night,
      type: "hotel",
      chosenName: hotel.name,
      nearPlaceQuery: hotel.placeQuery,
      candidates: exists
        ? night.candidates.map((item) => (item.name === hotel.name ? { ...item, ...candidate } : item))
        : [candidate, ...night.candidates],
    };
  });

  const days = doc.days.map((day) => {
    if (day.date !== nightDate) return day;
    let replaced = false;
    const timeline = day.timeline.map((item) => {
      if (item.type !== "hotel" || replaced) return item;
      replaced = true;
      return {
        ...item,
        title: hotel.name,
        displayNameZh: hotel.name,
        placeQuery: hotel.placeQuery,
        ticket: {
          name: item.ticket.name || "住宿費用",
          cost: money(hotel.amount, currency, hotel.source ?? null),
        },
      };
    });
    return { ...day, timeline };
  });

  return { ...doc, nights, days };
}

export function hotelNights(doc: TripDoc): Night[] {
  return doc.nights.filter((night) => night.type === "hotel" || night.type === "none" || !night.type);
}
