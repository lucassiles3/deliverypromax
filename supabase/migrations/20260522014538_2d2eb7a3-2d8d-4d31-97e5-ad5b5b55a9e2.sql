
-- Tabela de estabelecimentos parceiros (apenas link externo para catálogo)
CREATE TABLE public.external_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  category_key TEXT NOT NULL,
  catalog_url TEXT NOT NULL,
  address TEXT,
  lat NUMERIC,
  lng NUMERIC,
  opening_hours JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.external_listings ENABLE ROW LEVEL SECURITY;

-- Helper: identifica o gestor de listings (por email no JWT) ou admin
CREATE OR REPLACE FUNCTION public.is_listings_manager(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    has_role(_uid, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _uid AND lower(u.email) = 'suporteitchat@gmail.com'
    );
$$;

-- Leitura pública (apenas ativos)
CREATE POLICY "External listings public read"
ON public.external_listings
FOR SELECT
USING (active = true);

-- Gestão: somente listings manager (email autorizado) ou admin
CREATE POLICY "Listings manager manages external listings"
ON public.external_listings
FOR ALL
TO authenticated
USING (public.is_listings_manager(auth.uid()))
WITH CHECK (public.is_listings_manager(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_external_listings_updated_at
BEFORE UPDATE ON public.external_listings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_external_listings_category ON public.external_listings(category_key) WHERE active = true;
