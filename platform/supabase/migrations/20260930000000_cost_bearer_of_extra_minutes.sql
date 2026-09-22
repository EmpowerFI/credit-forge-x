-- Whose minutes those were
--
-- A check-in the leader types for a participant costs ten minutes of *her*
-- time. The rate card said so in its own note from the first day — "10 min of
-- the leader when she enters it" — but the bearer came from the card's row,
-- which says `empowerfi`, so the leader's work was billed to the platform.
-- It was the largest single line in EmpowerFI's cost: R$ 2.474,90 out of
-- R$ 3.152,60, seventy-eight per cent of it, for work EmpowerFI does not do.
--
-- Moving the whole stage to `community` would be the other error: the platform
-- really does pay two centavos to store and prove that check-in. Two people
-- bear two parts of one fact. So a fact may now carry one event per bearer,
-- and record_cost takes the bearer of the extra minutes.
--
-- After this, EmpowerFI's measured cost is R$ 677,70 and the community's is
-- R$ 4.909,90. Nothing about the work changed; only who is recorded doing it.

alter table public.cost_events drop constraint cost_events_stage_fact_id_key;
alter table public.cost_events add constraint cost_events_stage_fact_bearer_key
  unique (stage, fact_id, borne_by);

drop function private.record_cost(public.cost_stage, uuid, uuid, uuid, boolean, timestamptz, integer);

create function private.record_cost(
  p_stage public.cost_stage,
  p_fact_id uuid,
  p_entrepreneur_id uuid,
  p_community_id uuid,
  p_is_simulated boolean,
  p_at timestamptz,
  p_extra_minutes integer default 0,
  -- Who spent the extra minutes, when that is not who the card charges for the
  -- stage. Null leaves them with the stage's own bearer, which is what every
  -- caller but the check-in means.
  p_extra_borne_by public.cost_bearer default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.cost_rates;
  v_at timestamptz := coalesce(p_at, now());
  v_card text := private.rate_card_at(v_at);
  v_community uuid;
  v_extra public.cost_bearer;
  v_minutes integer;
begin
  select * into r from public.cost_rates where stage = p_stage and card_version = v_card;
  v_community := coalesce(p_community_id, (
    select community_id from public.community_memberships
    where entrepreneur_id = p_entrepreneur_id order by joined_at limit 1));
  v_extra := coalesce(p_extra_borne_by, r.borne_by);
  -- The card's own minutes, plus the extra ones when they belong to the same
  -- person: one event, priced as before.
  v_minutes := r.staff_minutes
    + case when v_extra = r.borne_by then coalesce(p_extra_minutes, 0) else 0 end;

  insert into public.cost_events (
    stage, fact_id, entrepreneur_id, community_id, staff_minutes, amount_cents, borne_by, phase,
    is_simulated, created_at, rate_version
  ) values (
    p_stage, p_fact_id, p_entrepreneur_id, v_community, v_minutes,
    round(v_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents,
    r.borne_by, r.phase, coalesce(p_is_simulated, false), v_at, v_card
  )
  on conflict (stage, fact_id, borne_by) do nothing;

  -- The other person's part of the same fact: minutes only. The systems fee is
  -- paid once, by whoever the card charges for the stage.
  if v_extra is distinct from r.borne_by and coalesce(p_extra_minutes, 0) > 0 then
    insert into public.cost_events (
      stage, fact_id, entrepreneur_id, community_id, staff_minutes, amount_cents, borne_by, phase,
      is_simulated, created_at, rate_version
    ) values (
      p_stage, p_fact_id, p_entrepreneur_id, v_community, p_extra_minutes,
      round(p_extra_minutes * r.hourly_rate_cents / 60.0),
      v_extra, r.phase, coalesce(p_is_simulated, false), v_at, v_card
    )
    on conflict (stage, fact_id, borne_by) do nothing;
  end if;
end;
$$;

revoke all on function private.record_cost(
  public.cost_stage, uuid, uuid, uuid, boolean, timestamptz, integer, public.cost_bearer)
  from public, anon, authenticated;

-- The leader's ten minutes, named as hers.
create or replace function private.cost_on_checkin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.record_cost('checkin', new.id, new.entrepreneur_id, null, new.is_simulated, new.created_at,
    case when new.submitted_by is not null and new.submitted_by is distinct from
      (select profile_id from public.entrepreneurs where id = new.entrepreneur_id) then 10 else 0 end,
    'community');
  return new;
end $$;

-- ------------------------------------------------------------------ backfill
-- The check-ins already recorded. Each one that carried the leader's minutes
-- becomes two events: the platform keeps the fixed fee it really pays, and the
-- minutes move to the community, priced by the same card that priced them.

insert into public.cost_events (
  stage, fact_id, entrepreneur_id, community_id, staff_minutes, amount_cents, borne_by, phase,
  is_simulated, created_at, rate_version
)
select e.stage, e.fact_id, e.entrepreneur_id, e.community_id, e.staff_minutes,
  round(e.staff_minutes * r.hourly_rate_cents / 60.0),
  'community', e.phase, e.is_simulated, e.created_at, e.rate_version
from public.cost_events e
join public.cost_rates r on r.stage = e.stage and r.card_version = e.rate_version
where e.stage = 'checkin' and e.borne_by = 'empowerfi' and e.staff_minutes > 0
on conflict (stage, fact_id, borne_by) do nothing;

update public.cost_events e
set staff_minutes = 0, amount_cents = r.fixed_cents
from public.cost_rates r
where r.stage = e.stage and r.card_version = e.rate_version
  and e.stage = 'checkin' and e.borne_by = 'empowerfi' and e.staff_minutes > 0;
