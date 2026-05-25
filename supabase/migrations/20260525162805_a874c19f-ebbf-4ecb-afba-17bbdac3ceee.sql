
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logistics_pickup_release_when_ready boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS logistics_pickup_notify_customer boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS logistics_pickup_require_code boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS logistics_pickup_require_confirm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS logistics_pickup_instructions text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code text,
  ADD COLUMN IF NOT EXISTS pickup_handler_user_id uuid,
  ADD COLUMN IF NOT EXISTS pickup_handler_name text,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at timestamptz;

CREATE OR REPLACE FUNCTION public.tg_pickup_ready_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  IF NEW.status = 'ready' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.pickup_code IS NULL THEN
      NEW.pickup_code := lpad((floor(random()*9000)+1000)::int::text, 4, '0');
    END IF;
    IF NEW.pickup_handler_user_id IS NULL AND auth.uid() IS NOT NULL THEN
      NEW.pickup_handler_user_id := auth.uid();
      SELECT COALESCE(sm.display_name, p.display_name)
        INTO _name
        FROM public.profiles p
        LEFT JOIN public.store_members sm
          ON sm.user_id = p.id AND sm.store_id = NEW.store_id
       WHERE p.id = auth.uid();
      NEW.pickup_handler_name := _name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_pickup_ready_handler ON public.orders;
CREATE TRIGGER orders_pickup_ready_handler
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_pickup_ready_handler();
