CREATE UNIQUE INDEX IF NOT EXISTS uniq_payment_txns_gateway_external
ON public.payment_transactions (gateway, external_id)
WHERE external_id IS NOT NULL;