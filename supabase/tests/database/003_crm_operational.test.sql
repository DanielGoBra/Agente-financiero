begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

select has_table('public', 'crm_contacts', 'CRM contacts table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.crm_contacts'::regclass),
  'RLS is enabled on CRM contacts'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_stage_history', 'INSERT'),
  'Authenticated users cannot forge stage history rows'
);

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
values (
  '00000000-0000-0000-0000-000000000000',
  '30000000-0000-0000-0000-000000000003',
  'authenticated',
  'authenticated',
  'advisor-operational@example.test',
  '',
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (id, full_name, role)
values ('30000000-0000-0000-0000-000000000003', 'Advisor Operational', 'asesor');

insert into public.crm_accounts (id, owner_id, created_by, display_name, source)
values (
  'c0000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  'Empresa Operativa',
  'manual'
);

insert into public.crm_tasks (id, account_id, assigned_to, created_by, title)
values (
  'd0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  '30000000-0000-0000-0000-000000000003',
  'Llamar al prospecto'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    insert into public.crm_contacts (
      account_id,
      created_by,
      full_name,
      phone,
      is_primary
    )
    values (
      'c0000000-0000-0000-0000-000000000003',
      '30000000-0000-0000-0000-000000000003',
      'Contacto Principal',
      '+57 300 000 0000',
      true
    )
  $$,
  'An advisor can create a contact for their account'
);

update public.crm_accounts
set stage_id = 'contactado'
where id = 'c0000000-0000-0000-0000-000000000003';

select is(
  (
    select count(*)
    from public.crm_stage_history
    where account_id = 'c0000000-0000-0000-0000-000000000003'
      and from_stage_id = 'capturado'
      and to_stage_id = 'contactado'
  ),
  1::bigint,
  'Changing an account stage creates immutable history'
);

update public.crm_tasks
set status = 'completed'
where id = 'd0000000-0000-0000-0000-000000000004';

select ok(
  (
    select completed_at is not null
    from public.crm_tasks
    where id = 'd0000000-0000-0000-0000-000000000004'
  ),
  'Completing a task records its completion timestamp'
);

select is(
  (
    select count(*)
    from public.crm_activities
    where account_id = 'c0000000-0000-0000-0000-000000000003'
      and activity_type = 'task_completed'
  ),
  1::bigint,
  'Completing a task creates a timeline activity'
);

select * from finish();
rollback;
