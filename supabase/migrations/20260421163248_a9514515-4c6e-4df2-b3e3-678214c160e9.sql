-- 1) Nova tabela: histórico de localização do entregador por pedido
CREATE TABLE public.courier_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES public.couriers(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy numeric,
  heading numeric,
  speed numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_clh_order ON public.courier_location_history (order_id, recorded_at);
CREATE INDEX idx_clh_courier ON public.courier_location_history (courier_id, recorded_at DESC);

ALTER TABLE public.courier_location_history ENABLE ROW LEVEL SECURITY;

-- Entregador insere seus próprios pontos
CREATE POLICY "Courier inserts own history"
ON public.courier_location_history
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.couriers c
    WHERE c.id = courier_location_history.courier_id
      AND c.user_id = auth.uid()
  )
);

-- Cliente vê histórico de pedidos próprios
CREATE POLICY "Customer views own order history"
ON public.courier_location_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = courier_location_history.order_id
      AND o.user_id = auth.uid()
  )
);

-- Equipe da loja vê histórico
CREATE POLICY "Store team views history"
ON public.courier_location_history
FOR SELECT TO authenticated
USING (
  public.is_store_owner(store_id, auth.uid())
  OR public.can_access_section(store_id, auth.uid(), 'orders')
);

-- 2) Configurações por loja
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS courier_gps_alert_min integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS courier_gps_reassign_min integer NOT NULL DEFAULT 10;

-- 3) Função para reatribuir (liberar) entregadores com GPS parado
CREATE OR REPLACE FUNCTION public.reassign_stale_courier_orders(_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _alert_min integer;
  _reassign_min integer;
  _row record;
  _count integer := 0;
BEGIN
  SELECT (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')),
         COALESCE(s.courier_gps_alert_min, 5),
         COALESCE(s.courier_gps_reassign_min, 10)
    INTO _is_owner, _alert_min, _reassign_min
  FROM public.stores s WHERE s.id = _store_id;

  IF NOT COALESCE(_is_owner, false)
     AND NOT public.can_access_section(_store_id, auth.uid(), 'orders') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR _row IN
    SELECT o.id AS order_id, o.courier_id, cl.updated_at
    FROM public.orders o
    LEFT JOIN public.courier_locations cl ON cl.courier_id = o.courier_id
    WHERE o.store_id = _store_id
      AND o.status = 'out_for_delivery'
      AND o.courier_id IS NOT NULL
      AND (cl.updated_at IS NULL OR cl.updated_at < now() - (_reassign_min || ' minutes')::interval)
  LOOP
    UPDATE public.orders
       SET courier_id = NULL,
           status = 'ready',
           updated_at = now()
     WHERE id = _row.order_id;

    INSERT INTO public.notifications (user_id, store_id, title, message, type, link)
    SELECT s.owner_id, _store_id,
           '⚠️ Entregador realocado',
           'Pedido #' || upper(substr(_row.order_id::text,1,6)) || ' devolvido à fila (GPS sem atualização).',
           'warning', '/admin'
    FROM public.stores s WHERE s.id = _store_id AND s.owner_id IS NOT NULL;

    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;