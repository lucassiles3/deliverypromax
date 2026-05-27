
REVOKE EXECUTE ON FUNCTION public.generate_monthly_invoice(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_subscription_grace() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_monthly_invoice(uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_subscription_grace() TO service_role;
