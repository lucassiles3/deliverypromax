
CREATE TABLE public.external_listing_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_elv_listing_created ON public.external_listing_visits (listing_id, created_at DESC);
CREATE INDEX idx_elv_created ON public.external_listing_visits (created_at DESC);

ALTER TABLE public.external_listing_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a visit"
ON public.external_listing_visits
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Listings manager views visits"
ON public.external_listing_visits
FOR SELECT
TO authenticated
USING (public.is_listings_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.top_visited_listings(_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid,
  name text,
  logo text,
  catalog_url text,
  category_key text,
  visits bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.name, l.logo, l.catalog_url, l.category_key, COUNT(v.id) AS visits
  FROM public.external_listings l
  LEFT JOIN public.external_listing_visits v
    ON v.listing_id = l.id
   AND v.created_at >= date_trunc('month', now())
  WHERE l.active = true
  GROUP BY l.id
  HAVING COUNT(v.id) > 0
  ORDER BY visits DESC, l.name ASC
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.top_visited_listings(int) TO anon, authenticated;
