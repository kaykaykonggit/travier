/** Trip.com city IDs used by /hotels/list. Without these, dates and guests are ignored. */
const TRIP_CITY_IDS: Record<string, number> = {
  amsterdam: 30,
  barcelona: 157,
  berlin: 53,
  budapest: 73,
  florence: 318,
  firenze: 318,
  hallstatt: 21956,
  "hong kong": 58,
  hongkong: 58,
  innsbruck: 741,
  lisbon: 206,
  london: 338,
  madrid: 154,
  milan: 361,
  milano: 361,
  munich: 86,
  "new york": 633,
  osaka: 229,
  paris: 192,
  prague: 147,
  roma: 343,
  rome: 343,
  salzburg: 739,
  seoul: 274,
  taipei: 360,
  tokyo: 228,
  venice: 330,
  venezia: 330,
  vienna: 651,
  wien: 651,
};

export function tripCityId(city: string): number | null {
  const key = city.trim().toLowerCase();
  return TRIP_CITY_IDS[key] ?? null;
}
