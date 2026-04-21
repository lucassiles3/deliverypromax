-- 1) Aniversário no perfil
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;

-- 2) Campanhas de aniversário (cupom automático no mês de aniversário)
CREATE TABLE IF NOT EXISTS public.birthday_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Aniversariante do mês',
  active BOOLEAN NOT NULL DEFAULT true,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 15,
  coupon_validity_days INTEGER NOT NULL DEFAULT 30,
  message TEXT DEFAULT 'Parabéns! 🎉 Use este cupom no seu mês de aniversário.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner/manager manages birthday campaigns" ON public.birthday_campaigns
  FOR ALL TO authenticated
  USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'))
  WITH CHECK (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'));

CREATE TRIGGER trg_bday_camp_updated BEFORE UPDATE ON public.birthday_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Histórico de cupons de aniversário enviados (evita duplicar no mesmo ano)
CREATE TABLE IF NOT EXISTS public.birthday_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.birthday_campaigns(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  coupon_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  redeemed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id, year)
);

ALTER TABLE public.birthday_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store team views birthday runs" ON public.birthday_runs
  FOR SELECT TO authenticated
  USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'));

CREATE POLICY "User views own birthday runs" ON public.birthday_runs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 4) Função: roda uma campanha de aniversário (cria cupons p/ quem faz aniv. neste mês)
CREATE OR REPLACE FUNCTION public.run_birthday_campaign(_campaign_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _camp RECORD;
  _is_owner BOOLEAN;
  _row RECORD;
  _code TEXT;
  _coupon_id UUID;
  _created INTEGER := 0;
  _yr INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
  _ctype coupon_type;
BEGIN
  SELECT * INTO _camp FROM public.birthday_campaigns WHERE id = _campaign_id;
  IF _camp IS NULL THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;

  SELECT (s.owner_id = auth.uid() OR has_role(auth.uid(),'admin') OR can_access_section(_camp.store_id, auth.uid(), 'marketing'))
    INTO _is_owner FROM stores s WHERE s.id = _camp.store_id;
  IF NOT COALESCE(_is_owner,false) THEN RAISE EXCEPTION 'forbidden'; END IF;

  _ctype := CASE _camp.discount_type
    WHEN 'percent' THEN 'percent'::coupon_type
    WHEN 'fixed' THEN 'fixed'::coupon_type
    ELSE 'percent'::coupon_type
  END;

  FOR _row IN
    SELECT DISTINCT p.id AS user_id, p.display_name
    FROM public.profiles p
    -- só clientes que já compraram nesta loja
    JOIN public.orders o ON o.user_id = p.id AND o.store_id = _camp.store_id
    WHERE p.birthday IS NOT NULL
      AND EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM now())
      AND NOT EXISTS (
        SELECT 1 FROM public.birthday_runs r
        WHERE r.campaign_id = _campaign_id AND r.user_id = p.id AND r.year = _yr
      )
  LOOP
    _code := 'BDAY-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,6));

    INSERT INTO public.coupons (
      store_id, code, label, type, value,
      starts_at, expires_at, active, visibility, per_user_limit, usage_limit
    ) VALUES (
      _camp.store_id, _code, COALESCE(_camp.name,'Aniversário'),
      _ctype, _camp.discount_value,
      now(), now() + (_camp.coupon_validity_days || ' days')::interval,
      true, 'private', 1, 1
    ) RETURNING id INTO _coupon_id;

    INSERT INTO public.birthday_runs (campaign_id, store_id, user_id, coupon_id, coupon_code, year)
    VALUES (_campaign_id, _camp.store_id, _row.user_id, _coupon_id, _code, _yr);

    -- notifica o cliente
    INSERT INTO public.notifications (user_id, store_id, title, message, type, link, metadata)
    VALUES (
      _row.user_id, _camp.store_id,
      '🎂 Feliz aniversário!',
      COALESCE(_camp.message, 'Parabéns!') || ' Cupom: ' || _code,
      'success', '/recompensas',
      jsonb_build_object('coupon_code', _code, 'campaign_id', _campaign_id)
    );

    _created := _created + 1;
  END LOOP;

  RETURN _created;
END;
$$;

-- 5) PIX direto na mesa: permitir payment_transactions sem order (referencia sessão)
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS table_session_id UUID REFERENCES public.table_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.payment_transactions ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_target_check;
ALTER TABLE public.payment_transactions
  ADD CONSTRAINT payment_transactions_target_check
  CHECK (order_id IS NOT NULL OR table_session_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_session ON public.payment_transactions(table_session_id);

-- Política: leitura pública por qualquer pessoa que tenha o id da transação?
-- Cliente da mesa não está logado, então precisamos de leitura pública por id.
DROP POLICY IF EXISTS "Public reads own pix transaction by id" ON public.payment_transactions;
CREATE POLICY "Public reads pix transaction" ON public.payment_transactions
  FOR SELECT TO anon, authenticated USING (true);

-- 6) Quando webhook marca uma sessão de mesa como paga, registra em table_payments
CREATE OR REPLACE FUNCTION public.tg_pix_session_paid()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.table_session_id IS NOT NULL
     AND NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NOT EXISTS (
       SELECT 1 FROM public.table_payments
       WHERE session_id = NEW.table_session_id
         AND notes = 'pix:' || NEW.id::text
     )
  THEN
    INSERT INTO public.table_payments (session_id, store_id, method, amount, payer_name, notes)
    VALUES (NEW.table_session_id, NEW.store_id, 'pix', NEW.amount, 'Cliente (PIX QR)', 'pix:' || NEW.id::text);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pix_session_paid ON public.payment_transactions;
CREATE TRIGGER trg_pix_session_paid
  AFTER UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_pix_session_paid();