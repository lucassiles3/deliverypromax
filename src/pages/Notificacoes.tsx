import { Navigate, Link } from "react-router-dom";
import { Bell, Check, Trash2 } from "lucide-react";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { useAuth } from "@/hooks/useAuth";
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useDeleteNotification,
  useUnreadCount,
} from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const Notificacoes = () => {
  const { user, loading } = useAuth();
  const { data = [], isLoading } = useNotifications();
  const unread = useUnreadCount();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const del = useDeleteNotification();

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header />
      <div className="container max-w-2xl py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            <h1 className="font-display text-2xl font-bold md:text-3xl">Notificações</h1>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAll.mutate()}>
              <Check className="mr-1 h-4 w-4" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        {isLoading ? null : data.length === 0 ? (
          <div className="rounded-2xl border border-dashed py-16 text-center text-muted-foreground">
            <Bell className="mx-auto mb-3 h-8 w-8 opacity-40" />
            Sem notificações por enquanto
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((n) => (
              <li
                key={n.id}
                className={`rounded-2xl border bg-card p-4 shadow-soft ${!n.read ? "border-primary/40" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => !n.read && markRead.mutate(n.id)}
                        className="block"
                      >
                        <p className="font-display font-bold">{n.title}</p>
                        {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                      </Link>
                    ) : (
                      <>
                        <p className="font-display font-bold">{n.title}</p>
                        {n.message && <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>}
                      </>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!n.read && (
                      <button
                        onClick={() => markRead.mutate(n.id)}
                        className="rounded-md p-1.5 hover:bg-muted"
                        aria-label="Marcar como lida"
                      >
                        <Check className="h-4 w-4 text-success" />
                      </button>
                    )}
                    <button
                      onClick={() => del.mutate(n.id)}
                      className="rounded-md p-1.5 hover:bg-muted"
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </div>
  );
};

export default Notificacoes;
