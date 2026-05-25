DELETE FROM public.products WHERE store_id IN (
  '7ff6f3b5-bf0d-4290-ab31-a8b39d94969e',
  'a62a36ea-775c-4f3f-ada3-e2d84450d254',
  'e1d8d6d4-dffb-4071-b442-b242da7b626d',
  'c92edfe0-7adc-4586-9b7e-22749f29c99f'
);
DELETE FROM public.stores WHERE id IN (
  '7ff6f3b5-bf0d-4290-ab31-a8b39d94969e',
  'a62a36ea-775c-4f3f-ada3-e2d84450d254',
  'e1d8d6d4-dffb-4071-b442-b242da7b626d',
  'c92edfe0-7adc-4586-9b7e-22749f29c99f'
);