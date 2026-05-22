import { Link } from "react-router-dom";
import { Clock, Bike, MapPin, CheckCircle2, AlertCircle, Star } from "lucide-react";
import type { Store } from "@/data/stores";
import { formatDistance } from "@/lib/distance";
import { LazyImage } from "./LazyImage";

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
        className={`relative overflow-hidden rounded-2xl border p-4 shadow-card transition-smooth hover:-translate-y-1 hover:border-primary/40 hover:shadow-float ${
          isClosed
            ? "border-border/60 bg-muted/40 opacity-70"
            : "border-border bg-card"
        }`}
      >
        {isExternal && (
          <span className="absolute right-3 top-3 z-10 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
            Parceiro
          </span>
        )}
        {isClosed && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Fechado
          </span>
        )}
        {/* Top row: logo + name */}
        <div className="flex items-start gap-3">
          {isImageUrl(store.logo) ? (
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-glow ${isClosed ? "border-border/60 bg-muted" : "border-border bg-card"}`}>
              <LazyImage
                src={store.logo}
                alt={store.name}
                className="h-full w-full object-cover"
                fallback="/placeholder.svg"
              />
            </div>
          ) : (
            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl shadow-glow ${isClosed ? "bg-muted text-muted-foreground" : "gradient-primary text-primary-foreground"}`}>
              {store.logo}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className={`truncate font-display text-lg font-bold leading-tight ${isClosed ? "text-muted-foreground" : ""}`}>{store.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{store.cuisine}</p>
            <div className="mt-1 flex items-center gap-1 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              {store.rating}
              <span className="font-normal text-muted-foreground">({store.reviews})</span>
            </div>
          </div>
        </div>

        {/* Tagline / promo */}
        {tagline && (
          <p className="mt-3 line-clamp-2 text-xs text-foreground/80">✨ {tagline}</p>
        )}
        {store.promo && !isClosed && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full gradient-promo px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-glow">
            🔥 {store.promo}
          </div>
        )}

        {/* Bottom row: meta */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {store.deliveryTime}
          </div>
          {distanceKm !== null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {formatDistance(distanceKm)}
            </div>
          )}
          {(!isExternal || (store.deliveryFee !== null && store.deliveryFee !== undefined)) && (
            <span className="ml-auto flex items-center gap-1 font-bold text-success">
              <Bike className="h-3.5 w-3.5" />
              {store.deliveryFee === 0 ? (
                "Grátis"
              ) : (
                <>
                  {isExternal && (
                    <span className="text-[10px] font-semibold text-muted-foreground">a partir de</span>
                  )}
                  R${Number(store.deliveryFee).toFixed(2)}
                </>
              )}
            </span>
          )}
        </div>

        {showRangeBadge && (
          <div className="mt-2">
            {inRange ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                <CheckCircle2 className="h-3 w-3" /> Entrega no raio
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                <AlertCircle className="h-3 w-3" /> Fora do raio
              </span>
            )}
          </div>
        )}
      </article>
    </Wrapper>
  );

};
