-- ============ CARRINHO ABANDONADO ============
CREATE TABLE public.abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimated_total NUMERIC NOT NULL DEFAULT 0,
  notified_at TIMESTAMPTZ,
  recovered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

CREATE INDEX idx_abandoned_carts_user ON public.abandoned_carts(user_id);
CREATE INDEX idx_abandoned_carts_store_pending ON public.abandoned_carts(store_id, updated_at)
  WHERE notified_at IS NULL AND recovered_at IS NULL;

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cart"
ON public.abandoned_carts FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Store team views abandoned carts"
ON public.abandoned_carts FOR SELECT
TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.can_access_section(store_id, auth.uid(), 'customers')
);

CREATE TRIGGER trg_abandoned_carts_updated
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ENTREGADORES ============
CREATE TABLE public.couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_type TEXT NOT NULL DEFAULT 'motorcycle',
  vehicle_plate TEXT,
  photo_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, user_id)
);

CREATE INDEX idx_couriers_store ON public.couriers(store_id) WHERE active = true;
CREATE INDEX idx_couriers_user ON public.couriers(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team manages couriers"
ON public.couriers FOR ALL
TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.can_access_section(store_id, auth.uid(), 'team')
)
WITH CHECK (
  public.is_store_owner(store_id, auth.uid())
  OR public.can_access_section(store_id, auth.uid(), 'team')
);

CREATE POLICY "Courier views own record"
ON public.couriers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Courier updates own online status"
ON public.couriers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_couriers_updated
  BEFORE UPDATE ON public.couriers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Coluna courier_id em orders ANTES das policies que dependem dela
ALTER TABLE public.orders ADD COLUMN courier_id UUID REFERENCES public.couriers(id) ON DELETE SET NULL;
CREATE INDEX idx_orders_courier ON public.orders(courier_id) WHERE courier_id IS NOT NULL;

-- Localização em tempo real
CREATE TABLE public.courier_locations (
  courier_id UUID PRIMARY KEY REFERENCES public.couriers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  accuracy NUMERIC,
  heading NUMERIC,
  speed NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Courier upserts own location"
ON public.courier_locations FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.couriers c
          WHERE c.id = courier_locations.courier_id AND c.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.couriers c
          WHERE c.id = courier_locations.courier_id AND c.user_id = auth.uid())
);

CREATE POLICY "Store team views locations"
ON public.courier_locations FOR SELECT
TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.can_access_section(store_id, auth.uid(), 'orders')
);

CREATE POLICY "Customer views courier location for active order"
ON public.courier_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid()
      AND o.status = 'out_for_delivery'
      AND o.courier_id = courier_locations.courier_id
  )
);

-- Entregador vê e atualiza pedidos atribuídos a ele
CREATE POLICY "Courier views assigned orders"
ON public.orders FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.couriers c
          WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
);

CREATE POLICY "Courier updates assigned orders"
ON public.orders FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.couriers c
          WHERE c.id = orders.courier_id AND c.user_id = auth.uid())
);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.couriers;