import { Link } from "react-router-dom";
import { Clock, AlertCircle, Star } from "lucide-react";
import type { Store } from "@/data/stores";
import { formatDistance } from "@/lib/distance";
import { LazyImage } from "./LazyImage";
import { FavoriteStoreButton, FavoriteListingButton } from "./FavoriteButton";

function isImageUrl(str: string): boolean {
  return /^https?:\/\//i.test(str) || /\.(png|jpe?g|webp|svg|gif|bmp)(\?.*)?$/i.test(str);
}


type Props = {
  store: Store;
  index?: number;
  distanceKm?: number | null;
  inRange?: boolean;
  isOpen?: boolean;
};

export const StoreCard = ({ store, index = 0, distanceKm = null, inRange, isOpen = true }: Props) => {
  const tagline = (store as any).tagline as string | undefined;
  const externalUrl = (store as any)._externalUrl as string | undefined;
  const isExternal = !!externalUrl;
  const showRangeBadge = typeof inRange === "boolean" && distanceKm !== null && !isExternal;
  const isClosed = isOpen === false;

  const Wrapper: any = isExternal ? "a" : Link;
  const wrapperProps: any = isExternal
    ? { href: externalUrl, rel: "noopener" }
    : { to: `/loja/${store.slug}` };

  return (
    <Wrapper
      {...wrapperProps}
      className="group block animate-float-in"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <article
        className={`relative overflow-hidden rounded-3xl bg-white p-4 text-card-foreground shadow-[0_10px_30px_-12px_rgba(60,40,120,0.45)] ring-1 ring-black/5 transition-bounce hover:-translate-y-1 hover:shadow-[0_18px_40px_-14px_rgba(60,40,120,0.55)] ${
          isClosed ? "opacity-70" : ""
        }`}
      >
        {/* Badges top-left */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1.5">
          {isClosed ? (
            <span className="rounded-full bg-foreground/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground backdrop-blur">
              Fechado
            </span>
          ) : store.deliveryFee === 0 ? (
            <span className="rounded-full bg-[hsl(195_100%_85%)] px-2.5 py-1 text-[10px] font-bold text-[hsl(220_70%_25%)]">
              Entrega grátis
            </span>
          ) : store.promo ? (
            <span className="rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
              {typeof store.promo === "string" ? store.promo : "Em promoção"}
            </span>
          ) : null}
        </div>

        {/* Heart top-right */}
        <div className="absolute right-3 top-3 z-10">
          {isExternal ? (
            <FavoriteListingButton listingId={String(store.id).replace(/^ext_/, "")} />
          ) : (
            <FavoriteStoreButton storeId={String(store.id)} />
          )}
        </div>

        {/* Logo + nome */}
        <div className="mt-7 flex items-start gap-3">
          {isImageUrl(store.logo) ? (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-1 ring-black/5">
              <LazyImage
                src={store.logo}
                alt={store.name}
                className="h-full w-full object-cover"
                fallback="/placeholder.svg"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-xl ring-1 ring-black/5">
              {store.logo}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-[15px] font-bold leading-tight text-card-foreground">
              {store.name}
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">{store.cuisine}</p>
            <div className="mt-1 flex items-center gap-1 text-[11px]">
              <Star className="h-3 w-3 fill-accent text-accent" />
              <span className="font-semibold text-card-foreground">{Number(store.rating ?? 5).toFixed(1)}</span>
              <span className="text-muted-foreground">({store.reviews ?? 0})</span>
            </div>
          </div>
        </div>

        {/* Bottom: tempo + frete */}
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-semibold text-card-foreground">{store.deliveryTime}</span>
          </span>
          <span className="text-muted-foreground/60">•</span>
          <span className="font-semibold text-card-foreground">
            {store.deliveryFee === 0
              ? "R$ 0,00"
              : `R$ ${Number(store.deliveryFee).toFixed(2).replace(".", ",")}`}
          </span>
        </div>

        {showRangeBadge && !inRange && (
          <div className="mt-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
              <AlertCircle className="h-3 w-3" /> Fora do raio
            </span>
          </div>
        )}
      </article>
    </Wrapper>
  );

};

