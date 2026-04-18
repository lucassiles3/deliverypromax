
-- Add payment method enum
DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('pix', 'cash', 'credit', 'debit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method public.payment_method NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS change_for numeric,
  ADD COLUMN IF NOT EXISTS delivery_lat numeric,
  ADD COLUMN IF NOT EXISTS delivery_lng numeric;
