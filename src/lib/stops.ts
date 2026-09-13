import type { Day } from "../types";

/** 當天行程第幾項：依時間，每項一個編號，回到同一地點也不重複。 */
export function timelineStopNumbers(length: number): number[] {
  return Array.from({ length }, (_, index) => index + 1);
}

/** 全程連續編號：第一天 1…9，第二天從 10 起。 */
export function tripStopNumbers(days: Day[]): number[][] {
  let next = 0;
  return days.map((day) =>
    day.timeline.map(() => {
      next += 1;
      return next;
    }),
  );
}

export const DAY_COLORS = [
  "#e11d48",
  "#f97316",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#0891b2",
  "#65a30d",
  "#dc2626",
  "#c026d3",
  "#0284c7",
  "#d97706",
  "#059669",
  "#4f46e5",
];

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}
