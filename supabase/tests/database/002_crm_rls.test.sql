begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'advisor-a@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'advisor-b@example.test',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.profiles (id, full_name, role)
values
  ('10000000-0000-0000-0000-000000000001', 'Advisor A', 'asesor'),
  ('20000000-0000-0000-0000-000000000002', 'Advisor B', 'asesor')
on conflict (id) do update set full_name = excluded.full_name, role = excluded.role;

insert into public.crm_accounts (id, owner_id, created_by, display_name, source)
values
  (
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Empresa A',
    'manual'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Empresa B',
    'manual'
  );

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select results_eq(
  $$ select display_name from public.crm_accounts order by display_name $$,
  $$ values ('Empresa A'::text) $$,
  'An advisor can only read their own CRM accounts'
);

select results_eq(
  $$
    update public.crm_accounts
    set priority = 'high'
    where id = 'b0000000-0000-0000-0000-000000000002'
    returning id
  $$,
  $$ select null::uuid where false $$,
  'An advisor cannot update another advisor account'
);

select results_eq(
  $$
    update public.crm_accounts
    set priority = 'high'
    where id = 'a0000000-0000-0000-0000-000000000001'
    returning id
  $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'An advisor can update their own CRM account'
);

select throws_ok(
  $$
    insert into public.crm_activities (account_id, created_by, activity_type, body)
    values (
      'b0000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'note',
      'Unauthorized note'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "crm_activities"',
  'An advisor cannot append activity to another advisor account'
);

select * from finish();
rollback;
