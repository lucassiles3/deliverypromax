CREATE OR REPLACE FUNCTION public.auto_toggle_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.track_stock THEN
    IF COALESCE(NEW.stock, 0) <= 0 AND OLD.active = true THEN
      NEW.active := false;
    ELSIF COALESCE(NEW.stock, 0) > 0 AND OLD.active = false AND COALESCE(OLD.stock, 0) <= 0 THEN
      NEW.active := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_auto_stock ON public.products;
CREATE TRIGGER products_auto_stock
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.auto_toggle_stock();