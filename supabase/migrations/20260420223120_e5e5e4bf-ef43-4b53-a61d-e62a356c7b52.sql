
CREATE OR REPLACE FUNCTION public.tg_notify_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_name TEXT;
  _short TEXT;
  _title TEXT;
  _msg TEXT;
  _type TEXT := 'info';
BEGIN
  -- Apenas quando muda o status e existe usuário logado dono do pedido
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT name INTO _store_name FROM public.stores WHERE id = NEW.store_id;
  _short := upper(substr(NEW.id::text, 1, 6));

  IF NEW.status = 'preparing' THEN
    _title := '👨‍🍳 Pedido aceito!';
    _msg := COALESCE(_store_name, 'A loja') || ' começou a preparar seu pedido #' || _short || '.';
    _type := 'success';
  ELSIF NEW.status = 'ready' THEN
    IF NEW.method = 'pickup' THEN
      _title := '✅ Pedido pronto para retirada';
      _msg := 'Seu pedido #' || _short || ' está pronto! Vá buscar em ' || COALESCE(_store_name, 'na loja') || '.';
    ELSE
      _title := '✅ Pedido pronto';
      _msg := 'Seu pedido #' || _short || ' está pronto e logo sairá para entrega.';
    END IF;
    _type := 'success';
  ELSIF NEW.status = 'out_for_delivery' THEN
    _title := '🛵 Saiu para entrega!';
    _msg := 'Seu pedido #' || _short || ' está a caminho. Fique de olho!';
    _type := 'success';
  ELSIF NEW.status = 'delivered' THEN
    _title := '🎉 Pedido entregue';
    _msg := 'Seu pedido #' || _short || ' foi entregue. Bom apetite!';
    _type := 'success';
  ELSIF NEW.status = 'cancelled' AND COALESCE(NEW.cancel_by::text, '') <> 'customer' THEN
    _title := '❌ Pedido cancelado';
    _msg := 'Seu pedido #' || _short || ' foi cancelado' ||
            CASE WHEN NEW.cancel_reason IS NOT NULL AND NEW.cancel_reason <> ''
                 THEN ': ' || NEW.cancel_reason ELSE '.' END;
    _type := 'warning';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, store_id, title, message, type, link, metadata)
  VALUES (
    NEW.user_id,
    NEW.store_id,
    _title,
    _msg,
    _type,
    '/meus-pedidos/' || NEW.id::text,
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_customer_order_status ON public.orders;
CREATE TRIGGER trg_notify_customer_order_status
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_notify_customer_order_status();
