import { useEffect, useState } from "react";
import { MapPin, Navigation, Clock } from "lucide-react";
import { LazyCourierMap as CourierMap } from "@/components/LazyCourierMap";

interface PickupMapProps {
  storeName: string;
  storeLat: number | null;
  storeLng: number | null;
  storeAddress?: string | null;
  pickupReadyAt?: string | null; // ISO when ready (e.g. order.accepted_at + prep_time)
  pickupNote?: string | null;
}

/**
 * Static-ish pickup map: store marker + customer's current location.
 * Asks for geolocation; falls back gracefully when denied.
 */
export const PickupMap = ({
  storeName,
  storeLat,
  storeLng,
  storeAddress,
  pickupReadyAt,
  pickupNote,
}: PickupMapProps) => {
  const [customer, setCustomer] = useState<{ lat: number; lng: number } | null>(null);
  const [permission, setPermission] = useState<"idle" | "asking" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    setPermission("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCustomer({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPermission("granted");
      },
      () => setPermission("denied"),
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 8000 },
    );
  }, []);

  const mapsUrl =
    storeLat && storeLng
      ? `https://www.google.com/maps/dir/?api=1&destination=${storeLat},${storeLng}`
      : storeAddress
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`
        : null;

  const readyLabel = pickupReadyAt
    ? new Date(pickupReadyAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <MapPin className="h-4 w-4" /> Ponto de retirada
      </h3>

      <div className="mb-3 flex items-start gap-3 rounded-xl bg-muted/40 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/20 text-2xl">
          🏪
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">{storeName}</p>
          {storeAddress && (
            <p className="truncate text-xs text-muted-foreground">{storeAddress}</p>
          )}
          {readyLabel && (
            <p className="mt-1 flex items-center gap-1 text-xs font-bold text-primary">
              <Clock className="h-3.5 w-3.5" /> Pronto às {readyLabel}
            </p>
          )}
          {pickupNote && (
            <p className="mt-1 text-xs italic text-muted-foreground">📝 {pickupNote}</p>
          )}
        </div>
      </div>

      {storeLat != null && storeLng != null ? (
        <>
          <CourierMap
            storeLat={storeLat}
            storeLng={storeLng}
            storeLabel={storeName}
            courierLat={customer?.lat ?? null}
            courierLng={customer?.lng ?? null}
            courierLabel="Você"
            path={
              customer && storeLat && storeLng
                ? [
                    [customer.lat, customer.lng],
                    [storeLat, storeLng],
                  ]
                : undefined
            }
            recenterOnCourier={false}
            height={260}
          />
          {permission === "denied" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Permita o acesso à localização para ver a rota até a loja.
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          A loja ainda não cadastrou as coordenadas no mapa.
        </div>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90"
        >
          <Navigation className="h-4 w-4" /> Abrir rotas no Google Maps
        </a>
      )}
    </section>
  );
};
