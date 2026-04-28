import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStoreAccess, canAccessSection } from "@/hooks/useStoreAccess";
import { useStoreToggles } from "@/hooks/useStoreToggles";
import { PDVTab } from "@/components/admin/PDVTab";
import { StoreOpenToggle } from "@/components/admin/StoreOpenToggle";

const PDV = () => {
  const { user, loading } = useAuth();
  const { data: stores = [] } = useStoreAccess();
  const [storeId, setStoreId] = useState<string | null>(null);
  const { toggles } = useStoreToggles(storeId);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!storeId && stores.length) setStoreId(stores[0].id);
  }, [stores, storeId]);

  useEffect(() => {
    document.title = "PDV • Balcão";
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  };

  if (loading) return <div className="min-h-screen" />;
  if (!user) return <Navigate to="/auth" replace />;

  const currentStore = stores.find((s) => s.id === storeId);
  const role = currentStore?.role ?? null;
  const allowed = canAccessSection(role, "pdv");

  if (stores.length === 0) {
    return (
      <div className="min-h-screen bg-muted/40 p-6">
        <div className="mx-auto max-w-md rounded-2xl bg-card p-8 text-center shadow-soft">
          <h1 className="font-display text-2xl font-bold">Sem lojas atribuídas</h1>
          <Link to="/admin" className="mt-4 inline-block text-sm font-bold text-primary">
            ← Voltar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-3">
          <Link
            to="/admin"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Painel
          </Link>
          <span className="text-border">|</span>
          <h1 className="font-display text-lg font-bold">PDV — Balcão</h1>
          <div className="ml-auto flex items-center gap-2">
            <StoreOpenToggle storeId={storeId} variant="inline" />
            <select
              value={storeId ?? ""}
              onChange={(e) => setStoreId(e.target.value)}
              className="rounded-xl border-2 border-border bg-card px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.logo} {s.name}
                </option>
              ))}
            </select>
            <button
              onClick={toggleFullscreen}
              className="rounded-xl border-2 border-border bg-card p-2 hover:border-primary"
              title="Tela cheia"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {!allowed ? (
        <div className="container mx-auto max-w-md py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para usar o PDV nesta loja.
          </p>
        </div>
      ) : !toggles.pdv_enabled ? (
        <div className="container mx-auto max-w-md py-12 text-center">
          <p className="text-sm text-muted-foreground">
            PDV desabilitado para esta loja. Habilite em <strong>Painel → Operação</strong>.
          </p>
        </div>
      ) : (
        currentStore && (
          <div className="container py-4">
            <PDVTab storeId={currentStore.id} storeName={currentStore.name} fullscreen />
          </div>
        )
      )}

      {storeId && role === "owner" && <StoreOpenToggle storeId={storeId} />}
    </div>
  );
};

export default PDV;
