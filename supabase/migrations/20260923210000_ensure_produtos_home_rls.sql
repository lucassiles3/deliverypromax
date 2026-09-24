-- Migration: Ensure RLS SELECT policies for produtos_home, "produtos home", and home_products tables
DO $$
BEGIN
  -- 1. produtos_home
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produtos_home') THEN
    ALTER TABLE public.produtos_home ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select produtos_home" ON public.produtos_home;
    CREATE POLICY "Public select produtos_home" ON public.produtos_home FOR SELECT USING (true);
    GRANT SELECT ON public.produtos_home TO anon, authenticated;
  END IF;

  -- 2. "produtos home" (table name with space)
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'produtos home') THEN
    EXECUTE 'ALTER TABLE public."produtos home" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Public select produtos home" ON public."produtos home"';
    EXECUTE 'CREATE POLICY "Public select produtos home" ON public."produtos home" FOR SELECT USING (true)';
    EXECUTE 'GRANT SELECT ON public."produtos home" TO anon, authenticated';
  END IF;

  -- 3. home_products
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'home_products') THEN
    ALTER TABLE public.home_products ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public select home_products" ON public.home_products;
    CREATE POLICY "Public select home_products" ON public.home_products FOR SELECT USING (true);
    GRANT SELECT ON public.home_products TO anon, authenticated;
  END IF;
END $$;
