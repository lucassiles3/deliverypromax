
-- 1) Restrict storage.objects SELECT on public buckets to owners/admins only
-- Public URLs still work (CDN bypasses RLS for public buckets); this only blocks listing.
DROP POLICY IF EXISTS "Product images public read" ON storage.objects;
DROP POLICY IF EXISTS "Store assets public read" ON storage.objects;
DROP POLICY IF EXISTS "Listing logos public read" ON storage.objects;
DROP POLICY IF EXISTS "Home banners public read storage" ON storage.objects;

CREATE POLICY "Product images owner list"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_store_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Store assets owner list"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'store-assets'
  AND public.is_store_owner(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE POLICY "Listing logos manager list"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listing-logos'
  AND public.is_listings_manager(auth.uid())
);

CREATE POLICY "Home banners admin list"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'home-banners'
  AND public.has_role(auth.uid(), 'super_admin'::app_role)
);

-- 2) Tighten external_listing_visits INSERT: must reference an active listing
DROP POLICY IF EXISTS "Anyone can record a visit" ON public.external_listing_visits;

CREATE POLICY "Anyone records visit on active listing"
ON public.external_listing_visits FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.external_listings l
    WHERE l.id = external_listing_visits.listing_id AND l.active = true
  )
  AND (user_id IS NULL OR user_id = auth.uid())
);

-- 3) Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER functions
--    (triggers, cron jobs, and webhook dispatchers — not meant to be called by clients).
--    RLS-helper and RPC functions remain executable.
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'handle_new_user()',
    'grant_super_admin_if_master_email()',
    'log_order_status_change()',
    'prevent_blocked_order()',
    'dispatch_order_webhook()',
    'apply_order_loyalty()',
    'award_order_points(uuid)',
    'recalc_table_session(uuid)',
    'register_stock_movement(uuid, uuid, integer, text, uuid, text)',
    'reassign_stale_courier_orders()',
    'run_birthday_campaign()',
    'run_reactivation_campaign()',
    'generate_weekly_payouts()',
    'accept_pending_invites()',
    'tg_new_store_subscription()',
    'tg_notify_customer_order_status()',
    'tg_notify_customer_request()',
    'tg_orders_stock_sync()',
    'tg_pickup_ready_handler()',
    'tg_pix_session_paid()',
    'tg_recalc_product_rating()',
    'tg_recalc_session_after_item()',
    'tg_recalc_store_rating()',
    'tg_session_table_status()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon, authenticated, public', fn);
    EXCEPTION WHEN undefined_function OR invalid_function_definition THEN
      -- skip if signature doesn't match
      NULL;
    END;
  END LOOP;
END $$;
