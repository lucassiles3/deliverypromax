
-- 1) Listing logos: remove overly permissive authenticated policies (keep manager-only)
DROP POLICY IF EXISTS "Authenticated can upload listing logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update listing logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete listing logos" ON storage.objects;

-- 2) Stores: hide sensitive columns from anon (chatbot + pix)
REVOKE SELECT (chatbot_qr_code, chatbot_n8n_webhook_url, chatbot_phone, chatbot_status, chatbot_connected_at, chatbot_qr_updated_at, pix_key) ON public.stores FROM anon;

-- 3) Tables: ensure qr_token never exposed publicly
REVOKE SELECT (qr_token) ON public.tables FROM anon, authenticated;

-- 4) fiscal_invoices: hide raw provider payload from any client role (service_role still has access)
REVOKE SELECT (raw_response) ON public.fiscal_invoices FROM anon, authenticated;

-- 5) payment_transactions: hide raw provider payloads from any client role
REVOKE SELECT (raw_response, raw_webhook) ON public.payment_transactions FROM anon, authenticated;
