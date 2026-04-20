-- ============ ENUMS ============
CREATE TYPE public.table_status AS ENUM ('available','occupied','reserved','blocked');
CREATE TYPE public.kitchen_status AS ENUM ('pending','preparing','ready','delivered','cancelled');
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','seated','cancelled','no_show');

-- ============ STORES: taxa de serviço ============
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS service_fee_percent NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS service_fee_default_on BOOLEAN NOT NULL DEFAULT true;

-- ============ SECTORS ============
CREATE TABLE public.sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sectors_store ON public.sectors(store_id);
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sectors public read" ON public.sectors FOR SELECT USING (active = true);
CREATE POLICY "Owner/team manages sectors" ON public.sectors FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ TABLES (mesas) ============
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
  number INTEGER NOT NULL,
  name TEXT,
  capacity INTEGER NOT NULL DEFAULT 4,
  status public.table_status NOT NULL DEFAULT 'available',
  notes TEXT,
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  qr_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text,'-',''),
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, number),
  UNIQUE (qr_token)
);
CREATE INDEX idx_tables_store ON public.tables(store_id);
CREATE INDEX idx_tables_sector ON public.tables(sector_id);
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_tables_updated BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leitura pública por QR token (a UI vai filtrar por qr_token via .eq)
CREATE POLICY "Tables public read" ON public.tables FOR SELECT USING (active = true);
CREATE POLICY "Owner/team manages tables" ON public.tables FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ TABLE SESSIONS (comanda) ============
CREATE TABLE public.table_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open', -- open | closed | cancelled
  people INTEGER NOT NULL DEFAULT 1,
  waiter_user_id UUID,           -- store_members.user_id (auth)
  waiter_name TEXT,              -- snapshot
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  service_fee NUMERIC NOT NULL DEFAULT 0,
  service_fee_percent NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_by UUID,
  cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, -- ligação financeiro
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_store ON public.table_sessions(store_id);
CREATE INDEX idx_sessions_table ON public.table_sessions(table_id);
CREATE UNIQUE INDEX uniq_open_session_per_table
  ON public.table_sessions(table_id) WHERE status = 'open';

ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.table_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owner/team manages sessions" ON public.table_sessions FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ SESSION ITEMS (comanda_itens) ============
CREATE TABLE public.table_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  kitchen_status public.kitchen_status NOT NULL DEFAULT 'pending',
  destination TEXT NOT NULL DEFAULT 'kitchen', -- kitchen | bar
  created_by UUID,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_session ON public.table_session_items(session_id);
CREATE INDEX idx_items_store ON public.table_session_items(store_id);
CREATE INDEX idx_items_kstatus ON public.table_session_items(store_id, kitchen_status);

ALTER TABLE public.table_session_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.table_session_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Owner/team manages session items" ON public.table_session_items FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ PAGAMENTOS DA MESA ============
CREATE TABLE public.table_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.table_sessions(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  method TEXT NOT NULL,    -- cash | pix | credit | debit | voucher
  amount NUMERIC NOT NULL,
  payer_name TEXT,         -- p/ dividir por pessoa
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tpay_session ON public.table_payments(session_id);
CREATE INDEX idx_tpay_store ON public.table_payments(store_id);

ALTER TABLE public.table_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/team manages table payments" ON public.table_payments FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ RESERVAS ============
CREATE TABLE public.table_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  people INTEGER NOT NULL DEFAULT 2,
  reserved_for TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resv_store ON public.table_reservations(store_id, reserved_for);
ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_resv_updated BEFORE UPDATE ON public.table_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cliente público pode criar reserva
CREATE POLICY "Public can create reservations" ON public.table_reservations FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Owner/team manages reservations" ON public.table_reservations FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ CHAMADAS DE GARÇOM ============
CREATE TABLE public.table_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'waiter', -- waiter | bill | help
  message TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_calls_store ON public.table_calls(store_id, resolved, created_at DESC);
ALTER TABLE public.table_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can call waiter" ON public.table_calls FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Owner/team views calls" ON public.table_calls FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));
CREATE POLICY "Owner/team resolves calls" ON public.table_calls FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()) OR public.can_access_section(store_id, auth.uid(), 'orders'));

-- ============ FUNÇÃO: recalcular totais da sessão ============
CREATE OR REPLACE FUNCTION public.recalc_table_session(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub NUMERIC;
  _pct NUMERIC;
  _disc NUMERIC;
  _paid NUMERIC;
BEGIN
  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO _sub
  FROM public.table_session_items WHERE session_id = _session_id;

  SELECT COALESCE(service_fee_percent,0), COALESCE(discount,0)
    INTO _pct, _disc
  FROM public.table_sessions WHERE id = _session_id;

  SELECT COALESCE(SUM(amount),0) INTO _paid
  FROM public.table_payments WHERE session_id = _session_id;

  UPDATE public.table_sessions
     SET subtotal = _sub,
         service_fee = ROUND(_sub * COALESCE(_pct,0) / 100.0, 2),
         total = GREATEST(0, ROUND(_sub + (_sub * COALESCE(_pct,0)/100.0) - COALESCE(_disc,0), 2)),
         paid_amount = _paid,
         updated_at = now()
   WHERE id = _session_id;
END;
$$;

-- ============ TRIGGERS: manter total da comanda + total do item ============
CREATE OR REPLACE FUNCTION public.tg_item_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.total := ROUND(COALESCE(NEW.quantity,0) * COALESCE(NEW.unit_price,0), 2);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_item_total
BEFORE INSERT OR UPDATE ON public.table_session_items
FOR EACH ROW EXECUTE FUNCTION public.tg_item_total();

CREATE OR REPLACE FUNCTION public.tg_recalc_session_after_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_table_session(COALESCE(NEW.session_id, OLD.session_id));
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_recalc_after_item
AFTER INSERT OR UPDATE OR DELETE ON public.table_session_items
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_session_after_item();

CREATE TRIGGER trg_recalc_after_payment
AFTER INSERT OR UPDATE OR DELETE ON public.table_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_session_after_item();

-- ============ TRIGGER: status da mesa segue a sessão ============
CREATE OR REPLACE FUNCTION public.tg_session_table_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'open' THEN
      UPDATE public.tables SET status = 'occupied', updated_at = now() WHERE id = NEW.table_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status <> 'open' AND OLD.status = 'open' THEN
      UPDATE public.tables SET status = 'available', updated_at = now() WHERE id = NEW.table_id;
    ELSIF NEW.status = 'open' AND OLD.status <> 'open' THEN
      UPDATE public.tables SET status = 'occupied', updated_at = now() WHERE id = NEW.table_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_session_table_status
AFTER INSERT OR UPDATE ON public.table_sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_session_table_status();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_session_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.table_reservations;