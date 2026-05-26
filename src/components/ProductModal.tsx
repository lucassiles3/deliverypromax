import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Star, Flame } from "lucide-react";
import type { Product, AddonGroup, AddonOption } from "@/data/stores";
import { useCart, type CartCustomization } from "@/context/CartContext";

type Props = {
  product: Product | null;
  storeSlug: string;
  onClose: () => void;
};

export const ProductModal = ({ product, storeSlug, onClose }: Props) => {
  const { addCustom } = useCart();
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [picks, setPicks] = useState<Record<string, AddonOption[]>>({});

  // Reset on open
  const open = !!product;
  const groups = product?.addonGroups ?? [];

  const setSingle = (g: AddonGroup, opt: AddonOption) =>
    setPicks((p) => ({ ...p, [g.id]: [opt] }));

  const toggleMulti = (g: AddonGroup, opt: AddonOption) =>
    setPicks((p) => {
      const cur = p[g.id] ?? [];
      const has = cur.find((o) => o.id === opt.id);
      let next: AddonOption[];
      if (has) next = cur.filter((o) => o.id !== opt.id);
      else if (g.max && cur.length >= g.max) next = cur;
      else next = [...cur, opt];
      return { ...p, [g.id]: next };
    });

  const addonsTotal = useMemo(
    () => Object.values(picks).flat().reduce((s, o) => s + o.price, 0),
    [picks],
  );
  const unitPrice = (product?.price ?? 0) + addonsTotal;

  const requiredOk = groups.every((g) => !g.required || (picks[g.id]?.length ?? 0) > 0);

  const reset = () => {
    setQty(1);
    setNotes("");
    setPicks({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!product || !requiredOk) return;
    const customizations: CartCustomization[] = groups
      .filter((g) => (picks[g.id]?.length ?? 0) > 0)
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        selections: picks[g.id]!.filter((o) => o.price > 0 || g.type === "single"),
      }))
      .filter((c) => c.selections.length > 0);
    addCustom(product, storeSlug, customizations, qty, notes.trim() || undefined);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1.5rem)] max-w-md overflow-hidden p-0 sm:max-w-md sm:rounded-2xl">
        {product && (
          <div className="flex max-h-[90vh] flex-col">
            <div className="relative aspect-square w-full shrink-0 overflow-hidden bg-muted">
              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent" />
              {product.bestseller && (
                <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-foreground/85 px-2 py-0.5 text-[10px] font-bold text-background backdrop-blur">
                  <Flame className="h-3 w-3 text-accent" /> Mais pedido
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-3">
              <div className="-mt-3 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold leading-tight sm:text-xl">{product.name}</h2>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 fill-accent text-accent" />
                    {product.rating} • {product.reviews} avaliações
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{product.description}</p>

              <div className="mt-4 space-y-5">
                {groups.map((g) => (
                  <section key={g.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-display font-bold">{g.name}</h3>
                      {g.required && (
                        <span className="rounded-md bg-secondary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-secondary">
                          Obrigatório
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {g.options.map((opt) => {
                        const checked = !!picks[g.id]?.find((o) => o.id === opt.id);
                        return (
                          <label
                            key={opt.id}
                            className={`flex cursor-pointer items-center justify-between rounded-xl border-2 p-3 transition-smooth ${
                              checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type={g.type === "single" ? "radio" : "checkbox"}
                                name={g.id}
                                checked={checked}
                                onChange={() =>
                                  g.type === "single" ? setSingle(g, opt) : toggleMulti(g, opt)
                                }
                                className="h-4 w-4 accent-primary"
                              />
                              <span className="text-sm font-medium">{opt.name}</span>
                            </div>
                            {opt.price > 0 && (
                              <span className="text-sm font-bold text-primary">
                                +R$ {opt.price.toFixed(2).replace(".", ",")}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}

                <section>
                  <h3 className="mb-2 font-display font-bold">Alguma observação?</h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, 200))}
                    placeholder="Ex: sem cebola, ponto da carne..."
                    className="w-full resize-none rounded-xl border-2 border-border bg-background p-3 text-sm outline-none transition-smooth focus:border-primary"
                    rows={2}
                  />
                </section>
              </div>
            </div>

            <div className="border-t bg-card p-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-full border bg-background p-0.5">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                    aria-label="Diminuir"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-bold">{qty}</span>
                  <button
                    onClick={() => setQty(qty + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    aria-label="Aumentar"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Button
                  disabled={!requiredOk}
                  onClick={submit}
                  className="h-11 flex-1 rounded-xl gradient-primary text-sm font-bold shadow-glow transition-bounce hover:scale-[1.01] disabled:opacity-50"
                >
                  {requiredOk
                    ? `Adicionar • R$ ${(unitPrice * qty).toFixed(2).replace(".", ",")}`
                    : "Escolha as opções obrigatórias"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
