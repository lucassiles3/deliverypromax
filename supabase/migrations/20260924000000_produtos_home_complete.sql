-- Complete migration to ensure produtos_home, "produtos home", and home_products tables exist with RLS SELECT access for anon and authenticated users
DO $$
BEGIN
  -- 1. Create public.produtos_home if not exists
  CREATE TABLE IF NOT EXISTS public.produtos_home (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_do_produto text,
    estabelecimento text,
    segmento text,
    promocao numeric(10,2),
    preco_antigo numeric(10,2),
    descricao text,
    link_do_produto text,
    link_da_imagem text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );

  -- Enable RLS and grant select
  ALTER TABLE public.produtos_home ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public select produtos_home" ON public.produtos_home;
  CREATE POLICY "Public select produtos_home" ON public.produtos_home FOR SELECT USING (true);
  GRANT SELECT ON public.produtos_home TO anon, authenticated;

  -- 2. Create public.home_products if not exists
  CREATE TABLE IF NOT EXISTS public.home_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name text,
    store_name text,
    segment text,
    promo_price numeric(10,2),
    old_price numeric(10,2),
    description text,
    product_link text,
    image_url text,
    active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );

  -- Enable RLS and grant select
  ALTER TABLE public.home_products ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public select home_products" ON public.home_products;
  CREATE POLICY "Public select home_products" ON public.home_products FOR SELECT USING (true);
  GRANT SELECT ON public.home_products TO anon, authenticated;

  -- 3. Grant select on "produtos home" if created with space in table name
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produtos home') THEN
    EXECUTE 'ALTER TABLE public."produtos home" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public select produtos home" ON public."produtos home"';
    EXECUTE 'CREATE POLICY "Public select produtos home" ON public."produtos home" FOR SELECT USING (true)';
    EXECUTE 'GRANT SELECT ON public."produtos home" TO anon, authenticated';
  END IF;
END $$;
