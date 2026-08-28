import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useHomeBanners } from "@/hooks/useHomeBanners";

interface Props {
  className?: string;
}

export const HomeBannerCarousel = ({ className = "" }: Props) => {
  const { data: banners = [], isLoading } = useHomeBanners();
  const [api, setApi] = useState<CarouselApi | null>(null);

  useEffect(() => {
    if (!api || banners.length <= 1) return;
    const id = setInterval(() => api.scrollNext(), 5000);
    return () => clearInterval(id);
  }, [api, banners.length]);

  // Reserva espaço enquanto carrega para evitar CLS (layout shift).
  if (isLoading) {
    return (
      <section className={`my-4 ${className}`} aria-busy="true">
        <div className="aspect-[16/6] w-full animate-pulse rounded-2xl bg-muted" />
      </section>
    );
  }
  if (banners.length === 0) return null;

  return (
    <section className={`my-4 ${className}`}>
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }}>
        <CarouselContent>
          {banners.map((b, idx) => {
            // O primeiro banner costuma ser o LCP da home: prioriza o download
            // e desativa lazy-loading; os demais continuam lazy.
            const isFirst = idx === 0;
            const img = (
              <img
                src={b.image_url}
                alt={b.title ?? "Banner"}
                width={1200}
                height={450}
                loading={isFirst ? "eager" : "lazy"}
                fetchPriority={isFirst ? "high" : "auto"}
                decoding={isFirst ? "sync" : "async"}
                className="aspect-[16/6] w-full rounded-2xl object-cover"
              />
            );
            return (
              <CarouselItem key={b.id}>
                {b.link_url ? (
                  <a
                    href={b.link_url}
                    target={b.link_url.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {img}
                  </a>
                ) : (
                  img
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </section>
  );
};
