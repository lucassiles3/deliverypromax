import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { RatingStars } from "@/components/order/RatingStars";
import { toast } from "sonner";

type PendingOrder = {
  id: string;
  store_id: string;
  storeName: string;
};

const SEEN_KEY = "review-prompt-seen";
const getSeen = (): string[] => {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"); } catch { return []; }
};
const markSeen = (id: string) => {
  const s = new Set(getSeen()); s.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...s].slice(-50)));
};

export const OrderReviewPrompt = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  // Poll for delivered orders not yet reviewed nor seen
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const check = async () => {
      const seen = getSeen();
      const { data } = await supabase
        .from("orders")
        .select("id, store_id, stores(name)")
        .eq("user_id", user.id)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (cancelled || !data) return;
      for (const o of data) {
        if (seen.includes(o.id)) continue;
        // already reviewed?
        const { data: rev } = await supabase
          .from("store_reviews")
          .select("id")
          .eq("order_id", o.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (rev) { markSeen(o.id); continue; }
        if (cancelled) return;
        setPending({
          id: o.id,
          store_id: o.store_id,
          storeName: (o.stores as any)?.name ?? "esta loja",
        });
        setRating(0);
        setComment("");
        return;
      }
    };

    check();
    const ch = supabase
      .channel(`review-prompt:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.status === "delivered" && payload.old?.status !== "delivered") {
            check();
          }
        },
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  if (!pending) return null;

  const skip = () => {
    markSeen(pending.id);
    setPending(null);
  };

  const submit = async () => {
    if (rating < 1) { skip(); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("store_reviews").upsert(
        {
          order_id: pending.id,
          store_id: pending.store_id,
          user_id: user!.id,
          rating,
          comment: comment.trim() || null,
        },
        { onConflict: "order_id,user_id" },
      );
      if (error) throw error;
      toast.success("Obrigado pela avaliação! 🌟");
      markSeen(pending.id);
      setPending(null);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && skip()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-accent text-accent" />
            Como foi seu pedido?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Conte como foi sua experiência com <strong className="text-foreground">{pending.storeName}</strong>.
            Sua opinião ajuda outros clientes.
          </p>
          <div className="flex justify-center">
            <RatingStars value={rating} onChange={setRating} size={36} />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário (opcional)"
            rows={3}
            className="w-full resize-none rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => { markSeen(pending.id); const id = pending.id; setPending(null); navigate(`/meus-pedidos/${id}`); }}
            className="w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground underline"
          >
            Avaliar produtos também
          </button>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={skip}>
            <X className="mr-1 h-4 w-4" /> Pular
          </Button>
          <Button onClick={submit} disabled={saving} className="flex-1">
            {rating < 1 ? "Talvez depois" : saving ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderReviewPrompt;
