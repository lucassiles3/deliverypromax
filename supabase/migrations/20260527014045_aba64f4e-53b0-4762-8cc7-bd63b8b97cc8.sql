
-- Allow authenticated users to create and manage their own external_listings entries
CREATE POLICY "Users manage their own external listings"
ON public.external_listings
FOR ALL
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Allow authenticated users to upload/manage their own logos in the listing-logos bucket
CREATE POLICY "Authenticated can upload listing logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-logos');

CREATE POLICY "Authenticated can update listing logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'listing-logos');

CREATE POLICY "Authenticated can delete listing logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'listing-logos');
