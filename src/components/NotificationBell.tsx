import { Bell, BellOff, BellRing, Check, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from "@/hooks/useNotifications";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const NotificationBell = () => {
  const { data = [] } = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const del = useDeleteNotification();
  const { permission, request } = usePushNotifications();

  const handleEnablePush = async () => {
    if (typeof Notification === "undefined") {
      toast.error("Seu navegador não suporta notificações");
      return;
    }
    if (Notification.permission === "denied") {
      toast.error("Permissão bloqueada. Ative nas configurações do navegador (cadeado na barra de endereço).");
      return;
    }
    const p = await request();
    if (p === "granted") {
      toast.success("Notificações ativadas! 🔔");
      try {
        new Notification("Notificações ativadas", { body: "Você receberá alertas em tempo real.", icon: "/favicon.ico" });
      } catch { /* ignore */ }
    } else {
      toast.error("Permissão não concedida");
    }
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-bold">Notificações</p>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Check className="h-3 w-3" /> Marcar todas
            </button>
          )}
        </div>
        {permission !== "granted" && (
          <button
            onClick={handleEnablePush}
            className="flex w-full items-center gap-2 border-b bg-primary/10 px-3 py-2 text-left text-xs font-semibold text-primary hover:bg-primary/15"
          >
            {permission === "denied" ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
            <span className="flex-1">
              {permission === "denied"
                ? "Notificações bloqueadas — toque para ver como ativar"
                : "Ativar notificações push neste navegador"}
            </span>
          </button>
        )}
        <ScrollArea className="h-80">
          {data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Você não tem notificações ainda
            </div>
          ) : (
            <ul className="divide-y">
              {data.slice(0, 20).map((n) => (
                <li key={n.id} className={`group p-3 ${!n.read ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      {(n as any).stores?.name && (
                        <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                          🏪 {(n as any).stores.name}
                        </p>
                      )}
                      {n.link ? (
                        <Link to={n.link} onClick={() => !n.read && markRead.mutate(n.id)}>
                          <p className="text-sm font-semibold leading-tight">{n.title}</p>
                          {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
                        </Link>
                      ) : (
                        <>
                          <p className="text-sm font-semibold leading-tight">{n.title}</p>
                          {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
                        </>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={() => del.mutate(n.id)}
                      className="opacity-0 group-hover:opacity-100"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            to="/notificacoes"
            className="block rounded-md py-1.5 text-center text-xs font-bold text-primary hover:bg-muted"
          >
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};
