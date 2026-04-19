-- 1) Tabela de categorias por loja
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_store ON public.categories(store_id, position);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories public read"
  ON public.categories FOR SELECT
  USING (active = true);

CREATE POLICY "Owner manages categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = categories.store_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id = categories.store_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Novos campos em products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS prep_time_min INTEGER,
  ADD COLUMN IF NOT EXISTS promo_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_new BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products(archived_at);

-- Atualiza policy pública para esconder arquivados
DROP POLICY IF EXISTS "Products public read" ON public.products;
CREATE POLICY "Products public read"
  ON public.products FOR SELECT
  USING (active = true AND archived_at IS NULL);

-- 3) min_select em addon_groups
ALTER TABLE public.addon_groups
  ADD COLUMN IF NOT EXISTS min_select INTEGER NOT NULL DEFAULT 0;