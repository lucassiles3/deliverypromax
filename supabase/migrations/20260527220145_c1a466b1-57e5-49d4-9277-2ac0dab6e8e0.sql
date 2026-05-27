
-- 1) Audit log table
CREATE TABLE IF NOT EXISTS public.billing_job_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running', -- running | success | partial | error
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  processed INTEGER DEFAULT 0,
  succeeded INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  error_message TEXT,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_job_runs_started ON public.billing_job_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_job_runs_job ON public.billing_job_runs(job_name, started_at DESC);

GRANT SELECT ON public.billing_job_runs TO authenticated;
GRANT ALL ON public.billing_job_runs TO service_role;

ALTER TABLE public.billing_job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read billing runs"
ON public.billing_job_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role));

-- 2) Per-store billing config
ALTER TABLE public.store_subscriptions
  ADD COLUMN IF NOT EXISTS billing_day INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS grace_days INTEGER NOT NULL DEFAULT 5;

ALTER TABLE public.store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_billing_day_chk;
ALTER TABLE public.store_subscriptions
  ADD CONSTRAINT store_subscriptions_billing_day_chk CHECK (billing_day BETWEEN 1 AND 28);
ALTER TABLE public.store_subscriptions
  DROP CONSTRAINT IF EXISTS store_subscriptions_grace_days_chk;
ALTER TABLE public.store_subscriptions
  ADD CONSTRAINT store_subscriptions_grace_days_chk CHECK (grace_days BETWEEN 0 AND 30);

-- 3) Update generate_monthly_invoice to use per-sub grace_days
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
  _grace INT;
BEGIN
  SELECT * INTO _sub FROM public.store_subscriptions WHERE store_id = _store_id;
  IF _sub IS NULL THEN RETURN NULL; END IF;
  _grace := COALESCE(_sub.grace_days, 5);

  SELECT COUNT(*), COALESCE(SUM(total),0)
    INTO _orders_count, _gross
  FROM public.orders
  WHERE store_id = _store_id
    AND status = 'delivered'
    AND created_at::date BETWEEN _period_start AND _period_end;

  IF _sub.billing_model = 'fixed_plus_per_order' THEN
    _base := 0;
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
    (_period_end + (_grace || ' days')::interval)::date
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

-- 4) Update enforce_subscription_grace: per-sub grace + notifications
CREATE OR REPLACE FUNCTION public.enforce_subscription_grace()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row RECORD;
  _count INT := 0;
  _store RECORD;
  _grace INT;
BEGIN
  -- Marca overdue + notifica fatura vencida (apenas uma vez por fatura)
  FOR _row IN
    SELECT mi.*, ss.grace_days, s.owner_id, s.name AS store_name
    FROM public.monthly_invoices mi
    JOIN public.store_subscriptions ss ON ss.id = mi.subscription_id
    JOIN public.stores s ON s.id = mi.store_id
    WHERE mi.status IN ('open','pending')
      AND mi.total_amount > 0
      AND mi.due_date IS NOT NULL
      AND mi.due_date < CURRENT_DATE
  LOOP
    UPDATE public.monthly_invoices SET status = 'overdue', updated_at = now() WHERE id = _row.id;

    IF _row.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, store_id, title, message, type, link, metadata)
      VALUES (
        _row.owner_id, _row.store_id,
        '⚠️ Fatura em atraso',
        'A fatura de ' || to_char(_row.period_start,'MM/YYYY') || ' (R$ ' ||
          to_char(_row.total_amount,'FM999G999D00') || ') venceu em ' ||
          to_char(_row.due_date,'DD/MM/YYYY') || '. Regularize para evitar bloqueio.',
        'warning', '/admin',
        jsonb_build_object('invoice_id', _row.id, 'event', 'invoice_overdue')
      );
    END IF;
  END LOOP;

  -- Bloqueia lojas com fatura overdue há mais de grace_days
  FOR _row IN
    SELECT DISTINCT mi.store_id, ss.grace_days, mi.due_date
    FROM public.monthly_invoices mi
    JOIN public.store_subscriptions ss ON ss.id = mi.subscription_id
    WHERE mi.status = 'overdue'
      AND mi.total_amount > 0
      AND mi.due_date + (COALESCE(ss.grace_days,5) || ' days')::interval < now()
  LOOP
    SELECT * INTO _store FROM public.stores WHERE id = _row.store_id;
    IF _store.lifecycle_status <> 'blocked' THEN
      UPDATE public.stores
         SET lifecycle_status = 'blocked',
             lifecycle_reason = 'Fatura em atraso há mais de ' || COALESCE(_row.grace_days,5) || ' dias',
             lifecycle_changed_at = now()
       WHERE id = _row.store_id;

      IF _store.owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, store_id, title, message, type, link, metadata)
        VALUES (
          _store.owner_id, _row.store_id,
          '🔒 Loja bloqueada por inadimplência',
          'Sua loja foi pausada automaticamente. Regularize as faturas em aberto para reativar.',
          'error', '/admin',
          jsonb_build_object('event', 'store_blocked')
        );
      END IF;
      _count := _count + 1;
    END IF;
  END LOOP;

  -- Reativa lojas sem faturas em aberto + notifica
  FOR _row IN
    SELECT s.id AS store_id, s.owner_id
    FROM public.stores s
    WHERE s.lifecycle_status = 'blocked'
      AND NOT EXISTS (
        SELECT 1 FROM public.monthly_invoices mi
        WHERE mi.store_id = s.id
          AND mi.status IN ('open','pending','overdue')
          AND mi.total_amount > 0
      )
  LOOP
    UPDATE public.stores
       SET lifecycle_status = 'active',
           lifecycle_reason = 'Faturas em dia',
           lifecycle_changed_at = now()
     WHERE id = _row.store_id;

    IF _row.owner_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, store_id, title, message, type, link, metadata)
      VALUES (
        _row.owner_id, _row.store_id,
        '✅ Loja reativada',
        'Suas faturas foram regularizadas e a loja voltou a operar normalmente.',
        'success', '/admin',
        jsonb_build_object('event', 'store_unblocked')
      );
    END IF;
  END LOOP;

  RETURN _count;
END;
$function$;
