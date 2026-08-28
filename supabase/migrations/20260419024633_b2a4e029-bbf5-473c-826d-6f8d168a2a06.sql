-- Stores: novos campos
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS auto_print_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS print_format TEXT NOT NULL DEFAULT 'thermal_80mm',
  ADD COLUMN IF NOT EXISTS pdv_enabled BOOLEAN NOT NULL DEFAULT true;

-- Cash registers (abertura/fechamento de caixa)
CREATE TABLE IF NOT EXISTS public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  opened_by UUID,
  opened_by_name TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  closed_by_name TEXT,
  initial_amount NUMERIC NOT NULL DEFAULT 0,
  expected_amount NUMERIC,
  counted_amount NUMERIC,
  difference NUMERIC,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

CREATE INDEX IF NOT EXISTS idx_cash_registers_store_status ON public.cash_registers(store_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_registers_store_opened ON public.cash_registers(store_id, opened_at DESC);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/team views cash registers"
  ON public.cash_registers FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

CREATE POLICY "Owner/team manages cash registers"
  ON public.cash_registers FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- Cash movements (sangria, suprimento, vendas em dinheiro)
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('sale','withdrawal','deposit','adjustment')),
  payment_method TEXT,
  amount NUMERIC NOT NULL,
  description TEXT,
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_register ON public.cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_store_created ON public.cash_movements(store_id, created_at DESC);

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/team views cash movements"
  ON public.cash_movements FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

CREATE POLICY "Owner/team inserts cash movements"
  ON public.cash_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- PDV multi-pagamentos
CREATE TABLE IF NOT EXISTS public.pdv_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  change_given NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdv_payments_order ON public.pdv_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pdv_payments_store ON public.pdv_payments(store_id);

ALTER TABLE public.pdv_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/team views pdv payments"
  ON public.pdv_payments FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

CREATE POLICY "Owner/team inserts pdv payments"
  ON public.pdv_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- Função: caixa aberto atual da loja
CREATE OR REPLACE FUNCTION public.get_open_cash_register(_store_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.cash_registers
  WHERE store_id = _store_id AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;
$$;

-- Função: cálculo do total esperado em dinheiro de um caixa
CREATE OR REPLACE FUNCTION public.cash_register_expected(_register_id UUID)
RETURNS NUMERIC
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT initial_amount FROM public.cash_registers WHERE id = _register_id), 0)
    + COALESCE((
        SELECT SUM(
          CASE
            WHEN type IN ('sale','deposit') AND payment_method = 'cash' THEN amount
            WHEN type = 'withdrawal' THEN -ABS(amount)
            WHEN type = 'adjustment' THEN amount
            ELSE 0
          END
        )
        FROM public.cash_movements
        WHERE cash_register_id = _register_id
      ), 0);
$$;