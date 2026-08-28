-- Add new fields to external_listings
ALTER TABLE public.external_listings
  ADD COLUMN IF NOT EXISTS delivery_time text,
  ADD COLUMN IF NOT EXISTS delivery_radius_km numeric;

-- Create public bucket for partner logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-logos', 'listing-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Listing logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-logos');

CREATE POLICY "Listings manager uploads logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-logos' AND public.is_listings_manager(auth.uid()));

CREATE POLICY "Listings manager updates logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-logos' AND public.is_listings_manager(auth.uid()));

CREATE POLICY "Listings manager deletes logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-logos' AND public.is_listings_manager(auth.uid()));