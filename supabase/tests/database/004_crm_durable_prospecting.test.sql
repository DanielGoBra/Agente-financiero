begin;

select plan(11);

insert into auth.users (id, email)
values ('40000000-0000-0000-0000-000000000001', 'workflow-advisor@example.test')
on conflict (id) do nothing;

insert into public.profiles (id, full_name, role)
values ('40000000-0000-0000-0000-000000000001', 'Workflow Advisor', 'asesor')
on conflict (id) do update set role = excluded.role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok(
  $$
    select public.crm_create_prospecting_run(
      '40000000-0000-0000-0000-000000000010',
      'Envigado',
      'Ferreterías',
      '[{"id":"place-1","name":"Ferretería Uno","address":"Calle 1"},{"id":"place-2","name":"Taller Dos","address":"Calle 2"}]'::jsonb,
      encode(extensions.digest(convert_to('workflow-secret-with-more-than-32-characters', 'UTF8'), 'sha256'), 'hex'),
      1
    )
  $$,
  'authenticated advisor can create an owned durable run'
);

select is(
  (select total_candidates from public.crm_prospecting_runs where id = '40000000-0000-0000-0000-000000000010'),
  2,
  'run stores the exact candidate count'
);

select is(
  (select count(*)::integer from public.crm_prospecting_candidates where run_id = '40000000-0000-0000-0000-000000000010'),
  2,
  'candidate rows are created atomically'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

select throws_ok(
  $$
    select public.crm_record_prospecting_batch(
      '40000000-0000-0000-0000-000000000010',
      'incorrect-workflow-secret-that-is-long-enough',
      'batch-1'
    )
  $$,
  '42501',
  'Invalid workflow credential',
  'workflow progress rejects an invalid credential'
);

select lives_ok(
  $$
    select public.crm_record_prospecting_batch(
      '40000000-0000-0000-0000-000000000010',
      'workflow-secret-with-more-than-32-characters',
      'batch-1',
      '[{"id":"place-1","isMicroSME":true,"reliabilityScore":9,"opportunityScore":88,"estimatedSize":"micro","reasoning":"Perfil viable","predictedNeed":"Inventario","digitalFootprint":"medium"}]'::jsonb,
      array['place-2'],
      'test/free',
      'v3',
      'AI_BATCH_FAILED',
      'Proveedor no disponible',
      false
    )
  $$,
  'valid workflow credential records results'
);

select lives_ok(
  $$
    select public.crm_record_prospecting_batch(
      '40000000-0000-0000-0000-000000000010',
      'workflow-secret-with-more-than-32-characters',
      'batch-1',
      '[{"id":"place-1","isMicroSME":true,"reliabilityScore":9,"opportunityScore":88,"estimatedSize":"micro","reasoning":"Perfil viable","predictedNeed":"Inventario","digitalFootprint":"medium"}]'::jsonb,
      array['place-2'],
      'test/free',
      'v3',
      'AI_BATCH_FAILED',
      'Proveedor no disponible',
      false
    )
  $$,
  'replaying the same batch key is safe'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select (metadata->>'completed_batches')::integer from public.crm_prospecting_runs where id = '40000000-0000-0000-0000-000000000010'),
  1,
  'replayed batch increments progress only once'
);

select lives_ok(
  $$
    select public.crm_record_prospecting_batch(
      '40000000-0000-0000-0000-000000000010',
      'workflow-secret-with-more-than-32-characters',
      null,
      '[]'::jsonb,
      '{}'::text[],
      null,
      'v3',
      null,
      null,
      true
    )
  $$,
  'workflow can finalize the durable run'
);

select is(
  (select status from public.crm_prospecting_runs where id = '40000000-0000-0000-0000-000000000010'),
  'partial',
  'run finishes partial when one candidate failed'
);

select is(
  (select enrichment_status from public.crm_prospecting_candidates where run_id = '40000000-0000-0000-0000-000000000010' and google_place_id = 'place-1'),
  'enriched',
  'successful candidate is enriched'
);

select is(
  (select enrichment_status from public.crm_prospecting_candidates where run_id = '40000000-0000-0000-0000-000000000010' and google_place_id = 'place-2'),
  'failed',
  'failed candidate remains available for recovery'
);

select * from finish();
rollback;
