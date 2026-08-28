ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS infinitepay_redirect_url text,
  ADD COLUMN IF NOT EXISTS infinitepay_webhook_url text;