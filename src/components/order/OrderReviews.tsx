import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { RatingStars } from "./RatingStars";
import { Button } from "@/components/ui/button";

type Item = {
  id: string;
  product_id: string | null;
  product_name: string;
};

export const OrderReviews = ({
  orderId,
  storeId,
  userId,
  storeName,
  items,
}: {
  orderId: string;
  storeId: string;
  userId: string;
  storeName: string;
  items: Item[];
}) => {
  const qc = useQueryClient();

  const { data: storeReview } = useQuery({
    queryKey: ["store-review", orderId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_reviews")
        .select("id, rating, comment")
        .eq("order_id", orderId)
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const { data: productReviews } = useQuery({
    queryKey: ["product-reviews", orderId, userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_reviews")
        .select("id, order_item_id, rating, comment")
        .eq("order_id", orderId)
        .eq("user_id", userId);
      return data ?? [];
    },
  });

  const [storeRating, setStoreRating] = useState(0);
  const [storeComment, setStoreComment] = useState("");
  const [prodState, setProdState] = useState<Record<string, { rating: number; comment: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (storeReview) {
      setStoreRating(storeReview.rating);
      setStoreComment(storeReview.comment ?? "");
    }
  }, [storeReview]);

  useEffect(() => {
    if (productReviews) {
      const map: Record<string, { rating: number; comment: string }> = {};
      productReviews.forEach((r) => {
        map[r.order_item_id] = { rating: r.rating, comment: r.comment ?? "" };
      });
      setProdState(map);
    }
  }, [productReviews]);

  const saveStore = async () => {
    if (storeRating < 1) {
      toast.error("Escolha de 1 a 5 estrelas para a loja");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        order_id: orderId,
        store_id: storeId,
        user_id: userId,
        rating: storeRating,
        comment: storeComment.trim() || null,
      };
      const { error } = await supabase
        .from("store_reviews")
        .upsert(payload, { onConflict: "order_id,user_id" });
      if (error) throw error;
      toast.success("Avaliação da loja enviada!");
      qc.invalidateQueries({ queryKey: ["store-review", orderId, userId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao avaliar");
    } finally {
      setSaving(false);
    }
  };

  const saveProduct = async (item: Item) => {
    const st = prodState[item.id];
    if (!st || st.rating < 1) {
      toast.error("Escolha de 1 a 5 estrelas");
      return;
    }
    if (!item.product_id) {
      toast.error("Produto indisponível para avaliação");
      return;
    }
    try {
      const { error } = await supabase
        .from("product_reviews")
        .upsert(
          {
            order_id: orderId,
            order_item_id: item.id,
            product_id: item.product_id,
            store_id: storeId,
            user_id: userId,
            rating: st.rating,
            comment: st.comment.trim() || null,
          },
          { onConflict: "order_item_id,user_id" },
        );
      if (error) throw error;
      toast.success(`Avaliação de "${item.product_name}" enviada!`);
      qc.invalidateQueries({ queryKey: ["product-reviews", orderId, userId] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao avaliar");
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Star className="h-4 w-4" /> Avalie seu pedido
      </h3>

      {/* Loja */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="mb-2 text-sm font-bold">Como foi a experiência com {storeName}?</p>
        <RatingStars value={storeRating} onChange={setStoreRating} />
        <textarea
          value={storeComment}
          onChange={(e) => setStoreComment(e.target.value)}
          placeholder="Conte como foi (opcional)"
          rows={2}
          className="mt-3 w-full rounded-xl border-2 border-border bg-background p-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={saveStore} disabled={saving} size="sm">
            {storeReview ? "Atualizar avaliação" : "Enviar avaliação"}
          </Button>
        </div>
      </div>

      {/* Produtos */}
      {items.length > 0 && (
        <div className="mt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Avalie os itens
          </p>
          {items.map((it) => {
            const st = prodState[it.id] ?? { rating: 0, comment: "" };
            const existing = productReviews?.find((r) => r.order_item_id === it.id);
            return (
              <div key={it.id} className="rounded-xl border border-border p-3">
                <p className="mb-2 text-sm font-bold">{it.product_name}</p>
                <RatingStars
                  value={st.rating}
                  onChange={(v) =>
                    setProdState((p) => ({ ...p, [it.id]: { ...st, rating: v } }))
                  }
                  size={20}
                />
                <textarea
                  value={st.comment}
                  onChange={(e) =>
                    setProdState((p) => ({ ...p, [it.id]: { ...st, comment: e.target.value } }))
                  }
                  placeholder="Comentário (opcional)"
                  rows={2}
                  className="mt-2 w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary"
                />
                <div className="mt-2 flex justify-end">
                  <Button onClick={() => saveProduct(it)} size="sm" variant="outline">
                    {existing ? "Atualizar" : "Enviar"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
