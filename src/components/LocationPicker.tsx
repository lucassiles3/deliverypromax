import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

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

const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    return j.display_name ?? null;
  } catch {
    return null;
  }
};

const searchPlace = async (q: string): Promise<{ lat: number; lng: number; name: string } | null> => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=pt-BR&countrycodes=br&q=${encodeURIComponent(q)}`,
    );
    const arr = await r.json();
    if (!Array.isArray(arr) || !arr[0]) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon), name: arr[0].display_name };
  } catch {
    return null;
  }
};

interface LocationPickerProps {
  value: Coords | null;
  onChange: (c: Coords) => void;
  /** Endereço externo (input controlado). Quando muda, é refletido na busca. */
  address?: string;
  /** Recebe o endereço resolvido (via marker drag, click ou GPS). */
  onAddressChange?: (address: string) => void;
  defaultCenter?: Coords;
}

export const LocationPicker = ({
  value,
  onChange,
  address,
  onAddressChange,
  defaultCenter,
}: LocationPickerProps) => {
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState(address ?? "");
  const debounceRef = useRef<number | null>(null);
  const center = value ?? defaultCenter ?? { lat: -23.5505, lng: -46.6333 };

  // Mantém o input em sincronia se o pai mudar `address`
  useEffect(() => {
    if (address !== undefined && address !== search) setSearch(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Quando o pino mexe → reverse-geocode e atualiza endereço
  const handleCoordsChange = (c: Coords) => {
    onChange(c);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const addr = await reverseGeocode(c.lat, c.lng);
      if (addr) {
        setSearch(addr);
        onAddressChange?.(addr);
      }
    }, 400);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleCoordsChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error("Não foi possível obter sua localização");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const runSearch = async (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    const q = search.trim();
    if (!q || searching) return;
    setSearching(true);
    const res = await searchPlace(q);
    setSearching(false);
    if (!res) {
      toast.error("Endereço não encontrado");
      return;
    }
    onChange({ lat: res.lat, lng: res.lng });
    setSearch(res.name);
    onAddressChange?.(res.name);
  };

  return (
    <div className="space-y-2">
      {/* Barra de busca de endereço */}
      <form
        onSubmit={runSearch}
        className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-3 py-2 focus-within:border-primary"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar endereço, CEP, bairro ou cidade…"
          className="flex-1 bg-transparent text-sm outline-none"
        />
        <button
          type="submit"
          disabled={searching || !search.trim()}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buscar"}
        </button>
      </form>

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          Toque ou arraste o pino para ajustar
        </p>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          <Crosshair className="h-3.5 w-3.5" />
          {locating ? "Localizando..." : "Minha localização"}
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border-2 border-border" style={{ height: 240 }}>
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
          <ClickHandler onChange={handleCoordsChange} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={icon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  handleCoordsChange({ lat, lng });
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
