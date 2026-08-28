import { useEffect, useRef } from "react";
import { Megaphone } from "lucide-react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Slot de anúncio reutilizável.
 *
 * Funciona em 2 modos:
 * 1. **AdSense ativo**: se `VITE_ADSENSE_CLIENT` estiver definido (ex: "ca-pub-1234567890")
 *    e a `slotId` for passada, renderiza o `<ins class="adsbygoogle">` e dispara o push().
 * 2. **Placeholder**: caixa com aviso "Espaço publicitário" — útil em dev e enquanto
 *    o AdSense não foi aprovado pelo Google.
 *
 * Variantes pensadas para layouts comuns do app:
 * - "leaderboard"  → faixa horizontal (home, listagens) — 728x90 / responsivo
 * - "rectangle"    → bloco médio (entre rails, dentro de listas) — 300x250
 * - "mobile"       → faixa fina mobile-first (entre cards) — 320x100
 * - "skyscraper"   → vertical (sidebars desktop) — 160x600
 */
export type AdVariant = "leaderboard" | "rectangle" | "mobile" | "skyscraper";

interface AdBannerProps {
  /** ID do slot configurado no AdSense (data-ad-slot). Se ausente, mostra placeholder. */
  slotId?: string;
  variant?: AdVariant;
  /** Texto exibido no placeholder para identificar o slot. */
  label?: string;
  className?: string;
}

const VARIANT_CLASSES: Record<AdVariant, string> = {
  leaderboard: "min-h-[90px] w-full",
  rectangle: "min-h-[250px] w-full max-w-[336px] mx-auto",
  mobile: "min-h-[100px] w-full",
  skyscraper: "min-h-[600px] w-[160px]",
};

const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;

export const AdBanner = ({
  slotId,
  variant = "leaderboard",
  label = "Espaço publicitário",
  className = "",
}: AdBannerProps) => {
  const insRef = useRef<HTMLModElement | null>(null);
  const adsenseEnabled = !!ADSENSE_CLIENT && !!slotId;

  useEffect(() => {
    if (!adsenseEnabled) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // silencioso — adsense indisponível ou bloqueado
    }
  }, [adsenseEnabled, slotId]);

  if (adsenseEnabled) {
    return (
      <div className={`my-4 ${VARIANT_CLASSES[variant]} ${className}`}>
        <ins
          ref={insRef}
          className="adsbygoogle block"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // Placeholder — aparece em dev e quando AdSense ainda não está configurado
  return (
    <div
      className={`my-4 flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-center ${VARIANT_CLASSES[variant]} ${className}`}
      aria-label={label}
      role="complementary"
    >
      <div className="flex flex-col items-center gap-1 text-muted-foreground">
        <Megaphone className="h-4 w-4" />
        <p className="text-[11px] font-bold uppercase tracking-wider">Anúncio</p>
        <p className="text-xs">{label}</p>
      </div>
    </div>
  );
};
