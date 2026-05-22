
CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  image_url text NOT NULL,
  link_url text,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Home banners public read"
  ON public.home_banners FOR SELECT
  USING (
    active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "Super admin manages home banners"
  ON public.home_banners FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER trg_home_banners_updated
  BEFORE UPDATE ON public.home_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('home-banners', 'home-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Home banners public read storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'home-banners');

CREATE POLICY "Super admin uploads home banners"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'home-banners' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin updates home banners"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'home-banners' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admin deletes home banners"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'home-banners' AND has_role(auth.uid(), 'super_admin'::app_role));
