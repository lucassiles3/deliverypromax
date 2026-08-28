-- Stores: hide sensitive/internal columns from anonymous (unauthenticated) clients
REVOKE SELECT (
  chatbot_n8n_webhook_url,
  chatbot_qr_code,
  chatbot_phone,
  chatbot_status,
  chatbot_connected_at,
  chatbot_qr_updated_at,
  pix_key,
  marketplace_fee_percent,
  autocancel_min,
  autocancel_enabled,
  accept_alert_min,
  courier_gps_alert_min,
  courier_gps_reassign_min,
  lifecycle_reason,
  lifecycle_changed_at,
  max_orders_per_hour
) ON public.stores FROM anon;

-- Table sessions: hide PII / financial columns from anon
REVOKE SELECT (
  customer_name,
  customer_phone,
  waiter_user_id,
  waiter_name,
  paid_amount,
  discount,
  notes,
  closed_by,
  cash_register_id
) ON public.table_sessions FROM anon;
