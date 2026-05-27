
-- 1) Biblioteca de adicionais por loja
CREATE TABLE IF NOT EXISTS public.addon_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  track_stock boolean NOT NULL DEFAULT false,
  stock integer,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_addon_items_store ON public.addon_items(store_id);

GRANT SELECT ON public.addon_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addon_items TO authenticated;
GRANT ALL ON public.addon_items TO service_role;

ALTER TABLE public.addon_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Addon items public read"
  ON public.addon_items FOR SELECT USING (true);
CREATE POLICY "Owner manages addon items"
  ON public.addon_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = addon_items.store_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = addon_items.store_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))));

CREATE TRIGGER update_addon_items_updated_at BEFORE UPDATE ON public.addon_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Grupos de adicionais agora podem pertencer à loja (reutilizáveis)
ALTER TABLE public.addon_groups ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE;
ALTER TABLE public.addon_groups ALTER COLUMN product_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_addon_groups_store ON public.addon_groups(store_id);

-- Preencher store_id para grupos legados a partir do produto
UPDATE public.addon_groups g
   SET store_id = p.store_id
  FROM public.products p
 WHERE g.product_id = p.id AND g.store_id IS NULL;

-- Atualizar policies de addon_groups para suportar grupos da loja
DROP POLICY IF EXISTS "Owner manages addon groups" ON public.addon_groups;
CREATE POLICY "Owner manages addon groups"
  ON public.addon_groups FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = addon_groups.store_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
               WHERE p.id = addon_groups.product_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = addon_groups.store_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)))
    OR EXISTS (SELECT 1 FROM public.products p JOIN public.stores s ON s.id = p.store_id
               WHERE p.id = addon_groups.product_id AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role)))
  );

-- 3) N:N grupo ↔ item da biblioteca
CREATE TABLE IF NOT EXISTS public.addon_group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.addon_items(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  price_override numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_addon_group_items_group ON public.addon_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_addon_group_items_item ON public.addon_group_items(item_id);

GRANT SELECT ON public.addon_group_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addon_group_items TO authenticated;
GRANT ALL ON public.addon_group_items TO service_role;

ALTER TABLE public.addon_group_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Addon group items public read"
  ON public.addon_group_items FOR SELECT USING (true);
CREATE POLICY "Owner manages addon group items"
  ON public.addon_group_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.addon_items i
    JOIN public.stores s ON s.id = i.store_id
    WHERE i.id = addon_group_items.item_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.addon_items i
    JOIN public.stores s ON s.id = i.store_id
    WHERE i.id = addon_group_items.item_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  ));

-- 4) N:N produto ↔ grupo
CREATE TABLE IF NOT EXISTS public.product_addon_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, group_id)
);
CREATE INDEX IF NOT EXISTS idx_product_addon_groups_product ON public.product_addon_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_product_addon_groups_group ON public.product_addon_groups(group_id);

GRANT SELECT ON public.product_addon_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_addon_groups TO authenticated;
GRANT ALL ON public.product_addon_groups TO service_role;

ALTER TABLE public.product_addon_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Product addon groups public read"
  ON public.product_addon_groups FOR SELECT USING (true);
CREATE POLICY "Owner manages product addon groups"
  ON public.product_addon_groups FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_addon_groups.product_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_addon_groups.product_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin'::app_role))
  ));

-- 5) Migrar dados legados: para cada addon_group antigo (com product_id), criar vínculo na tabela N:N
--    e converter cada addon_option em addon_item + addon_group_item (idempotente)
DO $$
DECLARE
  _g RECORD;
  _o RECORD;
  _item_id uuid;
  _store_id uuid;
BEGIN
  FOR _g IN SELECT id, product_id, store_id FROM public.addon_groups WHERE product_id IS NOT NULL LOOP
    _store_id := _g.store_id;
    IF _store_id IS NULL THEN
      SELECT store_id INTO _store_id FROM public.products WHERE id = _g.product_id;
      UPDATE public.addon_groups SET store_id = _store_id WHERE id = _g.id;
    END IF;

    -- Vincula grupo ao produto na nova tabela
    INSERT INTO public.product_addon_groups (product_id, group_id, position)
    VALUES (_g.product_id, _g.id, 0)
    ON CONFLICT DO NOTHING;

    -- Para cada opção legada, garante um item de biblioteca correspondente e vincula
    FOR _o IN SELECT id, name, price, position FROM public.addon_options WHERE group_id = _g.id LOOP
      -- procura por item existente com mesmo nome+preço para reaproveitar
      SELECT id INTO _item_id FROM public.addon_items
       WHERE store_id = _store_id AND name = _o.name AND price = _o.price
       LIMIT 1;
      IF _item_id IS NULL THEN
        INSERT INTO public.addon_items (store_id, name, price, position, active)
        VALUES (_store_id, _o.name, _o.price, COALESCE(_o.position,0), true)
        RETURNING id INTO _item_id;
      END IF;

      INSERT INTO public.addon_group_items (group_id, item_id, position)
      VALUES (_g.id, _item_id, COALESCE(_o.position,0))
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
