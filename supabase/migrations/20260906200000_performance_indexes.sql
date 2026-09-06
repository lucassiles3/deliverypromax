-- Migration: High-performance non-blocking indexes for key queries

-- Orders table indexes
CREATE INDEX IF NOT EXISTS idx_orders_store_id ON public.orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON public.orders(store_id, status);

-- Order items table index
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- Products table indexes
CREATE INDEX IF NOT EXISTS idx_products_store_active ON public.products(store_id, active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);

-- Stores table indexes
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores(owner_id) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stores_coords ON public.stores(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- External listings table indexes
CREATE INDEX IF NOT EXISTS idx_external_listings_active ON public.external_listings(active);
CREATE INDEX IF NOT EXISTS idx_external_listings_coords ON public.external_listings(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- User addresses table index
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);

-- Categories table index
CREATE INDEX IF NOT EXISTS idx_categories_store_position ON public.categories(store_id, position);
