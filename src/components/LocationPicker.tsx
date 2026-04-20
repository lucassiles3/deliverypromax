import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";

// Fix default marker icon paths (Vite bundling)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Coords = { lat: number; lng: number };

const Recenter = ({ center }: { center: Coords }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom() < 15 ? 16 : map.getZoom());
  }, [center.lat, center.lng, map]);
  return null;
};

const ClickHandler = ({ onChange }: { onChange: (c: Coords) => void }) => {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

interface LocationPickerProps {
  value: Coords | null;
  onChange: (c: Coords) => void;
  defaultCenter?: Coords;
}

export const LocationPicker = ({ value, onChange, defaultCenter }: LocationPickerProps) => {
  const [locating, setLocating] = useState(false);
  const center = value ?? defaultCenter ?? { lat: -23.5505, lng: -46.6333 };
  const markerRef = useRef<L.Marker>(null);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Toque no mapa para ajustar o pino
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          <Crosshair className="h-3.5 w-3.5" />
          {locating ? "Localizando..." : "Usar minha localização"}
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border-2 border-border" style={{ height: 200 }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={16}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter center={center} />
          <ClickHandler onChange={onChange} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={icon}
              draggable
              ref={markerRef}
              eventHandlers={{
                dragend: () => {
                  const m = markerRef.current;
                  if (!m) return;
                  const { lat, lng } = m.getLatLng();
                  onChange({ lat, lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {value && (
        <p className="text-[11px] text-muted-foreground">
          📍 {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
        </p>
      )}
    </div>
  );
};
