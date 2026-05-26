import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Search, LocateFixed } from "lucide-react";
import { toast } from "sonner";

// Fix default marker icons (vite/bundler issue)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type PickedLocation = {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  address?: string;
};

type Props = {
  value?: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
};

const DEFAULT_CENTER: [number, number] = [-14.235, -51.9253]; // Brasil

const ClickHandler = ({ onPick }: { onPick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const Recenter = ({ center, zoom }: { center: [number, number]; zoom?: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true });
  }, [center[0], center[1]]);
  return null;
};

const reverseGeocode = async (lat: number, lng: number): Promise<Partial<PickedLocation>> => {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`,
      { headers: { Accept: "application/json" } },
    );
    const j = await r.json();
    const a = j.address ?? {};
    return {
      city: a.city || a.town || a.village || a.municipality || a.county,
      state: a.state,
      address: j.display_name,
    };
  } catch {
    return {};
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

export const LocationPicker = ({ value, onChange }: Props) => {
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [center, setCenter] = useState<[number, number]>(
    value ? [value.lat, value.lng] : DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState<number>(value ? 16 : 4);
  const debounceRef = useRef<number | null>(null);

  const pickedPos: [number, number] | null = useMemo(
    () => (value ? [value.lat, value.lng] : null),
    [value],
  );

  const handlePick = async (lat: number, lng: number) => {
    onChange({ lat, lng, city: value?.city, state: value?.state, address: value?.address });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      const info = await reverseGeocode(lat, lng);
      onChange({ lat, lng, ...info });
    }, 400);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste navegador");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCenter([latitude, longitude]);
        setZoom(17);
        handlePick(latitude, longitude);
      },
      () => toast.error("Não foi possível obter sua localização"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleSearch = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!search.trim() || searching) return;
    setSearching(true);
    const res = await searchPlace(search.trim());
    setSearching(false);
    if (!res) {
      toast.error("Endereço não encontrado");
      return;
    }
    setCenter([res.lat, res.lng]);
    setZoom(17);
    handlePick(res.lat, res.lng);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1 flex items-center rounded-xl border-2 border-border bg-background overflow-hidden focus-within:border-primary">
          <Search className="ml-3 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Buscar endereço, bairro ou cidade…"
            className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => handleSearch()}
          disabled={searching}
          className="rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {searching ? "..." : "Buscar"}
        </button>
        <button
          type="button"
          onClick={handleUseMyLocation}
          title="Usar minha localização"
          className="rounded-xl border-2 border-border bg-background px-3 text-foreground hover:border-primary"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border-2 border-border" style={{ height: 320 }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Recenter center={center} zoom={zoom} />
          <ClickHandler onPick={handlePick} />
          {pickedPos && (
            <Marker
              position={pickedPos}
              icon={icon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  handlePick(lat, lng);
                },
              }}
            />
          )}
        </MapContainer>
        {!pickedPos && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-3 text-center text-xs font-bold text-foreground">
            <MapPin className="mr-1 inline h-3.5 w-3.5" />
            Toque no mapa para soltar o alfinete da sua loja
          </div>
        )}
      </div>

      {value && (
        <div className="rounded-xl bg-muted/60 p-3 text-xs">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="font-bold text-foreground">
                {value.city ?? "Localização selecionada"}
                {value.state ? `, ${value.state}` : ""}
              </div>
              {value.address && (
                <div className="mt-0.5 line-clamp-2 text-muted-foreground">{value.address}</div>
              )}
              <div className="mt-0.5 text-muted-foreground">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
