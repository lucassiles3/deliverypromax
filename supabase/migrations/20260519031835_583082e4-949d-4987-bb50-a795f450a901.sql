
-- 1) Status operacional das lojas (active/suspended/blocked)
DO $$ BEGIN
  CREATE TYPE public.store_lifecycle AS ENUM ('active','suspended','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS lifecycle_status public.store_lifecycle NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS lifecycle_reason text,
  ADD COLUMN IF NOT EXISTS lifecycle_changed_at timestamptz;

-- 2) Planos de assinatura da plataforma
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  trial_days int NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans readable by all" ON public.subscription_plans
  FOR SELECT USING (true);
CREATE POLICY "plans manageable by super_admin" ON public.subscription_plans
  FOR ALL USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.subscription_plans (name, slug, price_monthly, price_yearly, features, trial_days, sort_order)
VALUES
  ('Trial',     'trial',     0,      0,       '["7 dias gratis","Pedidos ilimitados"]'::jsonb, 7,  0),
  ('Starter',   'starter',   79.90,  799.00,  '["1 loja","Pedidos ilimitados","Suporte por e-mail"]'::jsonb, 7, 1),
  ('Pro',       'pro',       149.90, 1490.00, '["1 loja","PDV","Fidelidade","Cupons","Suporte prioritario"]'::jsonb, 7, 2),
  ('Business',  'business',  299.90, 2990.00, '["Multi-loja","API publica","Suporte 24/7","Onboarding"]'::jsonb, 14, 3)
ON CONFLICT (slug) DO NOTHING;

-- 3) Assinatura de cada loja
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trial','active','overdue','cancelled','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'trial',
  monthly_amount numeric(10,2) NOT NULL DEFAULT 0,
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  next_payment_at timestamptz,
  cancelled_at timestamptz,
  gateway text,
  gateway_customer_id text,
  gateway_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store sees own subscription" ON public.store_subscriptions
  FOR SELECT USING (public.is_store_owner(store_id, auth.uid()) OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "super_admin manages subscriptions" ON public.store_subscriptions
  FOR ALL USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER tg_store_subscriptions_updated_at
  BEFORE UPDATE ON public.store_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cria assinatura trial automaticamente para lojas existentes que ainda não têm
INSERT INTO public.store_subscriptions (store_id, plan_id, status, trial_ends_at, current_period_end)
SELECT s.id,
       (SELECT id FROM public.subscription_plans WHERE slug='trial' LIMIT 1),
       'trial',
       now() + interval '7 days',
       now() + interval '7 days'
FROM public.stores s
LEFT JOIN public.store_subscriptions ss ON ss.store_id = s.id
WHERE ss.id IS NULL;

-- Trigger para criar assinatura trial em novas lojas
CREATE OR REPLACE FUNCTION public.tg_new_store_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _plan_id uuid;
BEGIN
  SELECT id INTO _plan_id FROM public.subscription_plans WHERE slug='trial' LIMIT 1;
  INSERT INTO public.store_subscriptions (store_id, plan_id, status, trial_ends_at, current_period_end)
  VALUES (NEW.id, _plan_id, 'trial', now() + interval '7 days', now() + interval '7 days')
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_stores_create_subscription ON public.stores;
CREATE TRIGGER tg_stores_create_subscription
  AFTER INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.tg_new_store_subscription();

-- 4) Logs da plataforma
CREATE TABLE IF NOT EXISTS public.platform_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id uuid,
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_logs_created ON public.platform_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_logs_event ON public.platform_logs(event_type);

ALTER TABLE public.platform_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform logs read by super_admin" ON public.platform_logs
  FOR SELECT USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "platform logs insert by service" ON public.platform_logs
  FOR INSERT WITH CHECK (true);

-- 5) Suporte
DO $$ BEGIN
  CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','waiting_customer','resolved','closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  user_id uuid,
  subject text NOT NULL,
  body text NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  assigned_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid,
  author_role text NOT NULL DEFAULT 'user',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets viewable by owner and admin" ON public.support_tickets
  FOR SELECT USING (
    user_id = auth.uid()
    OR (store_id IS NOT NULL AND public.is_store_owner(store_id, auth.uid()))
    OR public.has_role(auth.uid(),'super_admin')
  );
CREATE POLICY "tickets created by authenticated" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets updated by super_admin" ON public.support_tickets
  FOR UPDATE USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "ticket msgs viewable" ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_tickets t
            WHERE t.id = ticket_id AND (
              t.user_id = auth.uid()
              OR (t.store_id IS NOT NULL AND public.is_store_owner(t.store_id, auth.uid()))
              OR public.has_role(auth.uid(),'super_admin')
            ))
  );
CREATE POLICY "ticket msgs insert" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND (
        t.user_id = auth.uid()
        OR (t.store_id IS NOT NULL AND public.is_store_owner(t.store_id, auth.uid()))
        OR public.has_role(auth.uid(),'super_admin')
      )
    )
  );

CREATE TRIGGER tg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Concessão automática do papel super_admin para suporteitchat@gmail.com
CREATE OR REPLACE FUNCTION public.grant_super_admin_if_master_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _email text;
BEGIN
  SELECT lower(email) INTO _email FROM auth.users WHERE id = NEW.id;
  IF _email = 'suporteitchat@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'super_admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS tg_profiles_grant_super_admin ON public.profiles;
CREATE TRIGGER tg_profiles_grant_super_admin
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.grant_super_admin_if_master_email();

-- Aplica retroativamente caso o usuário já exista
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::app_role
FROM auth.users u
WHERE lower(u.email) = 'suporteitchat@gmail.com'
ON CONFLICT DO NOTHING;

-- 7) Permitir que super_admin veja TUDO em stores, orders, profiles, user_roles
CREATE POLICY "super_admin views all stores" ON public.stores
  FOR SELECT USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "super_admin updates all stores" ON public.stores
  FOR UPDATE USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "super_admin views all orders" ON public.orders
  FOR SELECT USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "super_admin views all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "super_admin manages user_roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 8) Função de KPIs globais
CREATE OR REPLACE FUNCTION public.master_dashboard_kpis()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE _r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'revenue_today',  (SELECT COALESCE(SUM(total),0) FROM orders WHERE status='delivered' AND created_at::date = current_date),
    'revenue_week',   (SELECT COALESCE(SUM(total),0) FROM orders WHERE status='delivered' AND created_at >= date_trunc('week', now())),
    'revenue_month',  (SELECT COALESCE(SUM(total),0) FROM orders WHERE status='delivered' AND created_at >= date_trunc('month', now())),
    'revenue_year',   (SELECT COALESCE(SUM(total),0) FROM orders WHERE status='delivered' AND created_at >= date_trunc('year', now())),
    'revenue_total',  (SELECT COALESCE(SUM(total),0) FROM orders WHERE status='delivered'),
    'orders_today',   (SELECT COUNT(*) FROM orders WHERE created_at::date = current_date),
    'orders_total',   (SELECT COUNT(*) FROM orders),
    'orders_cancelled', (SELECT COUNT(*) FROM orders WHERE status='cancelled'),
    'orders_delivered', (SELECT COUNT(*) FROM orders WHERE status='delivered'),
    'avg_ticket',     (SELECT COALESCE(ROUND(AVG(total)::numeric,2),0) FROM orders WHERE status='delivered'),
    'by_payment',     (SELECT COALESCE(jsonb_object_agg(payment_method, total),'{}'::jsonb)
                       FROM (SELECT payment_method, SUM(total) AS total
                             FROM orders WHERE status='delivered'
                             GROUP BY payment_method) t),
    'stores_total',   (SELECT COUNT(*) FROM stores),
    'stores_active',  (SELECT COUNT(*) FROM store_subscriptions WHERE status='active'),
    'stores_trial',   (SELECT COUNT(*) FROM store_subscriptions WHERE status='trial'),
    'stores_overdue', (SELECT COUNT(*) FROM store_subscriptions WHERE status='overdue'),
    'stores_blocked', (SELECT COUNT(*) FROM stores WHERE lifecycle_status='blocked'),
    'mrr',            (SELECT COALESCE(SUM(monthly_amount),0) FROM store_subscriptions WHERE status='active'),
    'arr',            (SELECT COALESCE(SUM(monthly_amount)*12,0) FROM store_subscriptions WHERE status='active'),
    'users_total',    (SELECT COUNT(*) FROM profiles),
    'users_new_month',(SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', now())),
    'stores_new_month',(SELECT COUNT(*) FROM stores WHERE created_at >= date_trunc('month', now())),
    'cities_active',  (SELECT COUNT(DISTINCT city) FROM stores WHERE city IS NOT NULL),
    'revenue_series', (SELECT COALESCE(jsonb_agg(jsonb_build_object('date', d, 'total', total) ORDER BY d),'[]'::jsonb)
                       FROM (SELECT created_at::date AS d, SUM(total) AS total
                             FROM orders WHERE status='delivered'
                               AND created_at >= now() - interval '30 days'
                             GROUP BY 1) s)
  ) INTO _r;
  RETURN _r;
END $fn$;
