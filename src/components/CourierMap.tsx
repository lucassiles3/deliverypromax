import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";

const courierIcon = L.divIcon({
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:18px;border:3px solid white">🛵</div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const destIcon = L.divIcon({
  html: `<div style="background:hsl(var(--secondary));color:hsl(var(--secondary-foreground));width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:18px;border:3px solid white">📍</div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});
const storeIcon = L.divIcon({
  html: `<div style="background:hsl(var(--accent));color:hsl(var(--accent-foreground));width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.25);font-size:18px;border:3px solid white">🏪</div>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 14 ? 15 : map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
};

const FitBounds = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points.map(([a, b]) => L.latLng(a, b)));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }, [points, map]);
  return null;
};

export const CourierMap = ({
  courierLat,
  courierLng,
  destLat,
  destLng,
  storeLat,
  storeLng,
  path,
  height = 320,
  courierLabel,
  destLabel,
  storeLabel,
  recenterOnCourier = true,
}: {
  courierLat?: number | null;
  courierLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  storeLat?: number | null;
  storeLng?: number | null;
  path?: [number, number][];
  height?: number;
  courierLabel?: string;
  destLabel?: string;
  storeLabel?: string;
  recenterOnCourier?: boolean;
}) => {
  const center: [number, number] = courierLat && courierLng
    ? [courierLat, courierLng]
    : storeLat && storeLng
      ? [storeLat, storeLng]
      : destLat && destLng
        ? [destLat, destLng]
        : [-23.5505, -46.6333];

  const fitPoints: [number, number][] = [];
  if (courierLat != null && courierLng != null) fitPoints.push([courierLat, courierLng]);
  if (destLat != null && destLng != null) fitPoints.push([destLat, destLng]);
  if (storeLat != null && storeLng != null) fitPoints.push([storeLat, storeLng]);
  if (path && path.length > 0) fitPoints.push(...path);

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path && path.length >= 2 && (
          <Polyline
            positions={path}
            pathOptions={{ color: "hsl(var(--primary))", weight: 4, opacity: 0.8, dashArray: "6 4" }}
          />
        )}
        {storeLat != null && storeLng != null && (
          <Marker position={[storeLat, storeLng]} icon={storeIcon}>
            <Popup>{storeLabel ?? "Loja"}</Popup>
          </Marker>
        )}
        {courierLat != null && courierLng != null && (
          <Marker position={[courierLat, courierLng]} icon={courierIcon}>
            <Popup>{courierLabel ?? "Entregador"}</Popup>
          </Marker>
        )}
        {destLat != null && destLng != null && (
          <Marker position={[destLat, destLng]} icon={destIcon}>
            <Popup>{destLabel ?? "Destino"}</Popup>
          </Marker>
        )}
        {recenterOnCourier && courierLat != null && courierLng != null && (
          <Recenter lat={courierLat} lng={courierLng} />
        )}
        {fitPoints.length >= 2 && !recenterOnCourier && <FitBounds points={fitPoints} />}
      </MapContainer>
    </div>
  );
};
