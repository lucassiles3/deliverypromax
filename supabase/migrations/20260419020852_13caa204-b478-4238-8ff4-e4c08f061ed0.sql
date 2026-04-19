-- ============================================================
-- MÓDULO 10 — Equipe e Permissões
-- ============================================================

-- Enum de papéis de equipe (separado do app_role global)
CREATE TYPE public.staff_role AS ENUM ('manager', 'attendant', 'kitchen', 'courier');

-- ============================================================
-- TABELA: store_members
-- ============================================================
CREATE TABLE public.store_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.staff_role NOT NULL,
  display_name TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

CREATE INDEX idx_store_members_user ON public.store_members(user_id) WHERE active = true;
CREATE INDEX idx_store_members_store ON public.store_members(store_id) WHERE active = true;

ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELA: store_invites
-- ============================================================
CREATE TABLE public.store_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.staff_role NOT NULL,
  display_name TEXT,
  invited_by UUID,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_invites_email ON public.store_invites(lower(email)) WHERE accepted_at IS NULL;
CREATE INDEX idx_store_invites_store ON public.store_invites(store_id);

ALTER TABLE public.store_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABELA: staff_activity_log
-- ============================================================
CREATE TABLE public.staff_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID,
  user_label TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_store_created ON public.staff_activity_log(store_id, created_at DESC);

ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNÇÕES DE PERMISSÃO (security definer para evitar recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_store_owner(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND owner_id = _user_id
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.get_store_role(_store_id UUID, _user_id UUID)
RETURNS public.staff_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.store_members
  WHERE store_id = _store_id AND user_id = _user_id AND active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_store_access(_store_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_store_owner(_store_id, _user_id)
      OR EXISTS (
        SELECT 1 FROM public.store_members
        WHERE store_id = _store_id AND user_id = _user_id AND active = true
      );
$$;

-- Permissões por seção (true = pode acessar)
CREATE OR REPLACE FUNCTION public.can_access_section(_store_id UUID, _user_id UUID, _section TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _role public.staff_role;
  _is_owner BOOLEAN;
BEGIN
  _is_owner := public.is_store_owner(_store_id, _user_id);
  IF _is_owner THEN RETURN true; END IF;

  _role := public.get_store_role(_store_id, _user_id);
  IF _role IS NULL THEN RETURN false; END IF;

  -- Matriz de permissões
  RETURN CASE _section
    -- Manager: tudo exceto financeiro/configurações da loja
    WHEN 'dashboard'  THEN _role IN ('manager','attendant')
    WHEN 'orders'     THEN _role IN ('manager','attendant','kitchen','courier')
    WHEN 'products'   THEN _role = 'manager'
    WHEN 'customers'  THEN _role IN ('manager','attendant')
    WHEN 'marketing'  THEN _role = 'manager'
    WHEN 'financial'  THEN false  -- só dono
    WHEN 'reports'    THEN _role = 'manager'
    WHEN 'store'      THEN false  -- só dono
    WHEN 'settings'   THEN _role = 'manager'
    WHEN 'team'       THEN false  -- só dono
    ELSE false
  END;
END;
$$;

-- ============================================================
-- RLS: store_members
-- ============================================================

CREATE POLICY "Owner manages store members"
ON public.store_members FOR ALL TO authenticated
USING (public.is_store_owner(store_id, auth.uid()))
WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE POLICY "Member views own membership"
ON public.store_members FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Membros do mesmo store podem ver outros membros (para listar equipe no painel)
CREATE POLICY "Members see store team"
ON public.store_members FOR SELECT TO authenticated
USING (public.has_store_access(store_id, auth.uid()));

-- ============================================================
-- RLS: store_invites
-- ============================================================

CREATE POLICY "Owner manages invites"
ON public.store_invites FOR ALL TO authenticated
USING (public.is_store_owner(store_id, auth.uid()))
WITH CHECK (public.is_store_owner(store_id, auth.uid()));

-- ============================================================
-- RLS: staff_activity_log
-- ============================================================

CREATE POLICY "Owner views activity"
ON public.staff_activity_log FOR SELECT TO authenticated
USING (public.is_store_owner(store_id, auth.uid()));

CREATE POLICY "Members insert own activity"
ON public.staff_activity_log FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.has_store_access(store_id, auth.uid())
);

-- ============================================================
-- ATUALIZA RLS EXISTENTES PARA INCLUIR MEMBROS
-- ============================================================

-- Orders: members podem ver/atualizar pedidos da loja conforme permissão 'orders'
DROP POLICY IF EXISTS "Owner views store orders" ON public.orders;
CREATE POLICY "Store team views orders"
ON public.orders FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id
          AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  OR public.can_access_section(store_id, auth.uid(), 'orders')
);

DROP POLICY IF EXISTS "Owner updates store orders" ON public.orders;
CREATE POLICY "Store team updates orders"
ON public.orders FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = orders.store_id
          AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  OR public.can_access_section(store_id, auth.uid(), 'orders')
);

-- Products: só manager pode editar; todos da equipe podem ver (via leitura pública já habilitada)
DROP POLICY IF EXISTS "Owner manages own products" ON public.products;
CREATE POLICY "Owner or manager manages products"
ON public.products FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id
          AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  OR public.can_access_section(store_id, auth.uid(), 'products')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores s WHERE s.id = products.store_id
          AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  OR public.can_access_section(store_id, auth.uid(), 'products')
);

-- ============================================================
-- TRIGGER: aceitar convites pendentes ao criar usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_pending_invites()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _email TEXT := lower(NEW.email);
  _inv RECORD;
BEGIN
  IF _email IS NULL THEN RETURN NEW; END IF;

  FOR _inv IN
    SELECT * FROM public.store_invites
    WHERE lower(email) = _email
      AND accepted_at IS NULL
      AND expires_at > now()
  LOOP
    INSERT INTO public.store_members (store_id, user_id, role, display_name, invited_by)
    VALUES (_inv.store_id, NEW.id, _inv.role, _inv.display_name, _inv.invited_by)
    ON CONFLICT (store_id, user_id) DO UPDATE SET role = EXCLUDED.role, active = true;

    UPDATE public.store_invites
    SET accepted_at = now(), accepted_by = NEW.id
    WHERE id = _inv.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_accept_invites ON auth.users;
CREATE TRIGGER on_auth_user_accept_invites
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invites();

-- Trigger para updated_at em store_members
CREATE TRIGGER update_store_members_updated_at
BEFORE UPDATE ON public.store_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();