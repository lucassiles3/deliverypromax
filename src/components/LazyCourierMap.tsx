import { lazy, Suspense, type ComponentProps } from "react";

/**
 * Wrapper lazy do CourierMap.
 *
 * O CourierMap importa o pacote `leaflet` (~150 KB gzip). Carregar via
 * React.lazy evita incluir leaflet no chunk inicial de páginas que apenas
 * podem mostrar o mapa condicionalmente (ex: /meus-pedidos/:id quando
 * o pedido está saindo para entrega).
 */
const CourierMapInner = lazy(() =>
  import("@/components/CourierMap").then((m) => ({ default: m.CourierMap })),
);

const MapFallback = () => (
  <div className="flex h-64 w-full items-center justify-center rounded-2xl bg-muted">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-primary" />
  </div>
);

export const LazyCourierMap = (props: ComponentProps<typeof CourierMapInner>) => (
  <Suspense fallback={<MapFallback />}>
    <CourierMapInner {...props} />
  </Suspense>
);
