import { Link } from "react-router-dom";
import { Clock, Bike, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import type { Store } from "@/data/stores";
import { formatDistance } from "@/lib/distance";

type Props = {
  store: Store;
  index?: number;
  /** Distância (km) entre usuário e loja, quando disponível. */
  distanceKm?: number | null;
  /** Se a loja atende o usuário (dentro do raio). undefined = sem dados de localização. */
  inRange?: boolean;
};

export const StoreCard = ({ store, index = 0, distanceKm = null, inRange }: Props) => {
  const tagline = (store as any).tagline as string | undefined;
  const showRangeBadge = typeof inRange === "boolean" && distanceKm !== null;

  return (
    <Link
      to={`/loja/${store.slug}`}
      className="group block animate-float-in"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <article className="overflow-hidden rounded-2xl bg-card shadow-card transition-smooth hover:-translate-y-1 hover:shadow-float">
        <div className="relative aspect-[16/10] overflow-hidden">
          <img
            src={store.cover}
            alt={store.name}
            loading="lazy"
            width={800}
            height={500}
            className="h-full w-full object-cover transition-bounce group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
          {store.promo && (
            <div className="absolute left-3 top-3 rounded-full gradient-promo px-3 py-1 text-xs font-bold text-primary-foreground shadow-glow">
              🔥 {store.promo}
            </div>
          )}
          {tagline && (
            <div className="absolute right-3 top-3 max-w-[60%] truncate rounded-full bg-background/90 px-3 py-1 text-[11px] font-bold text-foreground shadow-card backdrop-blur">
              ✨ {tagline}
            </div>
          )}
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background text-2xl shadow-card">
              {store.logo}
            </div>
            <div className="text-primary-foreground">
              <h3 className="font-display text-lg font-bold leading-tight">{store.name}</h3>
              <p className="text-xs opacity-90">{store.cuisine}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {store.deliveryTime}
          </div>
          {distanceKm !== null && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {formatDistance(distanceKm)}
            </div>
          )}
          <span className="ml-auto flex items-center gap-1 font-medium text-success">
            <Bike className="h-3.5 w-3.5" />
            {store.deliveryFee === 0 ? "Grátis" : `R$${store.deliveryFee.toFixed(2)}`}
          </span>
        </div>
        {showRangeBadge && (
          <div className="px-4 pb-3">
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
    </Link>
  );
};
