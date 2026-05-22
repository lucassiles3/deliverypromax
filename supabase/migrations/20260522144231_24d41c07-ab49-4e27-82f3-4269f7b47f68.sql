
CREATE TABLE public.favorite_external_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX idx_fel_user ON public.favorite_external_listings (user_id);

ALTER TABLE public.favorite_external_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorite listings"
ON public.favorite_external_listings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_external_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.favorite_stores;
