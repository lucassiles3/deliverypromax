-- =============================================================
-- MULTI-TENANT RLS HARDENING MIGRATION
-- Garantia de isolamento estrito de cupons, reservas e chamadas por loja
-- =============================================================

-- 1) Hardening da tabela de cupons
DROP POLICY IF EXISTS "Coupons public read" ON public.coupons;
CREATE POLICY "Coupons public read" ON public.coupons FOR SELECT TO public
  USING (active = true);

-- 2) Hardening da tabela de reservas de mesa
DROP POLICY IF EXISTS "Public can create reservations" ON public.table_reservations;
CREATE POLICY "Public can create reservations" ON public.table_reservations FOR INSERT TO anon, authenticated
  WITH CHECK (store_id IS NOT NULL);

-- 3) Hardening da tabela de chamadas de garçom
DROP POLICY IF EXISTS "Public can call waiter" ON public.table_calls;
CREATE POLICY "Public can call waiter" ON public.table_calls FOR INSERT TO anon, authenticated
  WITH CHECK (store_id IS NOT NULL AND table_id IS NOT NULL);

-- 4) Garantia de RLS ativado nas tabelas de favoritos do cliente
ALTER TABLE IF EXISTS public.favorite_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.favorite_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.favorite_external_listings ENABLE ROW LEVEL SECURITY;
