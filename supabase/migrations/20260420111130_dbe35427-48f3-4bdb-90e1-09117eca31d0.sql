
ALTER TABLE public.user_addresses
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS reference TEXT;

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON public.user_addresses(user_id, is_default DESC, created_at DESC);
