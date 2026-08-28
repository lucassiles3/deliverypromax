import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Clock, Route } from "lucide-react";
import { LazyCourierMap as CourierMap } from "@/components/LazyCourierMap";
import { useCourierOrderHistory } from "@/hooks/useCourierLocation";

interface RouteReplayProps {
  orderId: string;
  destLat?: number | null;
  destLng?: number | null;
  storeLat?: number | null;
  storeLng?: number | null;
  storeName?: string;
}

const haversine = (a: [number, number], b: [number, number]) => {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
};

export const RouteReplay = ({
  orderId,
  destLat,
  destLng,
  storeLat,
  storeLng,
  storeName,
}: RouteReplayProps) => {
  const { points, loading } = useCourierOrderHistory(orderId);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // multiplier
  const timerRef = useRef<number | null>(null);

  const fullPath = useMemo<[number, number][]>(
    () => points.map((p) => [Number(p.lat), Number(p.lng)]),
    [points],
  );

  const visiblePath = useMemo(
    () => fullPath.slice(0, Math.max(1, idx + 1)),
    [fullPath, idx],
  );

  const currentPoint = points[idx];

  // Total distance traveled
  const totalDistance = useMemo(() => {
    let m = 0;
    for (let i = 1; i < fullPath.length; i++) m += haversine(fullPath[i - 1], fullPath[i]);
    return m;
  }, [fullPath]);

  const totalDuration = useMemo(() => {
    if (points.length < 2) return 0;
    return (
      (new Date(points[points.length - 1].recorded_at).getTime() -
        new Date(points[0].recorded_at).getTime()) /
      1000 /
      60
    );
  }, [points]);

  // Auto-advance
  useEffect(() => {
    if (!playing || points.length === 0) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => {
        if (i >= points.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 600 / speed);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, points.length, speed]);

  if (loading) {
    return (
      <section className="rounded-2xl bg-card p-5 shadow-soft">
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
          Carregando trajeto…
        </div>
      </section>
    );
  }

  if (points.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Route className="h-4 w-4" /> Trajeto da entrega
      </h3>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 p-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Pontos</div>
          <div className="font-display text-sm font-bold">{points.length}</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Distância</div>
          <div className="font-display text-sm font-bold">
            {(totalDistance / 1000).toFixed(2)} km
          </div>
        </div>
        <div className="rounded-xl bg-muted/40 p-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Duração</div>
          <div className="font-display text-sm font-bold">{totalDuration.toFixed(0)} min</div>
        </div>
      </div>

      <CourierMap
        path={visiblePath}
        courierLat={currentPoint ? Number(currentPoint.lat) : null}
        courierLng={currentPoint ? Number(currentPoint.lng) : null}
        courierLabel="Entregador"
        destLat={destLat ?? null}
        destLng={destLng ?? null}
        destLabel="Entrega"
        storeLat={storeLat ?? null}
        storeLng={storeLng ?? null}
        storeLabel={storeName}
        recenterOnCourier={false}
        height={300}
      />

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {
            if (idx >= points.length - 1) setIdx(0);
            setPlaying((p) => !p);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => {
            setIdx(0);
            setPlaying(false);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-border"
          aria-label="Reiniciar"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, points.length - 1)}
          value={idx}
          onChange={(e) => {
            setIdx(Number(e.target.value));
            setPlaying(false);
          }}
          className="flex-1 accent-primary"
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded-lg border-2 border-border bg-background px-2 py-1 text-xs font-bold"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>

      {currentPoint && (
        <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(currentPoint.recorded_at).toLocaleTimeString("pt-BR")}
          {currentPoint.speed != null && (
            <> • {(Number(currentPoint.speed) * 3.6).toFixed(1)} km/h</>
          )}
        </p>
      )}
    </section>
  );
};
