import { Link } from "react-router-dom";
import type { Store } from "@/data/stores";
import { LazyImage } from "./LazyImage";
import { trackListingVisit } from "@/lib/trackListingVisit";

function isImageUrl(str: string): boolean {
  return /^https?:\/\//i.test(str) || /\.(png|jpe?g|webp|svg|gif|bmp)(\?.*)?$/i.test(str);
}

type Props = {
  title: string;
  subtitle?: string;
  stores: (Store & { _open?: boolean })[];
};

export const StoreLogoRail = ({ title, subtitle, stores }: Props) => {
  if (stores.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-display text-lg font-bold md:text-xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="scrollbar-hide flex gap-3 overflow-x-auto pb-1">
        {stores.map((s) => {
          const externalUrl = (s as any)._externalUrl as string | undefined;
          const isExternal = !!externalUrl;
          const logo = s.logo || "🏪";
          const showImage = typeof logo === "string" && isImageUrl(logo);

          const inner = (
            <>
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-card transition-smooth group-hover:-translate-y-0.5 group-hover:border-primary/60 group-hover:shadow-glow">
                {showImage ? (
                  <LazyImage
                    src={logo}
                    alt={s.name}
                    className="h-full w-full object-cover"
                    fallback="/placeholder.svg"
                  />
                ) : (
                  <span className="text-2xl">{logo}</span>
                )}
              </div>
              <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground/80 group-hover:text-foreground">
                {s.name}
              </span>
            </>
          );

          if (isExternal) {
            const listingId = String(s.id).replace(/^ext_/, "");
            return (
              <a
                key={s.id}
                href={externalUrl}
                onClick={(e) => {
                  e.preventDefault();
                  trackListingVisit(listingId);
                  window.location.href = externalUrl!;
                }}
                title={s.name}
                className="group flex w-20 shrink-0 flex-col items-center gap-1.5"
              >
                {inner}
              </a>
            );
          }
          return (
            <Link
              key={s.id}
              to={`/loja/${s.slug}`}
              title={s.name}
              className="group flex w-20 shrink-0 flex-col items-center gap-1.5"
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
};
