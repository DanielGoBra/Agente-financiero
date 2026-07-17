-- Durable prospecting RPCs for Cloudflare Workflows.
-- Requires the CRM foundation and operational migrations.

begin;

create or replace function public.crm_create_prospecting_run(
  p_run_id uuid,
  p_territory text,
  p_sector text,
  p_candidates jsonb,
  p_workflow_token_hash text,
  p_total_batches integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  candidate_count integer;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if jsonb_typeof(p_candidates) is distinct from 'array'
    or jsonb_array_length(p_candidates) = 0
    or jsonb_array_length(p_candidates) > 200
    or octet_length(p_candidates::text) > 786432 then
    raise exception 'Candidate payload must contain between 1 and 200 items' using errcode = '22023';
  end if;

  if p_workflow_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid workflow token hash' using errcode = '22023';
  end if;

  if length(trim(coalesce(p_territory, ''))) not between 1 and 160
    or length(trim(coalesce(p_sector, ''))) not between 1 and 160
    or p_total_batches < 1
    or p_total_batches > 40 then
    raise exception 'Invalid prospecting run metadata' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_candidates) as candidate
    where length(trim(coalesce(candidate->>'id', ''))) not between 1 and 160
  ) then
    raise exception 'Every candidate requires a valid id' using errcode = '22023';
  end if;

  select count(distinct candidate->>'id')
  into candidate_count
  from jsonb_array_elements(p_candidates) as candidate;

  insert into public.crm_prospecting_runs (
    id,
    created_by,
    status,
    territory,
    sector,
    total_candidates,
    metadata
  )
  values (
    p_run_id,
    actor_id,
    'requested',
    trim(p_territory),
    trim(p_sector),
    candidate_count,
    jsonb_build_object(
      'workflow_id', p_run_id,
      'workflow_token_hash', p_workflow_token_hash,
      'total_batches', p_total_batches,
      'completed_batches', 0,
      'completed_batch_keys', '[]'::jsonb,
      'architecture_version', 3
    )
  );

  insert into public.crm_prospecting_candidates (
    run_id,
    google_place_id,
    enrichment_status,
    analysis
  )
  select distinct on (candidate->>'id')
    p_run_id,
    candidate->>'id',
    'pending',
    jsonb_build_object('business', candidate)
  from jsonb_array_elements(p_candidates) as candidate
  order by candidate->>'id';

  return p_run_id;
end;
$$;

create or replace function public.crm_record_prospecting_batch(
  p_run_id uuid,
  p_workflow_token text,
  p_batch_key text default null,
  p_results jsonb default '[]'::jsonb,
  p_failed_ids text[] default '{}'::text[],
  p_model_id text default null,
  p_prompt_version text default 'v3',
  p_error_code text default null,
  p_error_message text default null,
  p_is_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_hash text;
  received_hash text;
  run_metadata jsonb;
  completed_batch_keys jsonb;
  enriched_total integer;
  failed_total integer;
  candidate_total integer;
  final_status text;
begin
  if length(coalesce(p_workflow_token, '')) < 32 then
    raise exception 'Invalid workflow credential' using errcode = '42501';
  end if;

  select run.metadata->>'workflow_token_hash', run.metadata
  into expected_hash, run_metadata
  from public.crm_prospecting_runs as run
  where run.id = p_run_id
  for update;

  received_hash := encode(extensions.digest(convert_to(p_workflow_token, 'UTF8'), 'sha256'), 'hex');

  if expected_hash is null or expected_hash <> received_hash then
    raise exception 'Invalid workflow credential' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_results, '[]'::jsonb)) is distinct from 'array'
    or jsonb_array_length(coalesce(p_results, '[]'::jsonb)) > 25
    or octet_length(coalesce(p_results, '[]'::jsonb)::text) > 262144
    or coalesce(array_length(p_failed_ids, 1), 0) > 25 then
    raise exception 'Invalid workflow batch payload' using errcode = '22023';
  end if;

  with result_rows as (
    select result
    from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) as result
    where nullif(trim(result->>'id'), '') is not null
  )
  update public.crm_prospecting_candidates as candidate
  set
    enrichment_status = 'enriched',
    attempts = greatest(candidate.attempts, 1),
    ai_score = least(100, greatest(0, coalesce((result_rows.result->>'opportunityScore')::integer, 50))),
    ai_confidence = least(100, greatest(0, coalesce((result_rows.result->>'reliabilityScore')::integer * 10, 50))),
    model_id = left(nullif(p_model_id, ''), 200),
    prompt_version = left(coalesce(nullif(p_prompt_version, ''), 'v3'), 40),
    analysis = candidate.analysis || jsonb_build_object('validation', result_rows.result),
    last_error_code = null,
    last_error_message = null,
    next_attempt_at = null,
    updated_at = timezone('utc'::text, now())
  from result_rows
  where candidate.run_id = p_run_id
    and candidate.google_place_id = result_rows.result->>'id';

  update public.crm_prospecting_candidates as candidate
  set
    enrichment_status = 'failed',
    attempts = greatest(candidate.attempts, 1),
    last_error_code = left(coalesce(nullif(p_error_code, ''), 'AI_BATCH_FAILED'), 80),
    last_error_message = left(coalesce(nullif(p_error_message, ''), 'No se pudo completar el enriquecimiento'), 500),
    next_attempt_at = null,
    updated_at = timezone('utc'::text, now())
  where candidate.run_id = p_run_id
    and candidate.google_place_id = any(coalesce(p_failed_ids, '{}'::text[]))
    and candidate.enrichment_status <> 'enriched';

  select
    count(*) filter (where enrichment_status = 'enriched'),
    count(*) filter (where enrichment_status = 'failed'),
    count(*)
  into enriched_total, failed_total, candidate_total
  from public.crm_prospecting_candidates
  where run_id = p_run_id;

  final_status := case
    when p_is_final and failed_total = 0 then 'completed'
    when p_is_final then 'partial'
    else 'enriching'
  end;

  completed_batch_keys := coalesce(run_metadata->'completed_batch_keys', '[]'::jsonb);
  if not p_is_final then
    if length(trim(coalesce(p_batch_key, ''))) not between 1 and 80 then
      raise exception 'Invalid workflow batch key' using errcode = '22023';
    end if;
    if not (completed_batch_keys ? p_batch_key) then
      completed_batch_keys := completed_batch_keys || jsonb_build_array(p_batch_key);
    end if;
  end if;

  run_metadata := jsonb_set(run_metadata, '{completed_batch_keys}', completed_batch_keys, true);
  run_metadata := jsonb_set(run_metadata, '{completed_batches}', to_jsonb(jsonb_array_length(completed_batch_keys)), true);

  update public.crm_prospecting_runs
  set
    status = final_status,
    total_candidates = candidate_total,
    enriched_count = enriched_total,
    failed_count = failed_total,
    started_at = coalesce(started_at, timezone('utc'::text, now())),
    completed_at = case when p_is_final then timezone('utc'::text, now()) else null end,
    metadata = run_metadata,
    updated_at = timezone('utc'::text, now())
  where id = p_run_id;

  return jsonb_build_object(
    'status', final_status,
    'total', candidate_total,
    'enriched', enriched_total,
    'failed', failed_total
  );
end;
$$;

revoke all on function public.crm_create_prospecting_run(uuid, text, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.crm_create_prospecting_run(uuid, text, text, jsonb, text, integer) to authenticated;

revoke all on function public.crm_record_prospecting_batch(uuid, text, text, jsonb, text[], text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.crm_record_prospecting_batch(uuid, text, text, jsonb, text[], text, text, text, text, boolean) to anon, authenticated;

comment on function public.crm_create_prospecting_run(uuid, text, text, jsonb, text, integer)
is 'Atomically creates an owned durable prospecting run and its candidates.';

comment on function public.crm_record_prospecting_batch(uuid, text, text, jsonb, text[], text, text, text, text, boolean)
is 'Records Workflow progress after validating a high-entropy per-run credential.';

commit;
