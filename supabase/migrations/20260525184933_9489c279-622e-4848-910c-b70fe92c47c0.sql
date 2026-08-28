DROP POLICY IF EXISTS "Public reads pix transaction" ON public.payment_transactions;

DROP POLICY IF EXISTS "platform logs insert by service" ON public.platform_logs;

DROP POLICY IF EXISTS "Authenticated upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete product images" ON storage.objects;

CREATE POLICY "Store owners upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_store_owner(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Store owners update product images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_store_owner(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_store_owner(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Store owners delete product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_store_owner(
    NULLIF((storage.foldername(name))[1], '')::uuid,
    auth.uid()
  )
);

DROP POLICY IF EXISTS "Public can call waiter" ON public.table_calls;
CREATE POLICY "Public can call waiter"
ON public.table_calls FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tables t
    JOIN public.table_sessions s
      ON s.table_id = t.id AND s.status = 'open'
    WHERE t.id = table_calls.table_id
      AND t.store_id = table_calls.store_id
  )
);

DROP POLICY IF EXISTS "Public can create reservations" ON public.table_reservations;
CREATE POLICY "Public can create reservations"
ON public.table_reservations FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores st
    WHERE st.id = table_reservations.store_id
      AND st.lifecycle_status = 'active'
  )
);
