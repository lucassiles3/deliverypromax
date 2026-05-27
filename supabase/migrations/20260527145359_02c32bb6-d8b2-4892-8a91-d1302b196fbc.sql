
-- 1) Plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'fixed_plus_per_order'
    CHECK (billing_model IN ('fixed_plus_per_order','commission','none')),
  ADD COLUMN IF NOT EXISTS per_order_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Seed/atualiza planos PRO
INSERT INTO public.subscription_plans (slug, name, price_monthly, trial_days, billing_model, per_order_fee, commission_percent, sort_order, features)
VALUES
  ('pro_fixed', 'Pro Fixo + Pedido', 150.00, 7, 'fixed_plus_per_order', 1.00, 0, 10,
    '["Mensalidade fixa R$150","R$1 por pedido","Sem comissão sobre vendas","Custo previsível"]'::jsonb),
  ('pro_commission', 'Pro Comissão', 0.00, 7, 'commission', 0, 10.00, 11,
    '["Sem mensalidade","10% por pedido","Fatura mensal automática","Sem custo fixo inicial"]'::jsonb)
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      price_monthly = EXCLUDED.price_monthly,
      billing_model = EXCLUDED.billing_model,
      per_order_fee = EXCLUDED.per_order_fee,
      commission_percent = EXCLUDED.commission_percent,
      features = EXCLUDED.features,
      sort_order = EXCLUDED.sort_order;

-- Mantém plano 'pro' antigo como alias do fixo
UPDATE public.subscription_plans
  SET billing_model='fixed_plus_per_order', per_order_fee=1.00, commission_percent=0
  WHERE slug='pro';

-- 2) Store subscriptions
ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS billing_model TEXT NOT NULL DEFAULT 'fixed_plus_per_order'
    CHECK (billing_model IN ('fixed_plus_per_order','commission','none')),
  ADD COLUMN IF NOT EXISTS per_order_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;

-- 3) Faturas mensais consolidadas
CREATE TABLE IF NOT EXISTS public.monthly_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.store_subscriptions(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  billing_model TEXT NOT NULL,
  base_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  per_order_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  gross_sales NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  extras_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','paid','overdue','cancelled')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  asaas_payment_id TEXT,
  invoice_url TEXT,
  pix_qr_code TEXT,
  pix_payload TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, period_start, period_end)
);

GRANT SELECT ON public.monthly_invoices TO authenticated;
GRANT ALL ON public.monthly_invoices TO service_role;

ALTER TABLE public.monthly_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store sees own invoices" ON public.monthly_invoices
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "super_admin manages invoices" ON public.monthly_invoices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tg_monthly_invoices_updated_at
  BEFORE UPDATE ON public.monthly_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_monthly_invoices_store_period ON public.monthly_invoices(store_id, period_start);
CREATE INDEX IF NOT EXISTS idx_monthly_invoices_status ON public.monthly_invoices(status);
CREATE INDEX IF NOT EXISTS idx_monthly_invoices_asaas ON public.monthly_invoices(asaas_payment_id);

-- 4) Função para gerar fatura mensal de uma loja
CREATE OR REPLACE FUNCTION public.generate_monthly_invoice(_store_id UUID, _period_start DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sub RECORD;
  _period_end DATE := (date_trunc('month', _period_start) + interval '1 month - 1 day')::date;
  _orders_count INT := 0;
  _gross NUMERIC := 0;
  _per_order_total NUMERIC := 0;
  _commission NUMERIC := 0;
  _base NUMERIC := 0;
  _total NUMERIC := 0;
  _invoice_id UUID;
BEGIN
  SELECT * INTO _sub FROM public.store_subscriptions WHERE store_id = _store_id;
  IF _sub IS NULL THEN RETURN NULL; END IF;

  SELECT COUNT(*), COALESCE(SUM(total),0)
    INTO _orders_count, _gross
  FROM public.orders
  WHERE store_id = _store_id
    AND status = 'delivered'
    AND created_at::date BETWEEN _period_start AND _period_end;

  IF _sub.billing_model = 'fixed_plus_per_order' THEN
    _base := 0; -- mensalidade fixa cobrada pela subscription Asaas (separada)
    _per_order_total := ROUND(_orders_count * COALESCE(_sub.per_order_fee, 1.00), 2);
    _total := _per_order_total;
  ELSIF _sub.billing_model = 'commission' THEN
    _commission := ROUND(_gross * COALESCE(_sub.commission_percent, 10) / 100.0, 2);
    _total := _commission;
  END IF;

  INSERT INTO public.monthly_invoices (
    store_id, subscription_id, period_start, period_end, billing_model,
    base_amount, orders_count, per_order_total, gross_sales, commission_total,
    total_amount, status, due_date
  ) VALUES (
    _store_id, _sub.id, _period_start, _period_end, _sub.billing_model,
    _base, _orders_count, _per_order_total, _gross, _commission,
    _total, CASE WHEN _total > 0 THEN 'open' ELSE 'paid' END,
    (_period_end + interval '5 days')::date
  )
  ON CONFLICT (store_id, period_start, period_end) DO UPDATE
    SET orders_count = EXCLUDED.orders_count,
        per_order_total = EXCLUDED.per_order_total,
        gross_sales = EXCLUDED.gross_sales,
        commission_total = EXCLUDED.commission_total,
        total_amount = EXCLUDED.total_amount,
        updated_at = now()
  RETURNING id INTO _invoice_id;

  RETURN _invoice_id;
END;
$$;

-- 5) Bloqueio/reativação automática
CREATE OR REPLACE FUNCTION public.enforce_subscription_grace()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _row RECORD;
  _count INT := 0;
BEGIN
  -- Bloqueia lojas com fatura vencida há mais de 5 dias
  FOR _row IN
    SELECT DISTINCT mi.store_id
    FROM public.monthly_invoices mi
    WHERE mi.status IN ('open','pending','overdue')
      AND mi.total_amount > 0
      AND mi.due_date IS NOT NULL
      AND mi.due_date + interval '5 days' < now()
  LOOP
    UPDATE public.stores
       SET lifecycle_status = 'blocked',
           lifecycle_reason = 'Fatura em atraso há mais de 5 dias',
           lifecycle_changed_at = now()
     WHERE id = _row.store_id AND lifecycle_status <> 'blocked';
    UPDATE public.monthly_invoices SET status = 'overdue'
     WHERE store_id = _row.store_id AND status IN ('open','pending');
    _count := _count + 1;
  END LOOP;

  -- Reativa lojas sem faturas em aberto
  UPDATE public.stores s
     SET lifecycle_status = 'active',
         lifecycle_reason = 'Faturas em dia',
         lifecycle_changed_at = now()
   WHERE s.lifecycle_status = 'blocked'
     AND NOT EXISTS (
       SELECT 1 FROM public.monthly_invoices mi
       WHERE mi.store_id = s.id
         AND mi.status IN ('open','pending','overdue')
         AND mi.total_amount > 0
     );

  RETURN _count;
END;
$$;
