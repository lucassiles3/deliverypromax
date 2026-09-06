-- Migration: Delivery radius calculation and store/listing availability functions

-- 1. Function to calculate Haversine distance in kilometers between two coordinates
CREATE OR REPLACE FUNCTION public.haversine_distance_km(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r double precision := 6371.0; -- Earth radius in km
  dlat double precision;
  dlng double precision;
  a double precision;
  c double precision;
BEGIN
  IF lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN
    RETURN NULL;
  END IF;

  dlat := radians(lat2 - lat1);
  dlng := radians(lng2 - lng1);

  a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2.0)^2;
  c := 2.0 * atan2(sqrt(a), sqrt(1.0 - a));

  RETURN r * c;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.haversine_distance_km(double precision, double precision, double precision, double precision) TO anon, authenticated, service_role;

-- 2. Function to fetch available stores with distance calculation and radius check
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
BEGIN
  RETURN QUERY
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
    END AS distance_km,
    CASE
      WHEN user_lat IS NULL OR user_lng IS NULL OR s.lat IS NULL OR s.lng IS NULL OR s.delivery_radius_km IS NULL THEN true
      WHEN public.haversine_distance_km(user_lat, user_lng, s.lat, s.lng) <= s.delivery_radius_km THEN true
      ELSE false
    END AS is_in_radius
  FROM public.stores s
  WHERE s.open = true
    AND s.lifecycle_status = 'active'
    AND s.owner_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_stores(double precision, double precision) TO anon, authenticated, service_role;

-- 3. Function to fetch available external listings with distance calculation and radius check
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
BEGIN
  RETURN QUERY
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
    END AS distance_km,
    CASE
      WHEN user_lat IS NULL OR user_lng IS NULL OR el.lat IS NULL OR el.lng IS NULL OR el.delivery_radius_km IS NULL THEN true
      WHEN public.haversine_distance_km(user_lat, user_lng, el.lat, el.lng) <= el.delivery_radius_km THEN true
      ELSE false
    END AS is_in_radius
  FROM public.external_listings el
  WHERE el.active = true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_available_external_listings(double precision, double precision) TO anon, authenticated, service_role;
