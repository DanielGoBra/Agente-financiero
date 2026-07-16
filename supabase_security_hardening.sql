-- Security migration for the production Supabase project.
-- Run once in the Supabase SQL editor as the project owner.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'superAdmin')
  );
$$;

revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Recreate the signup trigger with an immutable search path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'asesor'
  );

  insert into public.user_zones (user_id, municipality)
  values (new.id, 'Envigado');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.user_zones enable row level security;
alter table public.user_zones force row level security;
alter table public.empresas_formales enable row level security;
alter table public.empresas_formales force row level security;
alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_leads force row level security;

-- Remove legacy policies before installing the complete policy set below.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'user_zones', 'empresas_formales', 'activity_logs', 'crm_leads')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end;
$$;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_zones from anon, authenticated;
revoke all on table public.empresas_formales from anon, authenticated;
revoke all on table public.activity_logs from anon, authenticated;
revoke all on table public.crm_leads from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select, insert, delete on table public.user_zones to authenticated;
grant select, insert, update on table public.empresas_formales to authenticated;
grant select, insert on table public.activity_logs to authenticated;
grant select, insert, update, delete on table public.crm_leads to authenticated;

create policy profiles_select_self_or_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.is_admin())
);

-- Profile updates are intentionally unavailable from the browser. This prevents
-- users from promoting their own role to admin or superAdmin.

create policy user_zones_select_self_or_admin
on public.user_zones
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy user_zones_insert_admin
on public.user_zones
for insert
to authenticated
with check ((select private.is_admin()));

create policy user_zones_delete_admin
on public.user_zones
for delete
to authenticated
using ((select private.is_admin()));

create policy empresas_select_authorized_territory
on public.empresas_formales
for select
to authenticated
using (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or (
    assigned_to is null
    and upper(municipio) in (
      select upper(municipality)
      from public.user_zones
      where user_id = (select auth.uid())
    )
  )
);

create policy empresas_insert_own_lead
on public.empresas_formales
for insert
to authenticated
with check (
  assigned_to = (select auth.uid())
  or (select private.is_admin())
);

create policy empresas_update_own_or_unassigned_territory
on public.empresas_formales
for update
to authenticated
using (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or (
    assigned_to is null
    and upper(municipio) in (
      select upper(municipality)
      from public.user_zones
      where user_id = (select auth.uid())
    )
  )
)
with check (
  (select private.is_admin())
  or assigned_to = (select auth.uid())
  or assigned_to is null
);

create policy activity_logs_insert_self
on public.activity_logs
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and lower(user_email) = lower(coalesce((select auth.jwt()->>'email'), ''))
);

create policy activity_logs_select_admin
on public.activity_logs
for select
to authenticated
using ((select private.is_admin()));

create policy crm_leads_select_self_or_admin
on public.crm_leads
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy crm_leads_insert_self_or_admin
on public.crm_leads
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy crm_leads_update_self_or_admin
on public.crm_leads
for update
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
)
with check (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy crm_leads_delete_self_or_admin
on public.crm_leads
for delete
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_admin())
);

create index if not exists user_zones_user_id_idx on public.user_zones (user_id);
create index if not exists empresas_formales_assigned_to_idx on public.empresas_formales (assigned_to);
create index if not exists empresas_formales_municipio_idx on public.empresas_formales (upper(municipio));
create index if not exists activity_logs_user_id_idx on public.activity_logs (user_id);
create index if not exists crm_leads_user_id_idx on public.crm_leads (user_id);

alter table public.profiles
  drop constraint if exists profiles_role_allowed;
alter table public.profiles
  add constraint profiles_role_allowed
  check (role in ('asesor', 'admin', 'superAdmin')) not valid;

alter table public.activity_logs
  drop constraint if exists activity_logs_action_allowed;
alter table public.activity_logs
  add constraint activity_logs_action_allowed
  check (action_type in ('LOGIN', 'SEARCH', 'DOWNLOAD_EXCEL')) not valid;

commit;
