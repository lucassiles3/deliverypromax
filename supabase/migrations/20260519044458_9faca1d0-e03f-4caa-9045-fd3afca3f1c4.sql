
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS chatbot_phone text,
  ADD COLUMN IF NOT EXISTS chatbot_n8n_webhook_url text,
  ADD COLUMN IF NOT EXISTS chatbot_qr_code text,
  ADD COLUMN IF NOT EXISTS chatbot_status text DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS chatbot_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS chatbot_qr_updated_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.stores;
