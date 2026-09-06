-- Migration FASE 2: Otimização de RPCs Geográficas com Bounding Box e Índices Compostos

-- 1. Otimização da RPC get_available_stores com pré-filtro Bounding Box
CREATE OR REPLACE FUNCTION public.get_available_stores(
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo text,
  cuisine text,
  categories text[],
  lat double precision,
  lng double precision,
  delivery_radius_km double precision,
  distance_km double precision,
  is_in_radius boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  lat_delta double precision;
  lng_delta double precision;
  cos_lat double precision;
BEGIN
  IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
    cos_lat := GREATEST(0.01, cos(radians(user_lat)));
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      s.id,
      s.name,
      s.slug,
      s.logo,
      s.cuisine,
      s.categories,
      s.lat,
      s.lng,
      s.delivery_radius_km,
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND s.lat IS NOT NULL AND s.lng IS NOT NULL
        THEN public.haversine_distance_km(user_lat, user_lng, s.lat, s.lng)
        ELSE NULL
      END AS calculated_distance
    FROM public.stores s
    WHERE s.open = true
      AND s.lifecycle_status = 'active'
      AND s.owner_id IS NOT NULL
      AND (
        user_lat IS NULL OR user_lng IS NULL OR (
          s.lat IS NOT NULL AND s.lng IS NOT NULL AND
          s.lat BETWEEN (user_lat - (COALESCE(s.delivery_radius_km, 10.0) / 111.0))
                    AND (user_lat + (COALESCE(s.delivery_radius_km, 10.0) / 111.0))
          AND s.lng BETWEEN (user_lng - (COALESCE(s.delivery_radius_km, 10.0) / (111.0 * cos_lat)))
                        AND (user_lng + (COALESCE(s.delivery_radius_km, 10.0) / (111.0 * cos_lat)))
        )
      )
  )
  SELECT
    c.id,
    c.name,
    c.slug,
    c.logo,
    c.cuisine,
    c.categories,
    c.lat,
    c.lng,
    c.delivery_radius_km,
    c.calculated_distance AS distance_km,
    CASE
      WHEN user_lat IS NULL OR user_lng IS NULL OR c.lat IS NULL OR c.lng IS NULL OR c.delivery_radius_km IS NULL THEN true
      WHEN c.calculated_distance <= c.delivery_radius_km THEN true
      ELSE false
    END AS is_in_radius
  FROM candidates c
  WHERE user_lat IS NULL OR user_lng IS NULL OR c.calculated_distance IS NULL OR c.calculated_distance <= c.delivery_radius_km;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_stores(double precision, double precision) TO anon, authenticated, service_role;


-- 2. Otimização da RPC get_available_external_listings com pré-filtro Bounding Box
CREATE OR REPLACE FUNCTION public.get_available_external_listings(
  user_lat double precision DEFAULT NULL,
  user_lng double precision DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  logo text,
  category_key text,
  subcategory_key text,
  catalog_url text,
  address text,
  lat double precision,
  lng double precision,
  delivery_radius_km double precision,
  distance_km double precision,
  is_in_radius boolean
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  cos_lat double precision;
BEGIN
  IF user_lat IS NOT NULL AND user_lng IS NOT NULL THEN
    cos_lat := GREATEST(0.01, cos(radians(user_lat)));
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      el.id,
      el.name,
      el.logo,
      el.category_key,
      el.subcategory_key,
      el.catalog_url,
      el.address,
      el.lat,
      el.lng,
      el.delivery_radius_km,
      CASE
        WHEN user_lat IS NOT NULL AND user_lng IS NOT NULL AND el.lat IS NOT NULL AND el.lng IS NOT NULL
        THEN public.haversine_distance_km(user_lat, user_lng, el.lat, el.lng)
        ELSE NULL
      END AS calculated_distance
    FROM public.external_listings el
    WHERE el.active = true
      AND (
        user_lat IS NULL OR user_lng IS NULL OR (
          el.lat IS NOT NULL AND el.lng IS NOT NULL AND
          el.lat BETWEEN (user_lat - (COALESCE(el.delivery_radius_km, 10.0) / 111.0))
                    AND (user_lat + (COALESCE(el.delivery_radius_km, 10.0) / 111.0))
          AND el.lng BETWEEN (user_lng - (COALESCE(el.delivery_radius_km, 10.0) / (111.0 * cos_lat)))
                        AND (user_lng + (COALESCE(el.delivery_radius_km, 10.0) / (111.0 * cos_lat)))
        )
      )
  )
  SELECT
    c.id,
    c.name,
    c.logo,
    c.category_key,
    c.subcategory_key,
    c.catalog_url,
    c.address,
    c.lat,
    c.lng,
    c.delivery_radius_km,
    c.calculated_distance AS distance_km,
    CASE
      WHEN user_lat IS NULL OR user_lng IS NULL OR c.lat IS NULL OR c.lng IS NULL OR c.delivery_radius_km IS NULL THEN true
      WHEN c.calculated_distance <= c.delivery_radius_km THEN true
      ELSE false
    END AS is_in_radius
  FROM candidates c
  WHERE user_lat IS NULL OR user_lng IS NULL OR c.calculated_distance IS NULL OR c.calculated_distance <= c.delivery_radius_km;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_external_listings(double precision, double precision) TO anon, authenticated, service_role;


-- 3. Índices compostos de suporte
CREATE INDEX IF NOT EXISTS idx_stores_lat_lng ON public.stores(lat, lng) WHERE open = true AND lifecycle_status = 'active';
CREATE INDEX IF NOT EXISTS idx_ext_listings_lat_lng ON public.external_listings(lat, lng) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON public.orders(store_id, status);
