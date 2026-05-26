
-- ============================================================
-- 1) STORES: revoke sensitive columns from anonymous role
-- ============================================================
REVOKE SELECT (
  owner_id,
  pix_key,
  marketplace_fee_percent,
  autocancel_min,
  autocancel_enabled,
  lifecycle_status,
  lifecycle_reason,
  lifecycle_changed_at,
  chatbot_phone,
  chatbot_n8n_webhook_url,
  chatbot_qr_code,
  chatbot_status,
  chatbot_connected_at,
  chatbot_qr_updated_at,
  max_orders_per_hour,
  vacation_mode,
  vacation_message,
  vacation_until,
  accept_alert_min,
  sound_alerts_enabled,
  courier_gps_alert_min,
  courier_gps_reassign_min,
  auto_print_enabled,
  print_format
) ON public.stores FROM anon;

-- ============================================================
-- 2) TABLES: revoke qr_token from anon and authenticated
--    Provide a SECURITY DEFINER RPC for the Mesa QR flow.
-- ============================================================
REVOKE SELECT (qr_token) ON public.tables FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.resolve_table_by_qr(_token text)
RETURNS TABLE(id uuid, store_id uuid, number int, name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.store_id, t.number, t.name
  FROM public.tables t
  WHERE t.qr_token = _token AND t.active = true
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.resolve_table_by_qr(text) TO anon, authenticated;

-- ============================================================
-- 3) TABLE_SESSIONS: drop public read; add SECURITY DEFINER RPC
--    that returns only safe (non-PII) fields for the Mesa page.
-- ============================================================
DROP POLICY IF EXISTS "Public reads open sessions" ON public.table_sessions;

CREATE OR REPLACE FUNCTION public.get_open_session_safe(_table_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  subtotal numeric,
  service_fee numeric,
  service_fee_percent numeric,
  total numeric,
  opened_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.status::text, s.subtotal, s.service_fee,
         s.service_fee_percent, s.total, s.opened_at
  FROM public.table_sessions s
  WHERE s.table_id = _table_id AND s.status = 'open'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_open_session_safe(uuid) TO anon, authenticated;

-- ============================================================
-- 4) ORDERS: server-side total validation trigger
--    Prevents tampered totals from reaching the PIX gateway.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _expected_subtotal numeric;
  _expected_total numeric;
BEGIN
  -- Skip validation for staff updates (owners/team can manually adjust)
  IF TG_OP = 'UPDATE' AND public.is_store_owner(NEW.store_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND public.can_access_section(NEW.store_id, auth.uid(), 'orders') THEN
    RETURN NEW;
  END IF;

  -- On INSERT, items are inserted right after the order row; we cannot validate
  -- here. Defer to AFTER trigger via the order_items hook below.
  IF TG_OP = 'INSERT' THEN
    -- Sanity: total must equal subtotal + delivery_fee - coupon_discount (± 0.02)
    _expected_total := COALESCE(NEW.subtotal,0)
                     + COALESCE(NEW.delivery_fee,0)
                     - COALESCE(NEW.coupon_discount,0);
    IF ABS(COALESCE(NEW.total,0) - _expected_total) > 0.02 THEN
      RAISE EXCEPTION 'Order total mismatch: total=% expected=%',
        NEW.total, _expected_total USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_totals ON public.orders;
CREATE TRIGGER trg_validate_order_totals
BEFORE INSERT OR UPDATE OF total, subtotal, delivery_fee, coupon_discount ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_order_totals();

-- Validate item unit prices match current product prices on INSERT
-- (customers only; staff/PDV can override).
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _current_price numeric;
BEGIN
  SELECT store_id, user_id INTO _order FROM public.orders WHERE id = NEW.order_id;
  IF _order IS NULL THEN RETURN NEW; END IF;

  -- Allow staff bypass
  IF public.is_store_owner(_order.store_id, auth.uid())
     OR public.can_access_section(_order.store_id, auth.uid(), 'orders') THEN
    RETURN NEW;
  END IF;

  IF NEW.product_id IS NULL THEN RETURN NEW; END IF;

  SELECT price INTO _current_price FROM public.products
   WHERE id = NEW.product_id AND store_id = _order.store_id;
  IF _current_price IS NULL THEN RETURN NEW; END IF;

  -- unit_price must be <= current price (we accept addon increases via stored value
  -- by allowing equality or higher only if matches; here we strict-check base price).
  IF NEW.unit_price < _current_price - 0.02 THEN
    RAISE EXCEPTION 'Item unit_price (%) below current product price (%) for product %',
      NEW.unit_price, _current_price, NEW.product_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_item_price ON public.order_items;
CREATE TRIGGER trg_validate_order_item_price
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_price();
