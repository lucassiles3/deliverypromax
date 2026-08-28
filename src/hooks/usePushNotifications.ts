import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Solicita permissão e dispara notificações nativas do navegador
 * para cada nova linha em `notifications` do usuário logado.
 * Retorna a permissão atual e uma função para solicitar.
 */
export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const seenIds = useRef<Set<string>>(new Set());

  const request = async () => {
    if (typeof Notification === "undefined") return "denied" as NotificationPermission;
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  };

  // Auto-pede permissão na primeira visita logada
  useEffect(() => {
    if (!user) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      // pequeno delay para não bloquear navegação inicial
      const t = setTimeout(() => {
        Notification.requestPermission().then(setPermission).catch(() => {});
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user]);

  // Realtime: dispara push para cada nova notificação do usuário
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`push-notif-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (!row || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);

          // Toca um beep sutil
          try {
            const Ctx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new Ctx();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.setValueAtTime(0, ctx.currentTime);
            g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
            o.connect(g).connect(ctx.destination);
            o.start();
            o.stop(ctx.currentTime + 0.45);
            setTimeout(() => ctx.close(), 800);
          } catch {
            /* ignore */
          }

          // Notificação nativa
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try {
              const n = new Notification(row.title ?? "Atualização", {
                body: row.message ?? "",
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: row.id,
                renotify: true,
              } as NotificationOptions);
              if (row.link) {
                n.onclick = () => {
                  window.focus();
                  window.location.href = row.link;
                  n.close();
                };
              }
            } catch {
              /* ignore */
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { permission, request };
};
