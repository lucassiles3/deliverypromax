-- Add marketplace fee column to stores (default 10%)
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS marketplace_fee_percent NUMERIC NOT NULL DEFAULT 10;

-- Payouts table
CREATE TYPE public.payout_status AS ENUM ('scheduled', 'processing', 'paid');

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  status public.payout_status NOT NULL DEFAULT 'scheduled',
  scheduled_for DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, period_start, period_end)
);

CREATE TABLE public.payout_orders (
  payout_id UUID NOT NULL REFERENCES public.payouts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  PRIMARY KEY (payout_id, order_id)
);

CREATE INDEX idx_payouts_store ON public.payouts(store_id, period_end DESC);
CREATE INDEX idx_payout_orders_order ON public.payout_orders(order_id);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views payouts" ON public.payouts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = payouts.store_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

CREATE POLICY "Owner manages payouts" ON public.payouts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = payouts.store_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = payouts.store_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

CREATE POLICY "Owner views payout orders" ON public.payout_orders
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payouts p JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = payout_orders.payout_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

CREATE POLICY "Owner manages payout orders" ON public.payout_orders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.payouts p JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = payout_orders.payout_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.payouts p JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = payout_orders.payout_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  );

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to (re)generate weekly payouts for a store from delivered orders not yet in any payout
CREATE OR REPLACE FUNCTION public.generate_weekly_payouts(_store_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fee_pct NUMERIC;
  _created INTEGER := 0;
  _row RECORD;
  _payout_id UUID;
  _is_owner BOOLEAN;
BEGIN
  SELECT (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')), COALESCE(marketplace_fee_percent,10)
    INTO _is_owner, _fee_pct
  FROM public.stores WHERE id = _store_id;
  IF NOT COALESCE(_is_owner,false) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _row IN
    SELECT
      date_trunc('week', o.created_at)::date AS p_start,
      (date_trunc('week', o.created_at) + interval '6 days')::date AS p_end,
      SUM(o.total) AS gross,
      COUNT(*) AS cnt
    FROM public.orders o
    LEFT JOIN public.payout_orders po ON po.order_id = o.id
    WHERE o.store_id = _store_id
      AND o.status = 'delivered'
      AND po.order_id IS NULL
      AND o.created_at < date_trunc('week', now())
    GROUP BY 1,2
  LOOP
    INSERT INTO public.payouts (store_id, period_start, period_end, gross_amount, fee_amount, net_amount, orders_count, scheduled_for, status)
    VALUES (
      _store_id, _row.p_start, _row.p_end,
      _row.gross,
      ROUND(_row.gross * _fee_pct / 100, 2),
      ROUND(_row.gross * (100 - _fee_pct) / 100, 2),
      _row.cnt,
      _row.p_end + 2,
      'scheduled'
    )
    ON CONFLICT (store_id, period_start, period_end) DO UPDATE
      SET gross_amount = EXCLUDED.gross_amount,
          fee_amount = EXCLUDED.fee_amount,
          net_amount = EXCLUDED.net_amount,
          orders_count = EXCLUDED.orders_count
    RETURNING id INTO _payout_id;

    INSERT INTO public.payout_orders (payout_id, order_id)
    SELECT _payout_id, o.id
    FROM public.orders o
    LEFT JOIN public.payout_orders po ON po.order_id = o.id
    WHERE o.store_id = _store_id
      AND o.status = 'delivered'
      AND po.order_id IS NULL
      AND date_trunc('week', o.created_at)::date = _row.p_start;

    _created := _created + 1;
  END LOOP;

  RETURN _created;
END;
$$;