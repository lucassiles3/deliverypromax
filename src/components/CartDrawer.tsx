import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, Truck, CheckCircle2 } from "lucide-react";
import { stores } from "@/data/stores";
import { toast } from "sonner";

export const CartDrawer = () => {
  const { items, isOpen, setOpen, updateQty, remove, total, clear, storeSlug } = useCart();
  const [confirmed, setConfirmed] = useState(false);

  const store = stores.find((s) => s.slug === storeSlug);
  const threshold = store?.freeShippingThreshold ?? 50;
  const fee = store?.deliveryFee ?? 0;
  const remaining = Math.max(0, threshold - total);
  const progress = Math.min(100, (total / threshold) * 100);
  const finalFee = total >= threshold ? 0 : fee;

  useEffect(() => {
    if (!isOpen) setConfirmed(false);
  }, [isOpen]);

  const checkout = () => {
    setConfirmed(true);
    toast.success("Pedido confirmado! 🎉", {
      description: "Você receberá atualizações no WhatsApp.",
    });
    setTimeout(() => {
      clear();
      setOpen(false);
    }, 2200);
  };

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
            <p className="text-sm text-muted-foreground">Escolha uma loja e adicione itens deliciosos.</p>
          </div>
        ) : confirmed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center animate-float-in">
            <CheckCircle2 className="h-20 w-20 text-success" strokeWidth={1.5} />
            <h3 className="font-display text-2xl font-bold">Pedido enviado!</h3>
            <p className="text-sm text-muted-foreground">
              Tempo estimado: <span className="font-semibold text-foreground">{store?.deliveryTime}</span>
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div className="border-b bg-muted/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-success" />
                {remaining > 0 ? (
                  <span>
                    Faltam <strong className="text-secondary">R$ {remaining.toFixed(2).replace(".", ",")}</strong> para frete grátis!
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
                  <li key={item.id} className="flex gap-3 rounded-xl bg-card p-2 shadow-soft">
                    <img
                      src={item.image}
                      alt={item.name}
                      width={80}
                      height={80}
                      className="h-20 w-20 rounded-lg object-cover"
                    />
                    <div className="flex flex-1 flex-col">
                      <h4 className="font-semibold leading-tight">{item.name}</h4>
                      <p className="text-sm font-bold text-primary">
                        R$ {(item.price * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-2 rounded-full border bg-background p-0.5">
                          <button
                            onClick={() => updateQty(item.id, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
                            aria-label="Diminuir"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                          <button
                            onClick={() => updateQty(item.id, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                            aria-label="Aumentar"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => remove(item.id)}
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
                  <span>R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Entrega</span>
                  <span className={finalFee === 0 ? "font-semibold text-success" : ""}>
                    {finalFee === 0 ? "Grátis" : `R$ ${finalFee.toFixed(2).replace(".", ",")}`}
                  </span>
                </div>
                <div className="flex justify-between pt-2 font-display text-lg font-bold">
                  <span>Total</span>
                  <span>R$ {(total + finalFee).toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
              <Button
                onClick={checkout}
                size="lg"
                className="h-14 w-full gap-2 rounded-xl gradient-primary text-base font-bold shadow-glow transition-bounce hover:scale-[1.02]"
              >
                Finalizar pedido • Pix
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Pagamento via Pix ou na entrega
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
