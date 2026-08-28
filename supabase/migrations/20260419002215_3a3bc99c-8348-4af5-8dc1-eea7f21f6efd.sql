-- 1) Add 'ready' to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready' BEFORE 'out_for_delivery';

-- 2) Cancellation source enum + columns on orders
DO $$ BEGIN
  CREATE TYPE public.cancel_source AS ENUM ('store', 'system', 'customer', 'courier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancel_by public.cancel_source,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- 3) Store-level config for accept alerts / auto-cancel
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS accept_alert_min integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS autocancel_min integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS autocancel_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sound_alerts_enabled boolean NOT NULL DEFAULT true;

-- 4) order_status_history table
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_osh_order_id ON public.order_status_history(order_id);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner views status history" ON public.order_status_history;
CREATE POLICY "Owner views status history"
ON public.order_status_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = order_status_history.order_id
    AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
));

DROP POLICY IF EXISTS "Customer views own status history" ON public.order_status_history;
CREATE POLICY "Customer views own status history"
ON public.order_status_history FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.orders o
  WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()
));

-- 5) Trigger: log status changes + set accepted_at on first transition out of received/pending_payment
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), NEW.cancel_reason);

    IF NEW.accepted_at IS NULL
       AND OLD.status IN ('pending_payment','received')
       AND NEW.status NOT IN ('pending_payment','received','cancelled') THEN
      NEW.accepted_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_insert ON public.orders;
CREATE TRIGGER trg_log_order_status_insert
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

DROP TRIGGER IF EXISTS trg_log_order_status_update ON public.orders;
CREATE TRIGGER trg_log_order_status_update
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.log_order_status_change();

-- 6) Enable realtime on orders for live kanban
ALTER TABLE public.orders REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.orders';
  END IF;
END $$;