CREATE OR REPLACE FUNCTION public.store_subscription_state(_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sub record;
  _is_allowed boolean;
  _trial_left integer;
  _active boolean := false;
  _state text := 'expired';
BEGIN
  SELECT (s.owner_id = auth.uid() OR public.has_role(auth.uid(),'super_admin'))
    INTO _is_allowed FROM public.stores s WHERE s.id = _store_id;
  IF NOT COALESCE(_is_allowed,false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT ss.*, sp.slug AS plan_slug, sp.name AS plan_name, sp.price_monthly AS plan_price
    INTO _sub
    FROM public.store_subscriptions ss
    LEFT JOIN public.subscription_plans sp ON sp.id = ss.plan_id
   WHERE ss.store_id = _store_id;

  IF _sub IS NULL THEN
    RETURN jsonb_build_object('state','none','active',false);
  END IF;

  IF _sub.status::text = 'active' AND (_sub.current_period_end IS NULL OR _sub.current_period_end > now()) THEN
    _active := true; _state := 'active';
  ELSIF _sub.status::text = 'cancelled' AND _sub.current_period_end IS NOT NULL AND _sub.current_period_end > now() THEN
    _active := true; _state := 'cancelled_active';
  ELSIF _sub.status::text = 'trial' AND _sub.trial_ends_at IS NOT NULL AND _sub.trial_ends_at > now() THEN
    _active := true; _state := 'trial';
  ELSE
    _state := 'expired';
  END IF;

  _trial_left := CASE
    WHEN _sub.trial_ends_at IS NULL THEN 0
    ELSE GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_sub.trial_ends_at - now())) / 86400)::int)
  END;

  RETURN jsonb_build_object(
    'state', _state,
    'active', _active,
    'status', _sub.status,
    'plan_slug', _sub.plan_slug,
    'plan_name', _sub.plan_name,
    'plan_price', _sub.plan_price,
    'trial_ends_at', _sub.trial_ends_at,
    'trial_days_left', _trial_left,
    'current_period_end', _sub.current_period_end,
    'cancelled_at', _sub.cancelled_at,
    'gateway_subscription_id', _sub.gateway_subscription_id
  );
END;
$function$;