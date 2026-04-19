-- Loyalty config per store
CREATE TABLE public.store_loyalty_config (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  points_per_real NUMERIC NOT NULL DEFAULT 1,
  redeem_points INTEGER NOT NULL DEFAULT 100,
  redeem_value NUMERIC NOT NULL DEFAULT 5,
  validity_days INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loyalty config public read" ON public.store_loyalty_config
  FOR SELECT TO public USING (true);

CREATE POLICY "Owner manages loyalty config" ON public.store_loyalty_config
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_loyalty_config.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_loyalty_config.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TRIGGER trg_loyalty_config_updated_at
  BEFORE UPDATE ON public.store_loyalty_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Loyalty points ledger (earn / redeem)
CREATE TABLE public.loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_points_store_user ON public.loyalty_points(store_id, user_id);
CREATE INDEX idx_loyalty_points_expires ON public.loyalty_points(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer views own points" ON public.loyalty_points
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Owner views store points" ON public.loyalty_points
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = loyalty_points.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE POLICY "Owner inserts store points" ON public.loyalty_points
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = loyalty_points.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Blocked customers per store
CREATE TABLE public.blocked_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  phone TEXT,
  reason TEXT,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blocked_by UUID,
  CONSTRAINT blocked_target CHECK (user_id IS NOT NULL OR phone IS NOT NULL)
);

CREATE UNIQUE INDEX uniq_blocked_user ON public.blocked_customers(store_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uniq_blocked_phone ON public.blocked_customers(store_id, phone) WHERE phone IS NOT NULL;

ALTER TABLE public.blocked_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages blocked customers" ON public.blocked_customers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = blocked_customers.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = blocked_customers.store_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- Trigger: prevent blocked customers from placing new orders
CREATE OR REPLACE FUNCTION public.prevent_blocked_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.blocked_customers b
    WHERE b.store_id = NEW.store_id
      AND ((NEW.user_id IS NOT NULL AND b.user_id = NEW.user_id)
           OR (NEW.customer_phone IS NOT NULL AND b.phone = NEW.customer_phone))
  ) THEN
    RAISE EXCEPTION 'Cliente bloqueado por esta loja' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_blocked_order
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_blocked_order();

-- Function: available points for a customer in a store (respects expiry)
CREATE OR REPLACE FUNCTION public.customer_points_balance(_store_id UUID, _user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::INTEGER
  FROM public.loyalty_points
  WHERE store_id = _store_id
    AND user_id = _user_id
    AND (expires_at IS NULL OR expires_at > now());
$$;