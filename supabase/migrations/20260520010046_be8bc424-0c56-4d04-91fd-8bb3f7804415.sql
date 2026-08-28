
-- ============================================================================
-- Controle de Estoque (Fase 1) — multi-tenant por loja
-- ============================================================================

-- 1) Fornecedores
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  cnpj text,
  contact_name text,
  phone text,
  email text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_store ON public.suppliers(store_id);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team manages suppliers"
  ON public.suppliers FOR ALL TO authenticated
  USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'products'))
  WITH CHECK (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'products'));

CREATE TRIGGER trg_suppliers_updated
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Campos extras opcionais em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text,
  ADD COLUMN IF NOT EXISTS barcode text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS min_stock integer,
  ADD COLUMN IF NOT EXISTS location text;

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(store_id, sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(store_id, barcode) WHERE barcode IS NOT NULL;

-- 3) Movimentações de estoque
DO $$ BEGIN
  CREATE TYPE public.stock_movement_type AS ENUM (
    'sale','return','purchase','adjustment','loss','transfer_in','transfer_out'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  type public.stock_movement_type NOT NULL,
  quantity numeric NOT NULL,         -- assinada (+ entrada / - saída)
  unit_cost numeric,
  reason text,
  order_id uuid,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_mov_store ON public.stock_movements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_mov_product ON public.stock_movements(product_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team views stock movements"
  ON public.stock_movements FOR SELECT TO authenticated
  USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'products'));

CREATE POLICY "Store team inserts stock movements"
  ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'products'));

-- 4) Função central: aplica delta e registra movimento
CREATE OR REPLACE FUNCTION public.register_stock_movement(
  _store_id uuid,
  _product_id uuid,
  _type public.stock_movement_type,
  _quantity numeric,
  _reason text DEFAULT NULL,
  _order_id uuid DEFAULT NULL,
  _unit_cost numeric DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _mov_id uuid;
  _track boolean;
BEGIN
  SELECT track_stock INTO _track FROM public.products WHERE id = _product_id;
  IF NOT COALESCE(_track, false) THEN
    -- ainda registra histórico mesmo sem tracking? sim, mas sem alterar stock
    INSERT INTO public.stock_movements (store_id, product_id, type, quantity, unit_cost, reason, order_id, user_id)
    VALUES (_store_id, _product_id, _type, _quantity, _unit_cost, _reason, _order_id, auth.uid())
    RETURNING id INTO _mov_id;
    RETURN _mov_id;
  END IF;

  UPDATE public.products
     SET stock = COALESCE(stock,0) + _quantity,
         updated_at = now()
   WHERE id = _product_id AND store_id = _store_id;

  INSERT INTO public.stock_movements (store_id, product_id, type, quantity, unit_cost, reason, order_id, user_id)
  VALUES (_store_id, _product_id, _type, _quantity, _unit_cost, _reason, _order_id, auth.uid())
  RETURNING id INTO _mov_id;

  RETURN _mov_id;
END $$;

-- 5) Trigger automático em pedidos: baixar/devolver estoque
CREATE OR REPLACE FUNCTION public.tg_orders_stock_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _it RECORD;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- delivered: baixa
    IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
      FOR _it IN
        SELECT product_id, SUM(quantity)::numeric AS qty
        FROM public.order_items
        WHERE order_id = NEW.id AND product_id IS NOT NULL
        GROUP BY product_id
      LOOP
        PERFORM public.register_stock_movement(
          NEW.store_id, _it.product_id, 'sale', -_it.qty,
          'Venda pedido #' || substr(NEW.id::text,1,8), NEW.id, NULL
        );
      END LOOP;

    -- cancelled após delivered: devolve
    ELSIF NEW.status = 'cancelled' AND OLD.status = 'delivered' THEN
      FOR _it IN
        SELECT product_id, SUM(quantity)::numeric AS qty
        FROM public.order_items
        WHERE order_id = NEW.id AND product_id IS NOT NULL
        GROUP BY product_id
      LOOP
        PERFORM public.register_stock_movement(
          NEW.store_id, _it.product_id, 'return', _it.qty,
          'Cancelamento pedido #' || substr(NEW.id::text,1,8), NEW.id, NULL
        );
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_orders_stock_sync ON public.orders;
CREATE TRIGGER trg_orders_stock_sync
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_stock_sync();
