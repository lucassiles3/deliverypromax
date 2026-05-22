import { TrendingUp } from "lucide-react";
import { useTopVisitedListings } from "@/hooks/useTopVisitedListings";
import { trackListingVisit } from "@/lib/trackListingVisit";
import { LazyImage } from "./LazyImage";

function isImageUrl(str: string): boolean {
  return /^https?:\/\//i.test(str) || /\.(png|jpe?g|webp|svg|gif|bmp)(\?.*)?$/i.test(str);
}

export const TopVisitedRail = () => {
  const { data: items = [], isLoading } = useTopVisitedListings(30);

  if (isLoading || items.length === 0) return null;

  const handleClick = (id: string, url: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    trackListingVisit(id);
    window.location.href = url;
  };

  return (
    <section className="container pb-4">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-bold md:text-xl">
          Mais visitadas do mês
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          TOP {items.length}
        </span>
      </div>

      <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
        {items.map((it) => {
          const logo = it.logo || "🏪";
          const showImage = typeof logo === "string" && isImageUrl(logo);
          return (
            <a
              key={it.id}
              href={it.catalog_url}
              onClick={handleClick(it.id, it.catalog_url)}
              className="group flex w-20 shrink-0 flex-col items-center gap-1.5"
              title={it.name}
            >
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-card shadow-card transition-smooth group-hover:-translate-y-0.5 group-hover:border-primary/60 group-hover:shadow-glow">
                {showImage ? (
                  <LazyImage
                    src={logo}
                    alt={it.name}
                    className="h-full w-full object-cover"
                    fallback="/placeholder.svg"
                  />
                ) : (
                  <span className="text-2xl">{logo}</span>
                )}
              </div>
              <span className="line-clamp-2 text-center text-[11px] font-semibold leading-tight text-foreground/80 group-hover:text-foreground">
                {it.name}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
};
