
-- 1) Atualiza seed do plano de comissão para incluir R$1/pedido
UPDATE public.subscription_plans
   SET per_order_fee = 1.00
 WHERE slug = 'pro_commission';

-- 2) Atualiza assinaturas ativas no modelo comissão
UPDATE public.store_subscriptions
   SET per_order_fee = 1.00
 WHERE billing_model = 'commission'
   AND COALESCE(per_order_fee, 0) <> 1.00;

-- 3) Recria função de geração de fatura mensal somando per_order_total no modelo comissão
CREATE OR REPLACE FUNCTION public.generate_monthly_invoice(_store_id uuid, _period_start date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    _base := 0; -- mensalidade cobrada pela subscription Asaas separadamente
    _per_order_total := ROUND(_orders_count * COALESCE(_sub.per_order_fee, 1.00), 2);
    _total := _per_order_total;
  ELSIF _sub.billing_model = 'commission' THEN
    _commission := ROUND(_gross * COALESCE(_sub.commission_percent, 10) / 100.0, 2);
    _per_order_total := ROUND(_orders_count * COALESCE(_sub.per_order_fee, 1.00), 2);
    _total := _commission + _per_order_total;
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
$function$;
