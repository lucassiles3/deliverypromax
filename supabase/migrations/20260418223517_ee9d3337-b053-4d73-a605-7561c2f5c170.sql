
-- ============================================
-- ROLES (admin/store_owner/customer) — separate table to avoid privilege escalation
-- ============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'store_owner', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE POLICY "Users view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- Reusable timestamp trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- PROFILES (customer data)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile + assign default 'customer' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'phone'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_loyalty (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================
-- ADDRESSES (saved customer addresses)
-- ============================================
CREATE TABLE public.user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT,
  cep TEXT NOT NULL,
  street TEXT NOT NULL,
  number TEXT NOT NULL,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON public.user_addresses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================
-- LOYALTY (cashback per user)
-- ============================================
CREATE TABLE public.user_loyalty (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cashback NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own loyalty" ON public.user_loyalty
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- writes happen only via SECURITY DEFINER functions (no direct insert/update policy)

CREATE TRIGGER trg_loyalty_updated_at
  BEFORE UPDATE ON public.user_loyalty
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- now create the auth user trigger (after user_loyalty exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORES
-- ============================================
CREATE TABLE public.stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  cuisine TEXT,
  logo TEXT,
  cover_url TEXT,
  city TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  reviews INT DEFAULT 0,
  delivery_time TEXT DEFAULT '30-45 min',
  delivery_fee NUMERIC(10,2) DEFAULT 0,
  free_shipping_threshold NUMERIC(10,2) DEFAULT 50,
  min_order NUMERIC(10,2) DEFAULT 0,
  open BOOLEAN NOT NULL DEFAULT true,
  promo TEXT,
  categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stores public read" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Owner manages own store" ON public.stores
  FOR ALL TO authenticated
  USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  old_price NUMERIC(10,2),
  image_url TEXT,
  category TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  reviews INT DEFAULT 0,
  bestseller BOOLEAN NOT NULL DEFAULT false,
  promo BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products public read" ON public.products FOR SELECT USING (active = true);
CREATE POLICY "Owner manages own products" ON public.products
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id
            AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_products_category ON public.products(store_id, category);

-- ============================================
-- ADDONS
-- ============================================
CREATE TYPE public.addon_type AS ENUM ('single', 'multi');

CREATE TABLE public.addon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.addon_type NOT NULL DEFAULT 'single',
  required BOOLEAN NOT NULL DEFAULT false,
  max_select INT,
  position INT DEFAULT 0
);
ALTER TABLE public.addon_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Addon groups public read" ON public.addon_groups FOR SELECT USING (true);
CREATE POLICY "Owner manages addon groups" ON public.addon_groups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = addon_groups.product_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = addon_groups.product_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE TABLE public.addon_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.addon_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  position INT DEFAULT 0
);
ALTER TABLE public.addon_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Addon options public read" ON public.addon_options FOR SELECT USING (true);
CREATE POLICY "Owner manages addon options" ON public.addon_options
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.addon_groups g
      JOIN public.products p ON p.id = g.product_id
      JOIN public.stores s ON s.id = p.store_id
      WHERE g.id = addon_options.group_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.addon_groups g
      JOIN public.products p ON p.id = g.product_id
      JOIN public.stores s ON s.id = p.store_id
      WHERE g.id = addon_options.group_id
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- ============================================
-- COUPONS
-- ============================================
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed', 'free_shipping');

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  type public.coupon_type NOT NULL,
  value NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_order NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coupons public read" ON public.coupons
  FOR SELECT USING (active = true AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY "Owner manages coupons" ON public.coupons
  FOR ALL TO authenticated
  USING (
    store_id IS NULL AND public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = coupons.store_id
               AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  )
  WITH CHECK (
    store_id IS NULL AND public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = coupons.store_id
               AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );

-- ============================================
-- ORDERS
-- ============================================
CREATE TYPE public.order_status AS ENUM ('pending_payment', 'received', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE public.delivery_method AS ENUM ('delivery', 'pickup');

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  method public.delivery_method NOT NULL DEFAULT 'delivery',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address JSONB,
  subtotal NUMERIC(10,2) NOT NULL,
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code TEXT,
  coupon_discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  cashback_used NUMERIC(10,2) NOT NULL DEFAULT 0,
  cashback_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Customers create own orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner views store orders" ON public.orders
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Owner updates store orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_orders_store_status ON public.orders(store_id, status, created_at DESC);
CREATE INDEX idx_orders_user ON public.orders(user_id, created_at DESC);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  customizations JSONB DEFAULT '[]'::jsonb,
  notes TEXT
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Items follow order — customer" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));
CREATE POLICY "Items follow order — owner" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id
      AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
CREATE POLICY "Customer creates own items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid()));

-- ============================================
-- LOYALTY APPLY (security definer — only callable by authenticated user for self)
-- ============================================
CREATE OR REPLACE FUNCTION public.apply_order_loyalty(
  _order_total NUMERIC,
  _cashback_used NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _earned NUMERIC;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  _earned := ROUND(GREATEST(0, _order_total - _cashback_used) * 0.05, 2);

  INSERT INTO public.user_loyalty (user_id, cashback, total_spent, orders_count)
  VALUES (_uid, _earned, _order_total, 1)
  ON CONFLICT (user_id) DO UPDATE SET
    cashback = GREATEST(0, public.user_loyalty.cashback - _cashback_used) + _earned,
    total_spent = public.user_loyalty.total_spent + _order_total,
    orders_count = public.user_loyalty.orders_count + 1,
    updated_at = now();

  RETURN _earned;
END;
$$;

-- ============================================
-- SEED: 4 demo stores + products + addons + coupons
-- ============================================
DO $$
DECLARE
  s1 UUID; s2 UUID; s3 UUID; s4 UUID;
  p_id UUID; g_id UUID;
BEGIN
  -- Burger Fire
  INSERT INTO public.stores (slug, name, tagline, cuisine, logo, city, rating, reviews,
    delivery_time, delivery_fee, free_shipping_threshold, min_order, promo, categories)
  VALUES ('burger-fire', 'Burger Fire', 'Smash burgers artesanais', 'Hambúrgueres', '🔥', 'São Paulo',
    4.9, 2847, '25-35 min', 6.9, 50, 20, '20% OFF no primeiro pedido',
    ARRAY['Mais vendidos','Burgers','Acompanhamentos','Bebidas','Sobremesas'])
  RETURNING id INTO s1;

  INSERT INTO public.products (store_id, name, description, price, old_price, category, rating, reviews, bestseller, promo, position)
  VALUES (s1, 'Smash Bacon Duplo', 'Dois smash burgers, bacon crocante, cheddar derretido e molho da casa', 32.9, 42.9, 'Mais vendidos', 4.9, 1240, true, true, 1)
  RETURNING id INTO p_id;
    INSERT INTO public.addon_groups (product_id, name, type, required, position) VALUES (p_id, 'Escolha o tamanho', 'single', true, 1) RETURNING id INTO g_id;
      INSERT INTO public.addon_options (group_id, name, price, position) VALUES
        (g_id, 'Simples (1 carne)', 0, 1), (g_id, 'Duplo (2 carnes)', 8, 2), (g_id, 'Triplo (3 carnes)', 14, 3);
    INSERT INTO public.addon_groups (product_id, name, type, required, max_select, position) VALUES (p_id, 'Adicionais', 'multi', false, 5, 2) RETURNING id INTO g_id;
      INSERT INTO public.addon_options (group_id, name, price, position) VALUES
        (g_id, 'Bacon extra', 4.5, 1), (g_id, 'Cheddar extra', 3.5, 2), (g_id, 'Ovo', 3, 3), (g_id, 'Cebola caramelizada', 2.5, 4);
    INSERT INTO public.addon_groups (product_id, name, type, position) VALUES (p_id, 'Adicione uma bebida (+R$5)', 'single', 3) RETURNING id INTO g_id;
      INSERT INTO public.addon_options (group_id, name, price, position) VALUES
        (g_id, 'Não, obrigado', 0, 1), (g_id, 'Coca-Cola Lata', 5, 2), (g_id, 'Guaraná Lata', 5, 3);

  INSERT INTO public.products (store_id, name, description, price, category, rating, reviews, position) VALUES
    (s1, 'Cheese Clássico', 'Burger 160g, cheddar, alface, tomate e maionese verde', 24.9, 'Burgers', 4.8, 890, 2),
    (s1, 'Fritas Crocantes', 'Batata rústica frita na hora, porção generosa', 14.9, 'Acompanhamentos', 4.9, 654, 3),
    (s1, 'Onion Rings', 'Anéis de cebola empanados, dourados e crocantes', 16.9, 'Acompanhamentos', 4.7, 312, 4),
    (s1, 'Coca-Cola Lata', '350ml geladinha', 6.9, 'Bebidas', 4.9, 980, 5),
    (s1, 'Petit Gâteau', 'Bolo quente de chocolate com sorvete de creme', 18.9, 'Sobremesas', 5.0, 421, 6);
  UPDATE public.products SET bestseller = true WHERE store_id = s1 AND name IN ('Fritas Crocantes', 'Petit Gâteau');

  -- Pizza Nova
  INSERT INTO public.stores (slug, name, tagline, cuisine, logo, city, rating, reviews,
    delivery_time, delivery_fee, free_shipping_threshold, min_order, promo, categories)
  VALUES ('pizza-nova', 'Pizza Nova', 'Pizzas artesanais forno a lenha', 'Pizzaria', '🍕', 'São Paulo',
    4.8, 1932, '35-50 min', 8.9, 70, 30, 'Pizza grande + refri por R$59',
    ARRAY['Mais vendidos','Pizzas Salgadas','Pizzas Doces','Bebidas','Sobremesas'])
  RETURNING id INTO s2;

  INSERT INTO public.products (store_id, name, description, price, old_price, category, rating, reviews, bestseller, promo, position)
  VALUES (s2, 'Pepperoni Especial', 'Molho artesanal, mussarela de búfala, pepperoni importado e manjericão', 64.9, 79.9, 'Mais vendidos', 4.9, 1502, true, true, 1)
  RETURNING id INTO p_id;
    INSERT INTO public.addon_groups (product_id, name, type, required, position) VALUES (p_id, 'Tamanho da pizza', 'single', true, 1) RETURNING id INTO g_id;
      INSERT INTO public.addon_options (group_id, name, price, position) VALUES
        (g_id, 'Média (6 fatias)', 0, 1), (g_id, 'Grande (8 fatias)', 12, 2), (g_id, 'Família (12 fatias)', 22, 3);
    INSERT INTO public.addon_groups (product_id, name, type, position) VALUES (p_id, 'Borda recheada', 'single', 2) RETURNING id INTO g_id;
      INSERT INTO public.addon_options (group_id, name, price, position) VALUES
        (g_id, 'Sem borda', 0, 1), (g_id, 'Catupiry', 8, 2), (g_id, 'Cheddar', 8, 3);

  INSERT INTO public.products (store_id, name, description, price, category, rating, reviews, position) VALUES
    (s2, 'Margherita', 'Molho de tomate San Marzano, mussarela fresca e manjericão', 54.9, 'Pizzas Salgadas', 4.8, 845, 2),
    (s2, 'Quatro Queijos', 'Mussarela, gorgonzola, parmesão e provolone', 62.9, 'Pizzas Salgadas', 4.7, 612, 3),
    (s2, 'Chocolate com Morango', 'Chocolate ao leite, morangos frescos e leite condensado', 49.9, 'Pizzas Doces', 4.9, 380, 4),
    (s2, 'Coca-Cola 2L', 'Garrafa 2 litros gelada', 14.9, 'Bebidas', 4.9, 720, 5);
  UPDATE public.products SET bestseller = true WHERE store_id = s2 AND name = 'Chocolate com Morango';

  -- Sushi Zen
  INSERT INTO public.stores (slug, name, tagline, cuisine, logo, city, rating, reviews,
    delivery_time, delivery_fee, free_shipping_threshold, min_order, promo, categories)
  VALUES ('sushi-zen', 'Sushi Zen', 'Sushi premium delivery', 'Japonesa', '🍣', 'São Paulo',
    4.9, 1245, '40-55 min', 9.9, 80, 40, 'Combo 30 peças + temaki grátis',
    ARRAY['Mais vendidos','Combinados','Sashimis','Bebidas'])
  RETURNING id INTO s3;
  INSERT INTO public.products (store_id, name, description, price, old_price, category, rating, reviews, bestseller, promo, position) VALUES
    (s3, 'Combinado Zen 30 peças', 'Sashimi, niguiri, uramaki e hot roll de salmão', 119.9, 149.9, 'Mais vendidos', 4.9, 890, true, true, 1),
    (s3, 'Sashimi de Salmão (10un)', 'Fatias generosas de salmão fresco', 54.9, NULL, 'Sashimis', 4.9, 654, true, false, 2),
    (s3, 'Combinado Mini 12 peças', 'Variado de salmão e atum', 49.9, NULL, 'Combinados', 4.7, 432, false, false, 3),
    (s3, 'Coca-Cola Lata', '350ml gelada', 7.9, NULL, 'Bebidas', 4.8, 280, false, false, 4);

  -- Doce Mania
  INSERT INTO public.stores (slug, name, tagline, cuisine, logo, city, rating, reviews,
    delivery_time, delivery_fee, free_shipping_threshold, min_order, promo, categories)
  VALUES ('doce-mania', 'Doce Mania', 'Sobremesas que viciam', 'Sobremesas', '🍰', 'São Paulo',
    4.9, 832, '20-30 min', 5.9, 40, 15, 'Compre 2, leve 3 brownies',
    ARRAY['Mais vendidos','Bolos','Brownies','Bebidas'])
  RETURNING id INTO s4;
  INSERT INTO public.products (store_id, name, description, price, category, rating, reviews, bestseller, position) VALUES
    (s4, 'Petit Gâteau Premium', 'Quente com sorvete de baunilha', 22.9, 'Mais vendidos', 5.0, 612, true, 1),
    (s4, 'Brownie Duplo Chocolate', 'Cremoso por dentro, crocante por fora', 14.9, 'Brownies', 4.9, 421, false, 2);

  -- Global coupons (no store_id)
  INSERT INTO public.coupons (code, label, type, value, min_order) VALUES
    ('BEMVINDO20', '20% OFF — boas-vindas', 'percent', 20, NULL),
    ('FRETEGRATIS', 'Frete grátis (qualquer valor)', 'free_shipping', 0, NULL),
    ('FOME10', 'R$10 OFF acima de R$40', 'fixed', 10, 40);
END $$;
