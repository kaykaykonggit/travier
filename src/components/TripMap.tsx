import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "../lib/geocode";
import { googleSearchUrl } from "../lib/links";
import { dayColor } from "../lib/stops";

const SIGHT_TYPES = new Set(["attraction", "activity", "free"]);

export type TripMapStop = {
  query: string;
  name: string;
  number: number;
  dayIndex: number;
  itemIndex: number;
  dayLabel: string;
  type: string;
};

function numberedIcon(n: number, color: string, focused: boolean) {
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin ${focused ? "pin-focus" : ""}" style="background:${color}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize();
    const id = window.setTimeout(invalidate, 80);
    const observer = new ResizeObserver(invalidate);
    observer.observe(container.parentElement ?? container);
    window.addEventListener("resize", invalidate);
    return () => {
      window.clearTimeout(id);
      observer.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

function FitAll({ points, locked }: { points: LatLng[]; locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (locked || !points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 12);
      return;
    }
    map.fitBounds(
      L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
      { padding: [36, 36], maxZoom: 13 },
    );
  }, [map, points, locked]);
  return null;
}

function FlyTo({ point, token }: { point: LatLng | null; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!point || !token) return;
    map.flyTo([point.lat, point.lng], 14, { duration: 0.65 });
  }, [map, point, token]);
  return null;
}

function firstStopOfDay(items: Array<TripMapStop & { point: LatLng }>) {
  return items.find((item) => SIGHT_TYPES.has(item.type)) ?? items[0] ?? null;
}

export function TripMap({
  stops,
  points,
  loading,
  focusNumber,
  activeDay,
  onSelect,
  dayCount,
  showLegend = true,
}: {
  stops: TripMapStop[];
  points: Map<string, LatLng>;
  loading: boolean;
  focusNumber: number | null;
  activeDay: number;
  onSelect: (dayIndex: number, itemIndex: number) => void;
  dayCount: number;
  showLegend?: boolean;
}) {
  const [locked, setLocked] = useState(false);
  const [fly, setFly] = useState<{ point: LatLng; token: number } | null>(null);

  const resolved = useMemo(() => {
    const seen = new Map<string, number>();
    return stops
      .map((stop) => {
        const point = points.get(stop.query);
        if (!point) return null;
        const nth = seen.get(`${stop.query}-${stop.dayIndex}`) ?? 0;
        seen.set(`${stop.query}-${stop.dayIndex}`, nth + 1);
        const jitter = nth * 0.00022;
        return { ...stop, point: { ...point, lat: point.lat + jitter * 0.5, lng: point.lng + jitter }, color: dayColor(stop.dayIndex) };
      })
      .filter((item): item is TripMapStop & { point: LatLng; color: string } => item != null);
  }, [stops, points]);

  const byDay = useMemo(() => {
    const groups = new Map<number, typeof resolved>();
    for (const item of resolved) {
      const list = groups.get(item.dayIndex) ?? [];
      list.push(item);
      groups.set(item.dayIndex, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [resolved]);

  const allPoints = useMemo(() => resolved.map((item) => item.point), [resolved]);
  const center = resolved[0]?.point ?? { lat: 48.2082, lng: 16.3738 };

  function goToDay(index: number) {
    const first = firstStopOfDay(resolved.filter((item) => item.dayIndex === index));
    if (first) {
      setLocked(true);
      setFly({ point: first.point, token: Date.now() });
      onSelect(first.dayIndex, first.itemIndex);
      return;
    }
    onSelect(index, 0);
  }

  if (!stops.length) return <div className="map-empty">這個行程還沒有可顯示的地點。</div>;

  return (
    <div className="map-shell">
      {loading && <div className="map-status">正在將全程地點放上地圖…</div>}
      {showLegend && (
        <ol className="map-legend">
          {Array.from({ length: dayCount }, (_, index) => (
            <li key={index}>
              <button type="button" className={index === activeDay ? "on" : ""} onClick={() => goToDay(index)}>
                <i style={{ background: dayColor(index) }} />
                第 {index + 1} 天
              </button>
            </li>
          ))}
        </ol>
      )}
      <MapContainer center={[center.lat, center.lng]} zoom={6} scrollWheelZoom={false} className="trip-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeMap />
        <FitAll points={allPoints} locked={locked} />
        <FlyTo point={fly?.point ?? null} token={fly?.token ?? 0} />
        {byDay.map(([dayIndex, items]) =>
          items.length > 1 ? (
            <Polyline
              key={`line-${dayIndex}`}
              positions={items.map((item) => [item.point.lat, item.point.lng] as [number, number])}
              pathOptions={{ color: dayColor(dayIndex), weight: 3, opacity: 0.65 }}
            />
          ) : null,
        )}
        {resolved.map((item) => (
          <Marker
            key={`${item.dayIndex}-${item.number}`}
            position={[item.point.lat, item.point.lng]}
            icon={numberedIcon(item.number, item.color, item.number === focusNumber)}
            eventHandlers={{ click: () => onSelect(item.dayIndex, item.itemIndex) }}
          >
            <Popup>
              <strong>
                第 {item.number} 點 · {item.name}
              </strong>
              <br />
              {item.dayLabel}
              <br />
              <a href={googleSearchUrl(item.query)} target="_blank" rel="noreferrer">
                在 Google Maps 開啟
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
