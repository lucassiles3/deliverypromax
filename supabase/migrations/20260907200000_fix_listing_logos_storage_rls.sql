-- Fix storage policies for listing-logos bucket to allow all authenticated users to upload and manage logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-logos', 'listing-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop legacy/restrictive storage policies on listing-logos
DROP POLICY IF EXISTS "Listings manager uploads logos" ON storage.objects;
DROP POLICY IF EXISTS "Listings manager updates logos" ON storage.objects;
DROP POLICY IF EXISTS "Listings manager deletes logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload listing logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update listing logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete listing logos" ON storage.objects;
DROP POLICY IF EXISTS "Listing logos public read" ON storage.objects;

-- 1. Public read access for listing-logos
CREATE POLICY "Listing logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-logos');

-- 2. Authenticated upload access for listing-logos
CREATE POLICY "Authenticated can upload listing logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-logos');

-- 3. Authenticated update access for listing-logos
CREATE POLICY "Authenticated can update listing logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-logos')
WITH CHECK (bucket_id = 'listing-logos');

-- 4. Authenticated delete access for listing-logos
CREATE POLICY "Authenticated can delete listing logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'listing-logos');
