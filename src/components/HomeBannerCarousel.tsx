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

  if (isLoading || banners.length === 0) return null;

  return (
    <section className={`my-4 ${className}`}>
      <Carousel setApi={setApi} opts={{ loop: true, align: "start" }}>
        <CarouselContent>
          {banners.map((b) => {
            const img = (
              <img
                src={b.image_url}
                alt={b.title ?? "Banner"}
                loading="lazy"
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
