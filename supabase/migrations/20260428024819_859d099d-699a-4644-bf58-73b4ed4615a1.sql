-- Fix store-assets storage policies: use object name (not store name) and allow staff with section access
DROP POLICY IF EXISTS "Store owner uploads assets" ON storage.objects;
DROP POLICY IF EXISTS "Store owner updates assets" ON storage.objects;
DROP POLICY IF EXISTS "Store owner deletes assets" ON storage.objects;

CREATE POLICY "Store owner uploads assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'store-assets'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (s.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.can_access_section(s.id, auth.uid(), 'settings')
           OR public.can_access_section(s.id, auth.uid(), 'store'))
  )
);

CREATE POLICY "Store owner updates assets"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (s.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.can_access_section(s.id, auth.uid(), 'settings')
           OR public.can_access_section(s.id, auth.uid(), 'store'))
  )
);

CREATE POLICY "Store owner deletes assets"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'store-assets'
  AND EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id::text = (storage.foldername(name))[1]
      AND (s.owner_id = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.can_access_section(s.id, auth.uid(), 'settings')
           OR public.can_access_section(s.id, auth.uid(), 'store'))
  )
);