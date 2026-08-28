-- =========================================================
-- LOYALTY REWARDS — catálogo
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cost_points integer NOT NULL CHECK (cost_points > 0),
  reward_type text NOT NULL CHECK (reward_type IN ('fixed','percent','free_shipping','free_item')),
  reward_value numeric NOT NULL DEFAULT 0,
  free_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  stock integer,
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_store_idx ON public.loyalty_rewards(store_id, active, position);

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Loyalty rewards public read"
ON public.loyalty_rewards FOR SELECT
USING (active = true);

CREATE POLICY "Owner manages loyalty rewards"
ON public.loyalty_rewards FOR ALL
TO authenticated
USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'))
WITH CHECK (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'));

CREATE TRIGGER tg_loyalty_rewards_updated
BEFORE UPDATE ON public.loyalty_rewards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- LOYALTY REDEMPTIONS — histórico
-- =========================================================
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  points_spent integer NOT NULL,
  coupon_code text NOT NULL,
  coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','expired')),
  expires_at timestamptz,
  used_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_redemptions_user_idx ON public.loyalty_redemptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_redemptions_store_idx ON public.loyalty_redemptions(store_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_code_idx ON public.loyalty_redemptions(coupon_code);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customer views own redemptions"
ON public.loyalty_redemptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Store team views redemptions"
ON public.loyalty_redemptions FOR SELECT
TO authenticated
USING (is_store_owner(store_id, auth.uid()) OR can_access_section(store_id, auth.uid(), 'marketing'));

-- inserts only via SECURITY DEFINER function

-- =========================================================
-- FUNCTION — redeem_loyalty_reward
-- =========================================================
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward(_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _reward record;
  _balance integer;
  _code text;
  _coupon_id uuid;
  _redemption_id uuid;
  _expires timestamptz;
  _coupon_type coupon_type;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO _reward FROM public.loyalty_rewards WHERE id = _reward_id AND active = true;
  IF _reward IS NULL THEN RAISE EXCEPTION 'reward not found or inactive'; END IF;

  IF _reward.stock IS NOT NULL AND _reward.stock <= 0 THEN
    RAISE EXCEPTION 'reward out of stock';
  END IF;

  _balance := public.customer_points_balance(_reward.store_id, _uid);
  IF _balance < _reward.cost_points THEN
    RAISE EXCEPTION 'insufficient points (have %, need %)', _balance, _reward.cost_points;
  END IF;

  _code := 'FID-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  _expires := now() + interval '30 days';

  -- mapeia para o cupom equivalente (free_item vira fixed com value=0; o uso fica controlado pelo redemption)
  _coupon_type := CASE _reward.reward_type
    WHEN 'percent' THEN 'percent'::coupon_type
    WHEN 'fixed' THEN 'fixed'::coupon_type
    WHEN 'free_shipping' THEN 'free_shipping'::coupon_type
    ELSE 'fixed'::coupon_type
  END;

  INSERT INTO public.coupons (
    store_id, code, label, type, value, active, visibility, expires_at, per_user_limit, usage_limit
  ) VALUES (
    _reward.store_id, _code, 'Recompensa: ' || _reward.name,
    _coupon_type, COALESCE(_reward.reward_value, 0),
    true, 'private', _expires, 1, 1
  ) RETURNING id INTO _coupon_id;

  INSERT INTO public.loyalty_points (store_id, user_id, delta, reason, expires_at)
  VALUES (_reward.store_id, _uid, -_reward.cost_points, 'redemption:' || _reward_id::text, NULL);

  INSERT INTO public.loyalty_redemptions (
    store_id, user_id, reward_id, points_spent, coupon_code, coupon_id, expires_at
  ) VALUES (
    _reward.store_id, _uid, _reward_id, _reward.cost_points, _code, _coupon_id, _expires
  ) RETURNING id INTO _redemption_id;

  IF _reward.stock IS NOT NULL THEN
    UPDATE public.loyalty_rewards SET stock = stock - 1 WHERE id = _reward_id;
  END IF;

  RETURN jsonb_build_object(
    'redemption_id', _redemption_id,
    'coupon_code', _code,
    'expires_at', _expires,
    'points_remaining', _balance - _reward.cost_points
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward(uuid) TO authenticated;

-- =========================================================
-- FUNCTION — award_order_points
-- (chamada do client após delivered; 1 ponto por R$ gasto)
-- =========================================================
CREATE OR REPLACE FUNCTION public.award_order_points(_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _o record;
  _pts integer;
  _existing integer;
BEGIN
  SELECT id, store_id, user_id, total, status INTO _o FROM public.orders WHERE id = _order_id;
  IF _o IS NULL OR _o.user_id IS NULL THEN RETURN 0; END IF;
  IF _o.status <> 'delivered' THEN RETURN 0; END IF;

  SELECT COUNT(*) INTO _existing FROM public.loyalty_points
   WHERE order_id = _order_id AND reason = 'order';
  IF _existing > 0 THEN RETURN 0; END IF;

  _pts := GREATEST(0, FLOOR(_o.total)::int);
  IF _pts = 0 THEN RETURN 0; END IF;

  INSERT INTO public.loyalty_points (store_id, user_id, delta, reason, order_id, expires_at)
  VALUES (_o.store_id, _o.user_id, _pts, 'order', _order_id, now() + interval '1 year');

  RETURN _pts;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_order_points(uuid) TO authenticated;