import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Clock, MapPin, Phone, Instagram, Globe, CreditCard, FileText, Bike } from "lucide-react";
import { formatHoursList, isStoreOpen, nextOpeningLabel } from "@/lib/storeHours";
import type { Store } from "@/data/stores";

const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  pix_online: "Pix (online)",
  pix_delivery: "Pix (na entrega)",
  credit_online: "Cartão de crédito (online)",
  credit: "Cartão de crédito (maquininha)",
  credit_link: "Cartão (link de pagamento)",
  debit: "Cartão de débito (maquininha)",
  debit_delivery: "Cartão de débito (na entrega)",
  cash: "Dinheiro",
  cash_delivery: "Dinheiro (na entrega)",
  crypto: "Criptomoedas (BTC, ETH, USDC, USDT)",
};

const formatCnpj = (v?: string) => {
  if (!v) return "";
  const d = v.replace(/\D/g, "").padStart(14, "0").slice(-14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

export const StoreInfoDialog = ({
  store,
  open,
  onOpenChange,
}: {
  store: Store;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: methods } = useQuery({
    queryKey: ["store-payment-methods", store.id],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("store_payment_methods")
        .select("method, enabled")
        .eq("store_id", store.id)
        .eq("enabled", true);
      return data ?? [];
    },
  });

  const addressLine = [
    store.addressStreet,
    store.addressNumber,
    store.addressComplement,
  ]
    .filter(Boolean)
    .join(", ");
  const cityLine = [store.addressNeighborhood, store.city, store.addressState]
    .filter(Boolean)
    .join(" - ");
  const openNow = store.open && isStoreOpen(store.openingHours);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{store.name}</DialogTitle>
          {store.shortDescription || store.tagline ? (
            <p className="text-sm text-muted-foreground">
              {store.shortDescription || store.tagline}
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-5">
          {/* Status + avaliação */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                openNow ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${openNow ? "animate-pulse bg-success" : "bg-destructive"}`} />
              {openNow ? "Aberto agora" : "Fechado"}
            </span>
            <span className="flex items-center gap-1 font-semibold">
              <Star className="h-4 w-4 fill-accent text-accent" /> {store.rating}
              <span className="ml-1 font-normal text-muted-foreground">({store.reviews} avaliações)</span>
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Bike className="h-4 w-4" />
              {store.deliveryFee === 0 ? "Entrega grátis" : `Entrega R$ ${store.deliveryFee.toFixed(2).replace(".", ",")}`}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" /> {store.deliveryTime}
            </span>
          </div>

          {/* Horários */}
          <section>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
              <Clock className="h-4 w-4" /> Horários de funcionamento
            </h3>
            <ul className="space-y-1 text-sm">
              {formatHoursList(store.openingHours).map((h) => (
                <li key={h.day} className="flex justify-between">
                  <span className="font-medium">{h.day}</span>
                  <span className="text-muted-foreground">{h.range}</span>
                </li>
              ))}
            </ul>
            {!openNow && store.open ? (
              <p className="mt-2 rounded-md bg-muted p-2 text-xs font-bold">
                {nextOpeningLabel(store.openingHours)}
              </p>
            ) : null}
          </section>

          {/* Endereço */}
          {(addressLine || cityLine || store.city) && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                <MapPin className="h-4 w-4" /> Endereço
              </h3>
              <div className="space-y-0.5 text-sm">
                {addressLine && <p>{addressLine}</p>}
                {cityLine && <p className="text-muted-foreground">{cityLine}</p>}
                {!cityLine && store.city && <p className="text-muted-foreground">{store.city}</p>}
                {store.addressCep && (
                  <p className="text-muted-foreground">CEP: {store.addressCep}</p>
                )}
              </div>
            </section>
          )}

          {/* Pagamentos */}
          {methods && methods.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                <CreditCard className="h-4 w-4" /> Formas de pagamento
              </h3>
              <div className="flex flex-wrap gap-2">
                {methods.map((m: any) => (
                  <span
                    key={m.method}
                    className="rounded-full bg-muted px-3 py-1 text-xs font-semibold"
                  >
                    {METHOD_LABELS[m.method] ?? m.method}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Contato */}
          {(store.phone || store.whatsappPhone || store.instagram || store.website) && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                <Phone className="h-4 w-4" /> Contato
              </h3>
              <div className="space-y-1 text-sm">
                {(store.phone || store.whatsappPhone) && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    {store.phone || store.whatsappPhone}
                  </p>
                )}
                {store.instagram && (
                  <p className="flex items-center gap-2">
                    <Instagram className="h-3.5 w-3.5 text-muted-foreground" />
                    @{store.instagram.replace(/^@/, "")}
                  </p>
                )}
                {store.website && (
                  <p className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                    <a
                      href={store.website.startsWith("http") ? store.website : `https://${store.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {store.website}
                    </a>
                  </p>
                )}
              </div>
            </section>
          )}

          {/* CNPJ */}
          {store.cnpj && (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-muted-foreground">
                <FileText className="h-4 w-4" /> Dados da empresa
              </h3>
              <p className="text-sm">CNPJ: {formatCnpj(store.cnpj)}</p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
