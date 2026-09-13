import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { LatLng } from "../lib/geocode";
import { googleSearchUrl } from "../lib/links";

function numberedIcon(n: number, focused: boolean, color = "#1f1c18") {
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin ${focused ? "pin-focus" : ""}" style="background:${color}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function offsetPoint(point: LatLng, nth: number): LatLng {
  if (nth <= 0) return point;
  const step = 0.00024 * nth;
  return { ...point, lat: point.lat + step * 0.55, lng: point.lng + step };
}

function ResizeMap() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function FitBounds({ points, locked }: { points: LatLng[]; locked: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (locked || !points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [map, points, locked]);
  return null;
}

function FocusOn({ point, token }: { point: LatLng | null; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (!point || !token) return;
    map.flyTo([point.lat, point.lng], 16, { duration: 0.55 });
  }, [map, point, token]);
  return null;
}

export type MapStop = {
  query: string;
  name: string;
  mustSee: boolean;
  number: number;
  index: number;
};

export function DayMap({
  stops,
  points,
  loading,
  focusNumber,
  focusToken,
  onSelect,
  color = "#1f1c18",
}: {
  stops: MapStop[];
  points: Map<string, LatLng>;
  loading: boolean;
  focusNumber: number | null;
  focusToken: number;
  onSelect: (index: number) => void;
  color?: string;
}) {
  const markerRefs = useRef<Map<number, L.Marker>>(new Map());
  const resolved = useMemo(() => {
    const seen = new Map<string, number>();
    return stops
      .map((stop) => {
        const point = points.get(stop.query);
        if (!point) return null;
        const nth = seen.get(stop.query) ?? 0;
        seen.set(stop.query, nth + 1);
        return { ...stop, point: offsetPoint(point, nth) };
      })
      .filter((item): item is MapStop & { point: LatLng } => item != null);
  }, [stops, points]);

  const line = resolved.map((item) => [item.point.lat, item.point.lng] as [number, number]);
  const center = resolved[0]?.point ?? { lat: 48.2082, lng: 16.3738 };
  const focusPoint = resolved.find((item) => item.number === focusNumber)?.point ?? null;

  useEffect(() => {
    if (focusNumber == null) return;
    markerRefs.current.get(focusNumber)?.openPopup();
  }, [focusNumber, focusToken, resolved]);

  if (!stops.length) {
    return <div className="map-empty">這天沒有可顯示的地點。</div>;
  }

  return (
    <div className="map-shell">
      {loading && <div className="map-status">正在把地點放到地圖上…</div>}
      {!loading && resolved.length === 0 && <div className="map-status">暫時找不到座標，可用下方連結在 Google Maps 開啟。</div>}
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom={false}
        className="day-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ResizeMap />
        <FitBounds points={resolved.map((item) => item.point)} locked={Boolean(focusToken)} />
        <FocusOn point={focusPoint} token={focusToken} />
        {line.length > 1 && <Polyline positions={line} pathOptions={{ color, weight: 2.5, opacity: 0.55 }} />}
        {resolved.map((item) => (
          <Marker
            key={`${item.query}-${item.number}`}
            position={[item.point.lat, item.point.lng]}
            icon={numberedIcon(item.number, item.number === focusNumber, color)}
            ref={(marker) => {
              if (marker) markerRefs.current.set(item.number, marker);
              else markerRefs.current.delete(item.number);
            }}
            eventHandlers={{
              click: () => onSelect(item.index),
            }}
          >
            <Popup>
              <strong>
                第 {item.number} 項 · {item.name}
                {item.mustSee ? " · 必看" : ""}
              </strong>
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
