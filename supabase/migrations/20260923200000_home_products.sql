-- Migration: Create home_products table for featured home products showcase
CREATE TABLE IF NOT EXISTS public.home_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text NOT NULL,
  store_name text NOT NULL,
  segment text,
  promo_price numeric(10,2) NOT NULL,
  old_price numeric(10,2),
  description text,
  product_link text NOT NULL,
  image_url text,
  active boolean DEFAULT true,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for fast paginated queries with range filtering
CREATE INDEX IF NOT EXISTS idx_home_products_active_position 
ON public.home_products (active, position ASC, created_at DESC);

-- Enable Row-Level Security
ALTER TABLE public.home_products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to active home products
DROP POLICY IF EXISTS "Public read active home_products" ON public.home_products;
CREATE POLICY "Public read active home_products"
ON public.home_products FOR SELECT
USING (active = true);

-- Allow authenticated admins / listings managers to insert/update/delete home products
DROP POLICY IF EXISTS "Admins manage home_products" ON public.home_products;
CREATE POLICY "Admins manage home_products"
ON public.home_products FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_listings_manager(auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'super_admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.is_listings_manager(auth.uid())
);

