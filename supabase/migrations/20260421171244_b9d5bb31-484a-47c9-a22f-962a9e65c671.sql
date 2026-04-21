-- ============================================
-- 1. PIX AUTOMÁTICO (Mercado Pago + Asaas)
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('mercadopago', 'asaas')),
  active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  -- credenciais cifradas (armazenamos referência ao secret name; valores ficam em secrets)
  access_token_secret_name TEXT,
  webhook_secret TEXT,
  -- split marketplace
  split_enabled BOOLEAN NOT NULL DEFAULT false,
  split_recipient_id TEXT,
  marketplace_fee_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  -- ambiente
  sandbox BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);

ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages payment gateways"
  ON public.payment_gateways FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE TRIGGER trg_payment_gateways_updated
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_gateways_store ON public.payment_gateways(store_id);

-- Transações PIX
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  external_id TEXT,
  method TEXT NOT NULL DEFAULT 'pix',
  amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(12,2) DEFAULT 0,
  net_amount NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','refunded','expired','cancelled')),
  qr_code_base64 TEXT,
  qr_code_payload TEXT,
  ticket_url TEXT,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  raw_response JSONB,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer views own payment txns"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payment_transactions.order_id AND o.user_id = auth.uid()));

CREATE POLICY "Store team views payment txns"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'));

CREATE TRIGGER trg_payment_txns_updated
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_txns_order ON public.payment_transactions(order_id);
CREATE INDEX idx_payment_txns_external ON public.payment_transactions(external_id);
CREATE INDEX idx_payment_txns_status ON public.payment_transactions(status);

-- ============================================
-- 2. NFC-e (estrutura + status)
-- ============================================

CREATE TABLE IF NOT EXISTS public.store_fiscal_config (
  store_id UUID PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT CHECK (provider IN ('focusnfe','plugnotas','manual')),
  cnpj TEXT,
  ie TEXT,
  ie_isenta BOOLEAN NOT NULL DEFAULT false,
  regime_tributario TEXT CHECK (regime_tributario IN ('simples_nacional','lucro_presumido','lucro_real')),
  csc_id TEXT,
  csc_token_secret_name TEXT,
  certificate_secret_name TEXT,
  ambiente TEXT NOT NULL DEFAULT 'homologacao' CHECK (ambiente IN ('homologacao','producao')),
  serie INTEGER NOT NULL DEFAULT 1,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  cfop_padrao TEXT DEFAULT '5102',
  ncm_padrao TEXT,
  csosn_padrao TEXT DEFAULT '102',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_fiscal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages fiscal config"
  ON public.store_fiscal_config FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE TRIGGER trg_fiscal_cfg_updated
  BEFORE UPDATE ON public.store_fiscal_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.fiscal_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT,
  type TEXT NOT NULL DEFAULT 'nfce' CHECK (type IN ('nfce','nfe')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','authorized','rejected','cancelled','error')),
  numero INTEGER,
  serie INTEGER,
  access_key TEXT,
  protocol TEXT,
  xml_url TEXT,
  pdf_url TEXT,
  total NUMERIC(12,2) NOT NULL,
  customer_cpf TEXT,
  customer_name TEXT,
  emitted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  error_message TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer views own invoices"
  ON public.fiscal_invoices FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = fiscal_invoices.order_id AND o.user_id = auth.uid()));

CREATE POLICY "Store team manages invoices"
  ON public.fiscal_invoices FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'));

CREATE TRIGGER trg_fiscal_inv_updated
  BEFORE UPDATE ON public.fiscal_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_fiscal_inv_order ON public.fiscal_invoices(order_id);
CREATE INDEX idx_fiscal_inv_store_status ON public.fiscal_invoices(store_id, status);

-- ============================================
-- 3. DRE — categorias e despesas
-- ============================================

CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'operational' CHECK (kind IN ('cmv','operational','marketing','payroll','rent','utilities','tax','other')),
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages expense categories"
  ON public.expense_categories FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'));

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence TEXT CHECK (recurrence IN ('monthly','weekly','yearly')),
  paid BOOLEAN NOT NULL DEFAULT true,
  paid_at TIMESTAMPTZ,
  receipt_url TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'financial'));

CREATE TRIGGER trg_expenses_updated
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_expenses_store_date ON public.expenses(store_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON public.expenses(category_id);

-- CMV: adicionar custo no produto
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;

-- ============================================
-- 4. Função DRE: agrega receita, CMV, despesas, taxas
-- ============================================

CREATE OR REPLACE FUNCTION public.dre_report(_store_id UUID, _from DATE, _to DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_allowed BOOLEAN;
  _gross NUMERIC := 0;
  _delivery_fees NUMERIC := 0;
  _coupon_discount NUMERIC := 0;
  _orders_count INTEGER := 0;
  _cmv NUMERIC := 0;
  _gateway_fees NUMERIC := 0;
  _marketplace_fee NUMERIC := 0;
  _expenses_by_kind JSONB;
  _expenses_total NUMERIC := 0;
  _net_revenue NUMERIC;
  _gross_profit NUMERIC;
  _ebitda NUMERIC;
  _net_profit NUMERIC;
BEGIN
  SELECT (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR can_access_section(_store_id, auth.uid(), 'financial'))
    INTO _is_allowed
  FROM stores s WHERE s.id = _store_id;
  IF NOT COALESCE(_is_allowed, false) THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Receita bruta + deduções
  SELECT
    COALESCE(SUM(o.total), 0),
    COALESCE(SUM(o.delivery_fee), 0),
    COALESCE(SUM(o.coupon_discount), 0),
    COUNT(*)
  INTO _gross, _delivery_fees, _coupon_discount, _orders_count
  FROM orders o
  WHERE o.store_id = _store_id
    AND o.status = 'delivered'
    AND o.created_at::date BETWEEN _from AND _to;

  -- CMV (custo dos produtos vendidos)
  SELECT COALESCE(SUM(oi.quantity * COALESCE(p.cost_price, 0)), 0)
  INTO _cmv
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE o.store_id = _store_id
    AND o.status = 'delivered'
    AND o.created_at::date BETWEEN _from AND _to;

  -- Taxas de gateway
  SELECT COALESCE(SUM(pt.fee_amount), 0)
  INTO _gateway_fees
  FROM payment_transactions pt
  JOIN orders o ON o.id = pt.order_id
  WHERE pt.store_id = _store_id
    AND pt.status = 'approved'
    AND o.created_at::date BETWEEN _from AND _to;

  -- Taxa marketplace (do projeto)
  SELECT COALESCE(SUM(p.fee_amount), 0)
  INTO _marketplace_fee
  FROM payouts p
  WHERE p.store_id = _store_id
    AND p.period_start >= _from AND p.period_end <= _to;

  -- Despesas agrupadas por tipo
  SELECT
    COALESCE(jsonb_object_agg(k, total), '{}'::jsonb),
    COALESCE(SUM(total), 0)
  INTO _expenses_by_kind, _expenses_total
  FROM (
    SELECT COALESCE(c.kind, 'other') AS k, SUM(e.amount) AS total
    FROM expenses e
    LEFT JOIN expense_categories c ON c.id = e.category_id
    WHERE e.store_id = _store_id
      AND e.expense_date BETWEEN _from AND _to
    GROUP BY COALESCE(c.kind, 'other')
  ) t;

  _net_revenue := _gross - _coupon_discount;
  _gross_profit := _net_revenue - _cmv;
  _ebitda := _gross_profit - _expenses_total - _gateway_fees - _marketplace_fee;
  _net_profit := _ebitda;

  RETURN jsonb_build_object(
    'period', jsonb_build_object('from', _from, 'to', _to),
    'orders_count', _orders_count,
    'gross_revenue', _gross,
    'deductions', jsonb_build_object(
      'coupons', _coupon_discount,
      'delivery_fees_collected', _delivery_fees
    ),
    'net_revenue', _net_revenue,
    'cmv', _cmv,
    'gross_profit', _gross_profit,
    'gross_margin_percent', CASE WHEN _net_revenue > 0 THEN ROUND((_gross_profit / _net_revenue * 100)::numeric, 2) ELSE 0 END,
    'gateway_fees', _gateway_fees,
    'marketplace_fee', _marketplace_fee,
    'expenses_by_kind', _expenses_by_kind,
    'expenses_total', _expenses_total,
    'ebitda', _ebitda,
    'net_profit', _net_profit,
    'net_margin_percent', CASE WHEN _net_revenue > 0 THEN ROUND((_net_profit / _net_revenue * 100)::numeric, 2) ELSE 0 END
  );
END;
$$;