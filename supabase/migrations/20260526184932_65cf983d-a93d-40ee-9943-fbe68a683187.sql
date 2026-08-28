REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, name, description, price, old_price, image_url, category,
  rating, reviews, bestseller, promo, active, position, created_at, updated_at,
  stock, track_stock, prep_time_min, promo_starts_at, promo_ends_at, is_new,
  archived_at, category_id, is_combo, available_from, available_to,
  flash_promo, flash_discount_percent, sku, barcode, brand, unit
) ON public.products TO anon;

REVOKE SELECT ON public.tables FROM anon;
GRANT SELECT (
  id, store_id, sector_id, number, name, capacity, status, notes,
  position_x, position_y, position, active, created_at, updated_at
) ON public.tables TO anon;
