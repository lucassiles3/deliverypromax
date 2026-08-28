
-- 1) Stores: novos campos
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address_cep TEXT,
  ADD COLUMN IF NOT EXISTS address_street TEXT,
  ADD COLUMN IF NOT EXISTS address_number TEXT,
  ADD COLUMN IF NOT EXISTS address_complement TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'radius', -- 'radius' | 'neighborhoods'
  ADD COLUMN IF NOT EXISTS delivery_radius_km NUMERIC DEFAULT 5,
  ADD COLUMN IF NOT EXISTS delivery_fee_per_km NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pickup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pickup_prep_time_min INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS courier_mode TEXT NOT NULL DEFAULT 'own', -- 'own' | 'marketplace'
  ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vacation_message TEXT,
  ADD COLUMN IF NOT EXISTS vacation_until DATE,
  ADD COLUMN IF NOT EXISTS max_orders_per_hour INTEGER,
  ADD COLUMN IF NOT EXISTS preorder_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pix_key TEXT;

-- 2) Holidays
CREATE TABLE IF NOT EXISTS public.store_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  closed BOOLEAN NOT NULL DEFAULT true,
  open_time TIME,
  close_time TIME,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, date)
);
ALTER TABLE public.store_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Holidays public read"
  ON public.store_holidays FOR SELECT TO public USING (true);

CREATE POLICY "Owner manages holidays"
  ON public.store_holidays FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_holidays.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_holidays.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- 3) Neighborhoods
CREATE TABLE IF NOT EXISTS public.store_neighborhoods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  fee NUMERIC NOT NULL DEFAULT 0,
  estimated_time_min INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.store_neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Neighborhoods public read"
  ON public.store_neighborhoods FOR SELECT TO public USING (active = true);

CREATE POLICY "Owner manages neighborhoods"
  ON public.store_neighborhoods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_neighborhoods.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_neighborhoods.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- 4) Payment methods config
CREATE TABLE IF NOT EXISTS public.store_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  method TEXT NOT NULL, -- 'pix_online','pix_delivery','credit_online','credit_delivery','debit_delivery','cash'
  enabled BOOLEAN NOT NULL DEFAULT true,
  installments INTEGER DEFAULT 1,
  active_from TIME,
  active_to TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, method)
);
ALTER TABLE public.store_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment methods public read"
  ON public.store_payment_methods FOR SELECT TO public USING (true);

CREATE POLICY "Owner manages payment methods"
  ON public.store_payment_methods FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_payment_methods.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_payment_methods.store_id
                 AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- 5) Storage bucket para logo + capa
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-assets', 'store-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Store assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-assets');

CREATE POLICY "Store owner uploads assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
  );

CREATE POLICY "Store owner updates assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
  );

CREATE POLICY "Store owner deletes assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-assets'
    AND EXISTS (
      SELECT 1 FROM public.stores s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
  );
