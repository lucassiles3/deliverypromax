
-- Store reviews
CREATE TABLE public.store_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, user_id)
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store reviews public read" ON public.store_reviews FOR SELECT USING (true);
CREATE POLICY "User creates own store review" ON public.store_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid() AND o.status = 'delivered'
    )
  );
CREATE POLICY "User updates own store review" ON public.store_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User deletes own store review" ON public.store_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_store_reviews_store ON public.store_reviews(store_id);
CREATE INDEX idx_store_reviews_order ON public.store_reviews(order_id);

-- Product reviews
CREATE TABLE public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_item_id, user_id)
);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Product reviews public read" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "User creates own product review" ON public.product_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id AND o.user_id = auth.uid() AND o.status = 'delivered'
    )
  );
CREATE POLICY "User updates own product review" ON public.product_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User deletes own product review" ON public.product_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_product_reviews_product ON public.product_reviews(product_id);
CREATE INDEX idx_product_reviews_store ON public.product_reviews(store_id);

-- Updated at triggers
CREATE TRIGGER trg_store_reviews_updated BEFORE UPDATE ON public.store_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_product_reviews_updated BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recalc store rating
CREATE OR REPLACE FUNCTION public.tg_recalc_store_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _store_id UUID := COALESCE(NEW.store_id, OLD.store_id);
  _avg NUMERIC;
  _count INT;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*) INTO _avg, _count
  FROM public.store_reviews WHERE store_id = _store_id;
  UPDATE public.stores SET rating = COALESCE(_avg, 5.0), reviews = COALESCE(_count, 0)
  WHERE id = _store_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_recalc_store_rating
AFTER INSERT OR UPDATE OR DELETE ON public.store_reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_store_rating();

-- Recalc product rating
CREATE OR REPLACE FUNCTION public.tg_recalc_product_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
  _avg NUMERIC;
  _count INT;
BEGIN
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*) INTO _avg, _count
  FROM public.product_reviews WHERE product_id = _product_id;
  UPDATE public.products SET rating = COALESCE(_avg, 5.0), reviews = COALESCE(_count, 0)
  WHERE id = _product_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_recalc_product_rating
AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_product_rating();
