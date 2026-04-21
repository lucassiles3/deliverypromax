import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

// Fix default icon path for leaflet bundled assets
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

const Recenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom() < 14 ? 15 : map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
};

export const CourierMap = ({
  courierLat,
  courierLng,
  destLat,
  destLng,
  height = 320,
  courierLabel,
  destLabel,
}: {
  courierLat?: number | null;
  courierLng?: number | null;
  destLat?: number | null;
  destLng?: number | null;
  height?: number;
  courierLabel?: string;
  destLabel?: string;
}) => {
  // Fallback center
  const center: [number, number] = courierLat && courierLng
    ? [courierLat, courierLng]
    : destLat && destLng
      ? [destLat, destLng]
      : [-23.5505, -46.6333]; // SP default

  return (
    <div className="overflow-hidden rounded-2xl border-2 border-border" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
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
        {courierLat != null && courierLng != null && <Recenter lat={courierLat} lng={courierLng} />}
      </MapContainer>
    </div>
  );
};
