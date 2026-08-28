
-- API KEYS
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by UUID,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_store ON public.api_keys(store_id);
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages api keys"
  ON public.api_keys FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

-- WEBHOOKS
CREATE TABLE public.webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['order.created','order.status_changed','order.cancelled'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_store ON public.webhooks(store_id) WHERE active = true;

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages webhooks"
  ON public.webhooks FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()))
  WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- WEBHOOK DELIVERIES (log)
CREATE TABLE public.webhook_deliveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_deliveries_store ON public.webhook_deliveries(store_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views deliveries"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()));

-- Função: resolver API key (hash sha256) -> store_id
CREATE OR REPLACE FUNCTION public.resolve_api_key(_key_hash TEXT)
RETURNS TABLE(store_id UUID, key_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT store_id, id FROM public.api_keys
  WHERE key_hash = _key_hash AND revoked_at IS NULL
  LIMIT 1;
$$;

-- Trigger: ao criar/mudar status de pedido, enfileirar entrega via pg_net
CREATE OR REPLACE FUNCTION public.dispatch_order_webhook()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _event TEXT;
  _wh RECORD;
  _payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _event := 'order.created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' THEN
      _event := 'order.cancelled';
    ELSE
      _event := 'order.status_changed';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  _payload := jsonb_build_object(
    'event', _event,
    'order_id', NEW.id,
    'store_id', NEW.store_id,
    'status', NEW.status,
    'total', NEW.total,
    'customer_name', NEW.customer_name,
    'customer_phone', NEW.customer_phone,
    'method', NEW.method,
    'created_at', NEW.created_at
  );

  FOR _wh IN
    SELECT id, url, secret FROM public.webhooks
    WHERE store_id = NEW.store_id AND active = true AND _event = ANY(events)
  LOOP
    -- Insere fila; um job/edge function processa e faz POST
    INSERT INTO public.webhook_deliveries (webhook_id, store_id, event, payload, success, attempts)
    VALUES (_wh.id, NEW.store_id, _event, _payload, false, 0);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_webhook_dispatch
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_order_webhook();
