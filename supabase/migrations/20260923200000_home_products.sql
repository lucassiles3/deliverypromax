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

-- Insert seed data if table is empty
INSERT INTO public.home_products (product_name, store_name, segment, promo_price, old_price, description, product_link, image_url, position)
SELECT * FROM (VALUES
  ('Burger Smash Duplo Bacon', 'Hamburgueria Artesanal', 'Lanches', 26.90, 34.90, 'Dois hamburgueres artesanais de 100g, queijo cheddar fatiado, bacon crocante e molho especial no pão brioche.', '/loja/hamburgueria-artesanal', 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80', 1),
  ('Pizza Combo Grande + Guaraná 2L', 'Pizzaria Bella Napoli', 'Pizzas', 49.90, 69.90, 'Pizza grande 8 fatias com até 2 sabores à sua escolha + Guaraná Antarctica 2L geladinho.', '/loja/pizzaria-bella-napoli', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80', 2),
  ('Açaí Especial 500ml + 3 Adicionais', 'Açaí Club Premium', 'Doces & Açai', 18.90, 24.90, 'Açaí puro cremoso com leite em pó, leite condensado, morango e banana picados.', '/loja/acai-club-premium', 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=600&auto=format&fit=crop&q=80', 3),
  ('Temaki Salmão Completo', 'Sushi Master Express', 'Japonesa', 22.90, 29.90, 'Temaki empanado recheado com salmão fresco, cream cheese, cebolinha e tarê especial.', '/loja/sushi-master-express', 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80', 4),
  ('Marmitex Executiva Picanha', 'Restaurante Sabor de Casa', 'Refeições', 28.50, 35.00, 'Tiras de picanha acebolada, arroz soltinho, feijão caseiro, farofa artesanal e salada fresca.', '/loja/restaurante-sabor-de-casa', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80', 5),
  ('Coxinha Gourmet Frango c/ Catupiry (6 unid)', 'Salgateria Real', 'Salgados', 15.90, 21.90, 'Coxinhas douradas e crocantes rechadas com frango desfiado temperado e requeijão cremoso.', '/loja/salgateria-real', 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&auto=format&fit=crop&q=80', 6),
  ('Milkshake Choco-Brownie 400ml', 'ChocoGelato Artesanal', 'Sobremesas', 16.90, 22.00, 'Batido com sorvete artesanal de chocolate belga, pedaços de brownie e calda quente de fudge.', '/loja/chocogelato-artesanal', 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80', 7),
  ('Combo Pastel Especial + Caldo de Cana', 'Pastelaria da Praça', 'Lanches', 19.90, 26.50, '1 Pastel gigante de carne com queijo bem recheado + 1 copo de 500ml de caldo de cana natural.', '/loja/pastelaria-da-praca', 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=600&auto=format&fit=crop&q=80', 8)
) AS v(product_name, store_name, segment, promo_price, old_price, description, product_link, image_url, position)
WHERE NOT EXISTS (SELECT 1 FROM public.home_products LIMIT 1);
