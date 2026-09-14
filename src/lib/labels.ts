export const TYPE_LABEL: Record<string, string> = {
  flight: "飛機",
  transit: "交通",
  attraction: "景點",
  meal: "用餐",
  hotel: "住宿",
  activity: "活動",
  free: "自由",
  rest: "休息",
  night_train: "夜火車",
};

export const MODE_LABEL: Record<string, string> = {
  walk: "步行",
  metro: "地鐵",
  train: "火車",
  bus: "巴士",
  tram: "電車",
  taxi: "計程車",
  flight: "飛機",
  cable_car: "纜車",
  private_car: "專車",
  ferry: "渡輪",
  night_train: "夜火車",
};

export const NIGHT_LABEL: Record<string, string> = {
  hotel: "酒店",
  night_train: "夜火車",
  flight: "飛行中",
  none: "無住宿",
};

export const PACE_LABEL: Record<string, string> = {
  relaxed: "休閒",
  normal: "一般",
  packed: "緊湊",
};

export function labelOf(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}

export function weekdayZh(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const days = ["日", "一", "二", "三", "四", "五", "六"];
  return days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function formatDateZh(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

/** Calendar day of month, e.g. 19 from 2026-12-19. */
export function dateDayNumber(isoDate: string): number {
  const day = Number(isoDate.split("-")[2]);
  return Number.isFinite(day) && day > 0 ? day : 0;
}

export function tripDayNumber(isoDate: string, startDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(sy, sm - 1, sd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 86_400_000) + 1;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function starsText(n: number | null): string {
  if (!n) return "";
  return "★".repeat(Math.max(0, Math.min(5, n)));
}
