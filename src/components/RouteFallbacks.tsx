/**
 * Fallbacks de Suspense específicos por contexto de rota.
 * Em vez de um spinner genérico, mostramos um "esqueleto" parecido
 * com a tela final — sensação de carregamento muito mais rápida.
 */

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-2xl bg-muted ${className}`} />
);

export const StoreFallback = () => (
  <div className="min-h-screen pb-24">
    <SkeletonBlock className="h-48 w-full rounded-none md:h-64" />
    <div className="container -mt-10 space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-20 w-20 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock className="h-5 w-2/3" />
          <SkeletonBlock className="h-4 w-1/3" />
        </div>
      </div>
      <SkeletonBlock className="h-10 w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-28 w-full" />
      ))}
    </div>
  </div>
);

export const CheckoutFallback = () => (
  <div className="min-h-screen pb-24">
    <div className="container space-y-4 pt-6">
      <SkeletonBlock className="h-8 w-40" />
      <SkeletonBlock className="h-32 w-full" />
      <SkeletonBlock className="h-48 w-full" />
      <SkeletonBlock className="h-24 w-full" />
      <SkeletonBlock className="h-12 w-full" />
    </div>
  </div>
);

export const AccountFallback = () => (
  <div className="min-h-screen pb-24">
    <div className="container space-y-3 pt-6">
      <SkeletonBlock className="h-7 w-48" />
      <SkeletonBlock className="h-20 w-full" />
      <SkeletonBlock className="h-20 w-full" />
      <SkeletonBlock className="h-20 w-full" />
    </div>
  </div>
);

export const PageFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
  </div>
);
