
-- Add structured PIX info to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS pix_key_type text,
  ADD COLUMN IF NOT EXISTS pix_beneficiary_name text,
  ADD COLUMN IF NOT EXISTS pix_beneficiary_bank text,
  ADD COLUMN IF NOT EXISTS crypto_wallets jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_pix_key_type_chk
  CHECK (pix_key_type IS NULL OR pix_key_type IN ('cpf','cnpj','email','phone','random'));

-- Add crypto value to payment_method enum
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'crypto';
