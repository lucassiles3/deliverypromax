import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, Truck } from "lucide-react";
import { stores } from "@/data/stores";

export const CartDrawer = () => {
  const { items, isOpen, setOpen, updateQty, remove, subtotal, storeSlug } = useCart();

  const store = stores.find((s) => s.slug === storeSlug);
  const threshold = store?.freeShippingThreshold ?? 50;
  const fee = store?.deliveryFee ?? 0;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, (subtotal / threshold) * 100);
  const finalFee = subtotal >= threshold ? 0 : fee;

  // Auto-close when navigating away by user action — handled by parent on link click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="font-display text-xl">
            {store ? `Seu pedido • ${store.name}` : "Seu carrinho"}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingBag className="h-9 w-9 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">Carrinho vazio</h3>
            <p className="text-sm text-muted-foreground">
              Escolha uma loja e adicione itens deliciosos.
            </p>
          </div>
        ) : (
          <>
            {/* Free shipping progress */}
            <div className="border-b bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-success" />
                {remaining > 0 ? (
                  <span>
                    Faltam{" "}
                    <strong className="text-secondary">
                      R$ {remaining.toFixed(2).replace(".", ",")}
                    </strong>{" "}
                    para frete grátis!
                  </span>
                ) : (
                  <span className="font-semibold text-success">🎉 Você ganhou frete grátis!</span>
                )}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full gradient-primary transition-smooth"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.lineId} className="flex gap-3 rounded-xl bg-card p-2 shadow-soft">
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <h4 className="font-semibold leading-tight">{item.product.name}</h4>
                      {item.customizations.length > 0 && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {item.customizations
                            .flatMap((c) => c.selections.map((s) => s.name))
                            .join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs italic text-muted-foreground">Obs: {item.notes}</p>
                      )}
                      <p className="text-sm font-bold text-primary">
                        R$ {(item.unitPrice * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full border bg-background p-0.5">
                          <button
                            onClick={() => updateQty(item.lineId, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.lineId, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => remove(item.lineId)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t bg-card p-5">
              <div className="space-y-1.5 pb-4 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Entrega estimada</span>
                  <span className={finalFee === 0 ? "font-semibold text-success" : ""}>
                    {finalFee === 0 ? "Grátis" : `R$ ${finalFee.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
                <div className="flex justify-between pt-2 font-display text-lg font-bold">
                  <span>Total estimado</span>
                  <span>R$ {(subtotal + finalFee).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
              <Button
                asChild
                size="lg"
                className="h-14 w-full gap-2 rounded-xl gradient-primary text-base font-bold shadow-glow transition-bounce hover:scale-[1.02]"
              >
                <Link to="/checkout" onClick={() => setOpen(false)}>
                  Ir para o checkout
                </Link>
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Cupons, cashback e Pix na próxima etapa
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
