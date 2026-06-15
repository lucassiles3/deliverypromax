ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- Backfill: orders that already passed pending_payment are considered paid (except cancelled)
UPDATE public.orders
   SET payment_status = 'paid',
       paid_at = COALESCE(paid_at, accepted_at, created_at)
 WHERE payment_status = 'pending'
   AND status NOT IN ('pending_payment','cancelled');

-- Backfill from payment_transactions approved
UPDATE public.orders o
   SET payment_status = 'paid',
       paid_at = COALESCE(o.paid_at, pt.paid_at, pt.created_at)
  FROM public.payment_transactions pt
 WHERE pt.order_id = o.id
   AND pt.status = 'approved'
   AND o.payment_status <> 'paid';