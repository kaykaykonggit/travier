import type { LatLng } from "./geocode";

/** Spread markers that share almost the same coordinate so numbers stay readable on mobile. */
export function spreadMarkers<T extends { point: LatLng; number: number }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = `${item.point.lat.toFixed(4)},${item.point.lng.toFixed(4)}`;
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  const out: T[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    group.forEach((item, index) => {
      const angle = (Math.PI * 2 * index) / group.length;
      const radius = 0.00028 * Math.ceil((index + 1) / 2);
      out.push({
        ...item,
        point: {
          ...item.point,
          lat: item.point.lat + Math.sin(angle) * radius,
          lng: item.point.lng + Math.cos(angle) * radius,
        },
      });
    });
  }
  return out.sort((a, b) => a.number - b.number);
}
