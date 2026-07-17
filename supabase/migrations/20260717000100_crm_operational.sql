-- CRM operational layer: contacts and trustworthy automatic audit events.
-- Requires 20260716000100_crm_foundation.sql.

begin;

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.crm_accounts(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  full_name text not null,
  job_title text,
  phone text,
  email text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  consent_status text not null default 'unknown',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint crm_contacts_name_nonempty check (length(trim(full_name)) > 0),
  constraint crm_contacts_contact_method check (
    nullif(trim(coalesce(phone, '')), '') is not null
    or nullif(trim(coalesce(email, '')), '') is not null
  ),
  constraint crm_contacts_consent_allowed check (consent_status in ('unknown', 'granted', 'revoked'))
);

create index if not exists crm_contacts_account_idx
on public.crm_contacts (account_id, is_active, is_primary desc);

alter table public.crm_contacts enable row level security;
alter table public.crm_contacts force row level security;

revoke all on table public.crm_contacts from anon, authenticated;
grant select, insert on table public.crm_contacts to authenticated;
grant update (
  full_name,
  job_title,
  phone,
  email,
  is_primary,
  is_active,
  consent_status
) on public.crm_contacts to authenticated;

drop policy if exists crm_contacts_select_account on public.crm_contacts;
create policy crm_contacts_select_account
on public.crm_contacts for select to authenticated
using ((select private.crm_can_access_account(account_id)));

drop policy if exists crm_contacts_insert_account on public.crm_contacts;
create policy crm_contacts_insert_account
on public.crm_contacts for insert to authenticated
with check (
  (select private.crm_can_access_account(account_id))
  and (created_by = (select auth.uid()) or (select private.crm_is_admin()))
);

drop policy if exists crm_contacts_update_account on public.crm_contacts;
create policy crm_contacts_update_account
on public.crm_contacts for update to authenticated
using ((select private.crm_can_access_account(account_id)))
with check ((select private.crm_can_access_account(account_id)));

drop trigger if exists crm_contacts_set_updated_at on public.crm_contacts;
create trigger crm_contacts_set_updated_at
before update on public.crm_contacts
for each row execute function private.crm_set_updated_at();

-- Stage history becomes database-generated so clients cannot forge audit rows.
revoke insert on table public.crm_stage_history from authenticated;
drop policy if exists crm_stage_history_insert_account on public.crm_stage_history;

create or replace function private.crm_record_stage_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  if old.stage_id is distinct from new.stage_id then
    actor_id := coalesce((select auth.uid()), new.created_by, new.owner_id);

    if actor_id is not null then
      insert into public.crm_stage_history (
        account_id,
        changed_by,
        from_stage_id,
        to_stage_id,
        reason
      )
      values (
        new.id,
        actor_id,
        old.stage_id,
        new.stage_id,
        'Cambio registrado automáticamente'
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.crm_record_stage_change() from public, anon, authenticated;

drop trigger if exists crm_accounts_record_stage_change on public.crm_accounts;
create trigger crm_accounts_record_stage_change
after update of stage_id on public.crm_accounts
for each row execute function private.crm_record_stage_change();

create or replace function private.crm_normalize_task_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.completed_at := coalesce(new.completed_at, timezone('utc'::text, now()));
  elsif new.status is distinct from 'completed' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create or replace function private.crm_record_task_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    actor_id := coalesce((select auth.uid()), new.assigned_to, new.created_by);

    if actor_id is not null then
      insert into public.crm_activities (
        account_id,
        created_by,
        activity_type,
        subject,
        body,
        occurred_at,
        metadata
      )
      values (
        new.account_id,
        actor_id,
        'task_completed',
        new.title,
        coalesce(new.description, 'Tarea completada'),
        coalesce(new.completed_at, timezone('utc'::text, now())),
        jsonb_build_object('task_id', new.id)
      );
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.crm_normalize_task_completion() from public, anon, authenticated;
revoke all on function private.crm_record_task_completion() from public, anon, authenticated;

drop trigger if exists crm_tasks_normalize_completion on public.crm_tasks;
create trigger crm_tasks_normalize_completion
before update of status on public.crm_tasks
for each row execute function private.crm_normalize_task_completion();

drop trigger if exists crm_tasks_record_completion on public.crm_tasks;
create trigger crm_tasks_record_completion
after update of status on public.crm_tasks
for each row execute function private.crm_record_task_completion();

comment on table public.crm_contacts is 'People associated with a CRM account; consent status supports communication governance.';
comment on function private.crm_record_stage_change() is 'Creates immutable stage history from account changes.';
comment on function private.crm_record_task_completion() is 'Creates a commercial timeline activity when a task is completed.';

commit;
