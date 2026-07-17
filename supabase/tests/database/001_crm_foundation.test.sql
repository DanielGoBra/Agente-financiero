begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

select has_table('public', 'crm_pipeline_stages', 'CRM pipeline stages table exists');
select has_table('public', 'crm_accounts', 'CRM accounts table exists');
select has_table('public', 'crm_prospecting_runs', 'Prospecting runs table exists');
select has_table('public', 'crm_prospecting_candidates', 'Prospecting candidates table exists');
select has_table('public', 'crm_opportunities', 'CRM opportunities table exists');
select has_table('public', 'crm_activities', 'CRM activities table exists');
select has_table('public', 'crm_tasks', 'CRM tasks table exists');
select has_table('public', 'crm_stage_history', 'CRM stage history table exists');

select ok(relrowsecurity, format('RLS is enabled on public.%s', relname))
from pg_class
where oid in (
  'public.crm_pipeline_stages'::regclass,
  'public.crm_accounts'::regclass,
  'public.crm_prospecting_runs'::regclass,
  'public.crm_prospecting_candidates'::regclass,
  'public.crm_opportunities'::regclass,
  'public.crm_activities'::regclass,
  'public.crm_tasks'::regclass,
  'public.crm_stage_history'::regclass
)
order by relname;

select is(
  (select count(*) from public.crm_pipeline_stages),
  15::bigint,
  'The initial professional pipeline has 15 stages'
);

select ok(
  not has_table_privilege('authenticated', 'public.crm_activities', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.crm_activities', 'DELETE')
  and not has_table_privilege('authenticated', 'public.crm_stage_history', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.crm_stage_history', 'DELETE'),
  'Activities and stage history are append-only for authenticated users'
);

select * from finish();
rollback;
