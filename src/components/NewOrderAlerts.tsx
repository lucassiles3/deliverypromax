import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useStoreAccess } from "@/hooks/useStoreAccess";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";

type Alert = {
  id: string;
  total: number;
  customer: string | null;
  storeId: string;
  storeName: string;
  createdAt: string;
};

export const NewOrderAlerts = () => {
  const { user } = useAuth();
  const { data: stores = [] } = useStoreAccess();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [soundMap, setSoundMap] = useState<Record<string, boolean>>({});
  const audioUnlockedRef = useRef(false);
  const loopRef = useRef<number | null>(null);
  const shouldPlaySoundRef = useRef<(storeId: string) => boolean>(() => true);

  // Unlock audio on first interaction
  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        o.connect(g).connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 0.01);
        setTimeout(() => ctx.close(), 200);
        audioUnlockedRef.current = true;
      } catch {/* ignore */}
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Ask notification permission once
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Buscar toggles de som de todas as lojas
  useEffect(() => {
    if (stores.length === 0) {
      setSoundMap({});
      return;
    }
    const ids = stores.map((s) => s.id);
    supabase
      .from("stores")
      .select("id, sound_alerts_enabled")
      .in("id", ids)
      .then(({ data, error }) => {
        if (error) return;
        const map: Record<string, boolean> = {};
        data?.forEach((row: any) => {
          map[row.id] = row.sound_alerts_enabled !== false;
        });
        setSoundMap(map);
      });
  }, [stores]);

  const shouldPlaySound = useCallback(
    (storeId: string) => soundMap[storeId] !== false,
    [soundMap],
  );

  // keep ref in sync so interval always reads latest
  useEffect(() => {
    shouldPlaySoundRef.current = shouldPlaySound;
  }, [shouldPlaySound]);

  const playDing = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const master = ctx.createGain();
      master.gain.value = 1.0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 20;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      master.connect(comp).connect(ctx.destination);

      const ringAt = (offset: number) => {
        const freqs = [880, 1320, 1760, 2640];
        const t0 = ctx.currentTime + offset;
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = idx === 0 ? "triangle" : "sine";
          osc.frequency.value = f;
          const peak = idx === 0 ? 0.95 : 0.4 / (idx + 1);
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(peak, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
          osc.connect(g).connect(master);
          osc.start(t0);
          osc.stop(t0 + 1.45);
        });
      };
      ringAt(0); ringAt(0.45); ringAt(0.9); ringAt(1.35);
      setTimeout(() => ctx.close(), 3500);
    } catch {/* ignore */}
  }, []);

  // Subscribe a cada loja do lojista. Canal estável (sem random) — som/popup/notif
  // são responsabilidade exclusiva desse componente; OrdersKanban/Admin usam um canal
  // separado (orders-shared:*) só para invalidação de cache.
  useEffect(() => {
    if (!user || stores.length === 0) return;
    const channels = stores.map((s) =>
      supabase
        .channel(`new-order-alert:${s.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${s.id}` },
          (payload: any) => {
            const o = payload.new;
            if (!["pending_payment", "received"].includes(String(o.status))) return;
            const alert: Alert = {
              id: o.id,
              total: Number(o.total ?? 0),
              customer: o.customer_name ?? null,
              storeId: s.id,
              storeName: s.name,
              createdAt: o.created_at,
            };
            setAlerts((prev) => (prev.find((a) => a.id === alert.id) ? prev : [alert, ...prev]));
            setOpen(true);
            if (shouldPlaySoundRef.current(s.id)) playDing();
            if (navigator.vibrate) {
              try { navigator.vibrate([300, 120, 300, 120, 600]); } catch {/* ignore */}
            }
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                const n = new Notification(`🔔 Novo pedido · ${s.name}`, {
                  body: `${alert.customer ?? "Cliente"} · ${brl(alert.total)}`,
                  icon: "/favicon.ico",
                  tag: alert.id,
                  requireInteraction: true,
                } as NotificationOptions);
                n.onclick = () => { window.focus(); n.close(); };
              }
            } catch {/* ignore */}
          },
        )
        .subscribe(),
    );
    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [user, stores, playDing]);

  // Loop while there are unacknowledged alerts
  useEffect(() => {
    if (alerts.length === 0) {
      if (loopRef.current) { window.clearInterval(loopRef.current); loopRef.current = null; }
      return;
    }
    if (loopRef.current) return;
    loopRef.current = window.setInterval(() => {
      const anyWithSound = alerts.some((a) => shouldPlaySoundRef.current(a.storeId));
      if (anyWithSound) playDing();
    }, 8000);
    return () => {
      if (loopRef.current) { window.clearInterval(loopRef.current); loopRef.current = null; }
    };
  }, [alerts.length, playDing]);

  const clearAll = () => { setAlerts([]); setOpen(false); };
  const goToOrders = () => {
    clearAll();
    navigate("/admin");
  };

  if (!user || stores.length === 0) return null;

  return (
    <>
      <Dialog open={open && alerts.length > 0} onOpenChange={(o) => setOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
              </span>
              {alerts.length === 1 ? "Novo pedido recebido!" : `${alerts.length} novos pedidos!`}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {alerts.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.storeName}</div>
                  <div className="line-clamp-1 text-sm font-bold">{a.customer ?? "Cliente"}</div>
                  <div className="text-xs text-muted-foreground">#{a.id.slice(0, 6).toUpperCase()}</div>
                </div>
                <div className="font-display text-base font-bold text-primary">{brl(a.total)}</div>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={clearAll}>
              <BellOff className="mr-1 h-4 w-4" /> Silenciar
            </Button>
            <Button onClick={goToOrders} className="flex-1">
              Ver pedidos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating stop-sound button */}
      {alerts.length > 0 && (
        <button
          onClick={clearAll}
          className="fixed bottom-24 right-4 z-[60] flex items-center gap-2 rounded-full bg-destructive px-4 py-3 text-destructive-foreground shadow-lg ring-4 ring-destructive/30 animate-pulse hover:scale-105 transition-smooth md:bottom-6"
          title="Parar som"
        >
          <BellOff className="h-5 w-5" />
          <span className="text-sm font-bold">Parar som</span>
          <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs font-bold">{alerts.length}</span>
        </button>
      )}
    </>
  );
};

export default NewOrderAlerts;
