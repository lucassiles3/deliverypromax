-- =========================================================
-- 6.1 CUPONS — expansão
-- =========================================================
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_limit INTEGER,
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS category_ids UUID[] DEFAULT NULL;

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_visibility_check;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_visibility_check
  CHECK (visibility IN ('public','private','vip'));

-- Garante código único por loja
CREATE UNIQUE INDEX IF NOT EXISTS coupons_store_code_key
  ON public.coupons (store_id, code);

-- =========================================================
-- Tabela: coupon_redemptions
-- =========================================================
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_phone TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON public.coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx
  ON public.coupon_redemptions(user_id);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Owner views coupon redemptions"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.coupons c
  LEFT JOIN public.stores s ON s.id = c.store_id
  WHERE c.id = coupon_redemptions.coupon_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
));

DROP POLICY IF EXISTS "Customer views own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Customer views own redemptions"
ON public.coupon_redemptions FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Customer creates own redemptions" ON public.coupon_redemptions;
CREATE POLICY "Customer creates own redemptions"
ON public.coupon_redemptions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 6.2 COMBOS
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_combo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_from TIME,
  ADD COLUMN IF NOT EXISTS available_to TIME;

CREATE TABLE IF NOT EXISTS public.combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  position INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS combo_items_combo_idx ON public.combo_items(combo_id);

ALTER TABLE public.combo_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Combo items public read" ON public.combo_items;
CREATE POLICY "Combo items public read"
ON public.combo_items FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "Owner manages combo items" ON public.combo_items;
CREATE POLICY "Owner manages combo items"
ON public.combo_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = combo_items.combo_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = combo_items.combo_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
));

-- =========================================================
-- 6.3 PROMO RELÂMPAGO — flag em products
-- =========================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS flash_promo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_discount_percent NUMERIC;

-- =========================================================
-- 6.4 CAMPANHAS DE REATIVAÇÃO
-- =========================================================
CREATE TABLE IF NOT EXISTS public.reactivation_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  inactive_days INTEGER NOT NULL DEFAULT 14,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 10,
  coupon_validity_days INTEGER NOT NULL DEFAULT 7,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reactivation_discount_type_check CHECK (discount_type IN ('percent','fixed'))
);

ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages reactivation campaigns" ON public.reactivation_campaigns;
CREATE POLICY "Owner manages reactivation campaigns"
ON public.reactivation_campaigns FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = reactivation_campaigns.store_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = reactivation_campaigns.store_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
));

CREATE TRIGGER update_reactivation_campaigns_updated_at
BEFORE UPDATE ON public.reactivation_campaigns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cupons gerados por execução de campanha
CREATE TABLE IF NOT EXISTS public.reactivation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.reactivation_campaigns(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  customer_phone TEXT,
  customer_name TEXT,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_code TEXT NOT NULL,
  redeemed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reactivation_runs_campaign_idx ON public.reactivation_runs(campaign_id);
CREATE INDEX IF NOT EXISTS reactivation_runs_store_idx ON public.reactivation_runs(store_id);

ALTER TABLE public.reactivation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages reactivation runs" ON public.reactivation_runs;
CREATE POLICY "Owner manages reactivation runs"
ON public.reactivation_runs FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = reactivation_runs.store_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.stores s
  WHERE s.id = reactivation_runs.store_id
    AND ((s.owner_id = auth.uid()) OR public.has_role(auth.uid(),'admin'))
));

-- =========================================================
-- Função: gerar cupons de reativação
-- =========================================================
CREATE OR REPLACE FUNCTION public.run_reactivation_campaign(_campaign_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _camp RECORD;
  _is_owner BOOLEAN;
  _row RECORD;
  _code TEXT;
  _coupon_id UUID;
  _created INTEGER := 0;
BEGIN
  SELECT * INTO _camp FROM public.reactivation_campaigns WHERE id = _campaign_id;
  IF _camp IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  SELECT (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    INTO _is_owner
  FROM public.stores s WHERE s.id = _camp.store_id;
  IF NOT COALESCE(_is_owner,false) THEN RAISE EXCEPTION 'forbidden'; END IF;

  FOR _row IN
    SELECT
      o.user_id,
      o.customer_phone,
      MAX(o.customer_name) AS customer_name,
      MAX(o.created_at) AS last_order
    FROM public.orders o
    WHERE o.store_id = _camp.store_id
      AND o.status = 'delivered'
    GROUP BY o.user_id, o.customer_phone
    HAVING MAX(o.created_at) < (now() - (_camp.inactive_days || ' days')::interval)
  LOOP
    -- não recriar se já temos um run ativo (não resgatado e cupom ainda válido) p/ esse contato
    IF EXISTS (
      SELECT 1 FROM public.reactivation_runs r
      JOIN public.coupons c ON c.id = r.coupon_id
      WHERE r.campaign_id = _campaign_id
        AND r.redeemed = false
        AND c.expires_at > now()
        AND ( (_row.user_id IS NOT NULL AND r.user_id = _row.user_id)
              OR (_row.customer_phone IS NOT NULL AND r.customer_phone = _row.customer_phone) )
    ) THEN
      CONTINUE;
    END IF;

    _code := 'VOLTA-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6));

    INSERT INTO public.coupons (
      store_id, code, label, type, value, min_order,
      starts_at, expires_at, active, visibility, per_user_limit, usage_limit
    ) VALUES (
      _camp.store_id, _code, 'Volta logo!',
      CASE WHEN _camp.discount_type='percent' THEN 'percent'::coupon_type ELSE 'fixed'::coupon_type END,
      _camp.discount_value, NULL,
      now(), now() + (_camp.coupon_validity_days || ' days')::interval,
      true, 'private', 1, 1
    )
    RETURNING id INTO _coupon_id;

    INSERT INTO public.reactivation_runs (
      campaign_id, store_id, user_id, customer_phone, customer_name, coupon_id, coupon_code
    ) VALUES (
      _campaign_id, _camp.store_id, _row.user_id, _row.customer_phone, _row.customer_name, _coupon_id, _code
    );

    _created := _created + 1;
  END LOOP;

  RETURN _created;
END;
$$;