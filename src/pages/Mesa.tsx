import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Receipt, HelpCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const Mesa = () => {
  const { token } = useParams<{ token: string }>();
  const [table, setTable] = useState<any>(null);
  const [store, setStore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Mesa · Chamar garçom";
    if (!token) return;
    (async () => {
      const { data: t } = await supabase
        .from("tables")
        .select("id, store_id, number, name")
        .eq("qr_token", token)
        .maybeSingle();
      if (t) {
        setTable(t);
        const { data: s } = await supabase.from("stores").select("name, logo, slug").eq("id", t.store_id).maybeSingle();
        setStore(s);
      }
      setLoading(false);
    })();
  }, [token]);

  const call = async (reason: "waiter" | "bill" | "help") => {
    if (!table) return;
    const { error } = await supabase.from("table_calls").insert({
      store_id: table.store_id,
      table_id: table.id,
      reason,
    });
    if (error) return toast.error(error.message);
    setSent(reason);
    if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
    setTimeout(() => setSent(null), 4000);
  };

  if (loading) return <div className="min-h-screen" />;
  if (!table) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
        <div className="rounded-2xl bg-card p-8 text-center shadow-soft">
          <h1 className="font-display text-xl font-bold">Mesa não encontrada</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gradient-to-b from-background to-muted/40 p-6">
      <div className="mt-6 w-full max-w-md rounded-3xl bg-card p-6 text-center shadow-soft">
        {store && <div className="text-xs uppercase tracking-wider text-muted-foreground">{store.name}</div>}
        <div className="mt-2 font-display text-5xl font-bold text-primary">Mesa {table.number}</div>
        {table.name && <div className="text-sm text-muted-foreground">{table.name}</div>}

        <p className="mt-6 text-sm text-muted-foreground">Como podemos ajudar?</p>

        <div className="mt-4 grid gap-3">
          <Button size="lg" onClick={() => call("waiter")} disabled={sent === "waiter"} className="h-14 text-base">
            {sent === "waiter" ? <><Check className="mr-2 h-5 w-5" />Garçom a caminho</> : <><Bell className="mr-2 h-5 w-5" />Chamar garçom</>}
          </Button>
          <Button size="lg" variant="outline" onClick={() => call("bill")} disabled={sent === "bill"} className="h-14 text-base">
            {sent === "bill" ? <><Check className="mr-2 h-5 w-5" />Pedido enviado</> : <><Receipt className="mr-2 h-5 w-5" />Pedir a conta</>}
          </Button>
          <Button size="lg" variant="outline" onClick={() => call("help")} disabled={sent === "help"} className="h-14 text-base">
            {sent === "help" ? <><Check className="mr-2 h-5 w-5" />Avisamos a equipe</> : <><HelpCircle className="mr-2 h-5 w-5" />Preciso de ajuda</>}
          </Button>
        </div>

        {store?.slug && (
          <a
            href={`/loja/${store.slug}`}
            className="mt-6 inline-block text-xs font-bold text-primary underline"
          >
            Ver cardápio →
          </a>
        )}
      </div>
    </div>
  );
};

export default Mesa;
