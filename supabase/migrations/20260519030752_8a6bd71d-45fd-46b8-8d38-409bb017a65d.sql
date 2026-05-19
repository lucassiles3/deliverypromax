-- New delivery method: pickup by 3rd-party logistics app (uber/lalamove/99)
ALTER TYPE public.delivery_method ADD VALUE IF NOT EXISTS 'logistics';

-- Store toggle for the new method
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS logistics_pickup_enabled boolean NOT NULL DEFAULT false;

-- Courier tracking link pasted by the customer (for logistics method)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_tracking_url text,
  ADD COLUMN IF NOT EXISTS courier_tracking_notes text,
  ADD COLUMN IF NOT EXISTS courier_tracking_provider text;