
-- 1) Garante plano PRO e trial
INSERT INTO public.subscription_plans (name, slug, price_monthly, trial_days, features, sort_order, active)
VALUES ('Trial', 'trial', 0, 7, '["7 dias grátis"]'::jsonb, 0, true)
ON CONFLICT (slug) DO UPDATE SET trial_days = 7, price_monthly = 0, active = true;

INSERT INTO public.subscription_plans (name, slug, price_monthly, trial_days, features, sort_order, active)
VALUES ('Pro', 'pro', 150.00, 0,
  '["Loja ilimitada","Pedidos ilimitados","PDV e mesas","Marketing e fidelidade","Suporte prioritário"]'::jsonb,
  1, true)
ON CONFLICT (slug) DO UPDATE SET price_monthly = 150.00, active = true;

-- 2) Tabela de pagamentos da assinatura (cobranças Asaas)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.store_subscriptions(id) ON DELETE SET NULL,
  gateway text NOT NULL DEFAULT 'asaas',
  external_id text,
  external_subscription_id text,
  amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  billing_type text,
  due_date date,
  paid_at timestamptz,
  invoice_url text,
  pix_qr_code text,
  pix_payload text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_store ON public.subscription_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_external ON public.subscription_payments(external_id);

GRANT SELECT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners see their subscription payments" ON public.subscription_payments;
CREATE POLICY "owners see their subscription payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

DROP POLICY IF EXISTS "super admin manages subscription payments" ON public.subscription_payments;
CREATE POLICY "super admin manages subscription payments"
  ON public.subscription_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

DROP TRIGGER IF EXISTS tg_subscription_payments_updated_at ON public.subscription_payments;
CREATE TRIGGER tg_subscription_payments_updated_at
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Estado consolidado da assinatura para o painel
CREATE OR REPLACE FUNCTION public.store_subscription_state(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub record;
  _is_allowed boolean;
  _trial_left integer;
  _active boolean := false;
  _state text := 'expired';
BEGIN
  SELECT (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
    INTO _is_allowed FROM public.stores s WHERE s.id = _store_id;
  IF NOT COALESCE(_is_allowed,false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ss.*, sp.slug AS plan_slug, sp.name AS plan_name, sp.price_monthly AS plan_price
    INTO _sub
    FROM public.store_subscriptions ss
    LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id
   WHERE ss.store_id = _store_id;

  IF _sub IS NULL THEN
    RETURN jsonb_build_object('state','none','active',false);
  END IF;

  IF _sub.status::text = 'active' AND (_sub.current_period_end IS NULL OR _sub.current_period_end > now()) THEN
    _active := true; _state := 'active';
  ELSIF _sub.status::text = 'trial' AND _sub.trial_ends_at IS NOT NULL AND _sub.trial_ends_at > now() THEN
    _active := true; _state := 'trial';
  ELSE
    _state := 'expired';
  END IF;

  _trial_left := CASE
    WHEN _sub.trial_ends_at IS NULL THEN 0
    ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_sub.trial_ends_at - now())) / 86400)::int)
  END;

  RETURN jsonb_build_object(
    'state', _state,
    'active', _active,
    'status', _sub.status,
    'plan_slug', _sub.plan_slug,
    'plan_name', _sub.plan_name,
    'plan_price', _sub.plan_price,
    'trial_ends_at', _sub.trial_ends_at,
    'trial_days_left', _trial_left,
    'current_period_end', _sub.current_period_end,
    'gateway_subscription_id', _sub.gateway_subscription_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.store_subscription_state(uuid) TO authenticated, service_role;
