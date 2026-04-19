UPDATE public.stores
SET owner_id = '466f20e5-1c58-4c7a-8856-6182539a139b'
WHERE id = '7ff6f3b5-bf0d-4290-ab31-a8b39d94969e';

INSERT INTO public.store_members (store_id, user_id, role, display_name, active)
VALUES ('7ff6f3b5-bf0d-4290-ab31-a8b39d94969e', '466f20e5-1c58-4c7a-8856-6182539a139b', 'manager', 'IT CHAT', true)
ON CONFLICT DO NOTHING;