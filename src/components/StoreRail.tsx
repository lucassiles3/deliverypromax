import { ReactNode } from "react";
import type { Store } from "@/data/stores";
import { StoreCard } from "@/components/StoreCard";

export const StoreRail = ({
  title,
  subtitle,
  icon,
  stores,
  emptyHint,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  stores: Store[];
  emptyHint?: string;
}) => {
  if (stores.length === 0) {
    if (!emptyHint) return null;
    return (
      <section className="mb-8">
        <Header title={title} subtitle={subtitle} icon={icon} />
        <div className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          {emptyHint}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <Header title={title} subtitle={subtitle} icon={icon} />
      <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
        {stores.map((s, i) => (
          <div
            key={s.id}
            className="w-[78%] shrink-0 snap-start sm:w-[44%] md:w-[32%] lg:w-[24%]"
          >
            <StoreCard store={s} index={i} />
          </div>
        ))}
      </div>
    </section>
  );
};

const Header = ({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) => (
  <div className="mb-3 flex items-end justify-between">
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <h2 className="font-display text-xl font-bold md:text-2xl">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  </div>
);
