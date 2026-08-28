-- 1. Itens com flag de pedido pelo cliente
ALTER TABLE public.table_session_items
  ADD COLUMN IF NOT EXISTS customer_requested boolean NOT NULL DEFAULT false;

-- 2. Orders com origem e vínculo de comanda
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS table_session_id uuid REFERENCES public.table_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS table_number integer;

CREATE INDEX IF NOT EXISTS idx_orders_table_session ON public.orders(table_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_source ON public.orders(source);

-- 3. RLS: permitir cliente anônimo (via QR) inserir itens em sessão aberta
DROP POLICY IF EXISTS "Public can request items on open session" ON public.table_session_items;
CREATE POLICY "Public can request items on open session"
ON public.table_session_items
FOR INSERT
TO anon, authenticated
WITH CHECK (
  customer_requested = true
  AND EXISTS (
    SELECT 1 FROM public.table_sessions s
    WHERE s.id = table_session_items.session_id
      AND s.status = 'open'
      AND s.store_id = table_session_items.store_id
  )
);

-- 4. RLS: permitir leitura pública de itens da sessão aberta (para o cliente ver no QR)
DROP POLICY IF EXISTS "Public reads open session items" ON public.table_session_items;
CREATE POLICY "Public reads open session items"
ON public.table_session_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.table_sessions s
    WHERE s.id = table_session_items.session_id
      AND s.status = 'open'
  )
);

-- 5. RLS: leitura pública de table_sessions abertas (para cliente ver totais)
DROP POLICY IF EXISTS "Public reads open sessions" ON public.table_sessions;
CREATE POLICY "Public reads open sessions"
ON public.table_sessions
FOR SELECT
TO anon, authenticated
USING (status = 'open');

-- 6. Trigger: notificar equipe quando cliente pede pelo QR
CREATE OR REPLACE FUNCTION public.tg_notify_customer_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _table_num int;
  _owner uuid;
BEGIN
  IF NEW.customer_requested = true THEN
    SELECT t.number, s.owner_id INTO _table_num, _owner
    FROM public.tables t
    JOIN public.stores s ON s.id = t.store_id
    JOIN public.table_sessions ts ON ts.table_id = t.id
    WHERE ts.id = NEW.session_id;

    IF _owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, store_id, title, message, type, link)
      VALUES (
        _owner,
        NEW.store_id,
        '🍽️ Novo pedido na mesa ' || COALESCE(_table_num::text, '?'),
        NEW.quantity || 'x ' || NEW.product_name || ' (cliente)',
        'info',
        '/admin'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_request ON public.table_session_items;
CREATE TRIGGER trg_notify_customer_request
AFTER INSERT ON public.table_session_items
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_customer_request();