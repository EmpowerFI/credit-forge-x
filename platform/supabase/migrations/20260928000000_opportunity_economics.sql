-- Operating economics, for one opportunity (MVP addendum §4, §9)
--
-- The addendum asks for an "estimated cost to serve" on each opportunity. The
-- estimate is the part to be careful with: the programme number on
-- /app/capital/economics counts every participant from the first community
-- onboarding, including everyone prepared who never borrows, because the
-- expensive part of small-ticket lending is the pipeline and not the loan. A
-- number built from one successful path comes out far lower, and two numbers
-- with the same name disagreeing in silence is the shape of a claim nobody
-- should trust.
--
-- So this records no estimate. It reports what was actually recorded for her —
-- a fact, out of cost_events — and hands back the programme's number beside
-- it, so the page can show both and name the gap between them for what it is.
--
-- And it freezes one snapshot, at the moment the opportunity opened for
-- funding: what her journey had cost by then, priced by the card in force
-- then, with the allocation engine's version. Later events do not change it,
-- and a new rate card does not either.

create table public.operating_economics_snapshots (
  opportunity_id uuid primary key references public.qualified_credit_opportunities (id) on delete cascade,
  -- The instant it describes: when the opportunity opened for funding.
  taken_at timestamptz not null,
  ticket_cents bigint not null,
  cost_total_cents bigint not null,
  staff_minutes integer not null,
  events integer not null,
  by_phase jsonb not null,
  by_stage jsonb not null,
  -- Her own costs against her own ticket. Not the programme's cost to serve,
  -- and never to be labelled as such.
  per_100_of_ticket_cents bigint,
  rate_card_version text not null references public.cost_rate_cards (version),
  allocation_model_version text,
  created_at timestamptz not null default now()
);

comment on table public.operating_economics_snapshots is
  'What one entrepreneur''s recorded journey had cost when her opportunity opened for funding. Her own costs only: the programme''s cost to serve is operating_economics(), which counts everyone prepared.';

alter table public.operating_economics_snapshots enable row level security;
revoke all on public.operating_economics_snapshots from anon, authenticated;
grant select on public.operating_economics_snapshots to authenticated;
-- The desk, auditors and admins; everyone else reads it through
-- opportunity_economics(), which has its own rule.
create policy operating_economics_snapshots_read on public.operating_economics_snapshots for select to authenticated using (
  (select private.is_auditor_or_admin()) or (select private.my_partner_id()) is not null
);

-- What her journey had cost by a given instant, priced as it was priced then.
create function private.journey_costs(p_entrepreneur_id uuid, p_until timestamptz)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'total_cents', coalesce(sum(amount_cents), 0),
    'staff_minutes', coalesce(sum(staff_minutes), 0),
    'events', count(*),
    'first_at', private.iso(min(created_at)),
    'last_at', private.iso(max(created_at)),
    'by_phase', jsonb_build_object(
      'preparation', coalesce(sum(amount_cents) filter (where phase = 'preparation'), 0),
      'origination', coalesce(sum(amount_cents) filter (where phase = 'origination'), 0),
      'servicing', coalesce(sum(amount_cents) filter (where phase = 'servicing'), 0)),
    'by_stage', (
      select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'phase', phase, 'events', n, 'cents', cents) order by stage), '[]')
      from (select stage, min(phase) as phase, count(*) as n, sum(amount_cents) as cents
            from public.cost_events
            where entrepreneur_id = p_entrepreneur_id and created_at <= coalesce(p_until, now())
            group by stage) s),
    'rate_cards', (
      select coalesce(jsonb_agg(distinct rate_version), '[]') from public.cost_events
      where entrepreneur_id = p_entrepreneur_id and created_at <= coalesce(p_until, now()))
  )
  from public.cost_events
  where entrepreneur_id = p_entrepreneur_id and created_at <= coalesce(p_until, now());
$$;

-- The snapshot, written once, when the opportunity opens for funding.
create function private.snapshot_opportunity_economics() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v jsonb;
begin
  if new.allocated_at is not null and (tg_op = 'INSERT' or old.allocated_at is null) then
    v := private.journey_costs(new.entrepreneur_id, new.allocated_at);
    insert into public.operating_economics_snapshots (
      opportunity_id, taken_at, ticket_cents, cost_total_cents, staff_minutes, events,
      by_phase, by_stage, per_100_of_ticket_cents, rate_card_version, allocation_model_version
    ) values (
      new.id, new.allocated_at, new.amount_cents,
      (v ->> 'total_cents')::bigint, (v ->> 'staff_minutes')::integer, (v ->> 'events')::integer,
      v -> 'by_phase', v -> 'by_stage',
      case when new.amount_cents > 0 then round((v ->> 'total_cents')::numeric * 10000 / new.amount_cents) end,
      private.rate_card_at(new.allocated_at), new.allocation_model_version
    )
    on conflict (opportunity_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger snapshot_opportunity_economics after insert or update of allocated_at
  on public.qualified_credit_opportunities
  for each row execute function private.snapshot_opportunity_economics();

-- The opportunities that opened before this migration get the same snapshot the
-- trigger would have written: their costs up to the instant they opened, and
-- nothing after it.
insert into public.operating_economics_snapshots (
  opportunity_id, taken_at, ticket_cents, cost_total_cents, staff_minutes, events,
  by_phase, by_stage, per_100_of_ticket_cents, rate_card_version, allocation_model_version
)
select o.id, o.allocated_at, o.amount_cents,
  (v ->> 'total_cents')::bigint, (v ->> 'staff_minutes')::integer, (v ->> 'events')::integer,
  v -> 'by_phase', v -> 'by_stage',
  case when o.amount_cents > 0 then round((v ->> 'total_cents')::numeric * 10000 / o.amount_cents) end,
  private.rate_card_at(o.allocated_at), o.allocation_model_version
from public.qualified_credit_opportunities o
cross join lateral private.journey_costs(o.entrepreneur_id, o.allocated_at) v
where o.allocated_at is not null
on conflict (opportunity_id) do nothing;

-- ------------------------------------------------------------------ reading
-- Two numbers, never one. What her journey has cost, as recorded; and the
-- programme's cost per R$ 100 lent, unchanged, from operating_economics().
-- The gap between them is the pipeline, and the page has to say so.

create function public.opportunity_economics(p_opportunity_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  o public.qualified_credit_opportunities;
  v_role text := coalesce(private.my_role()::text, '');
  v_program uuid;
  v_prog jsonb;
  v_now jsonb;
begin
  select * into o from public.qualified_credit_opportunities where id = p_opportunity_id;
  if not found then
    raise exception 'opportunity_not_found' using errcode = 'P0002';
  end if;

  -- A sponsor reads it for a programme of its own that her community runs; the
  -- desk, auditors and admins read it over everything. Nobody else: an investor
  -- sees an opportunity, never what it cost to make one.
  if v_role not in ('partner', 'admin', 'auditor') then
    select p.id into v_program
    from public.programs p
    join public.program_communities pc on pc.program_id = p.id
    where p.sponsor_id = private.my_sponsor_id()
      and pc.community_id in (select community_id from public.community_memberships where entrepreneur_id = o.entrepreneur_id)
    limit 1;
    if v_program is null then
      raise exception 'not_allowed_to_see_costs' using errcode = '42501';
    end if;
  end if;

  v_now := private.journey_costs(o.entrepreneur_id, now());
  v_prog := public.operating_economics(v_program);

  return jsonb_build_object(
    'opportunity', jsonb_build_object(
      'id', o.id,
      'ticket_cents', o.amount_cents,
      'allocated_at', private.iso(o.allocated_at),
      'allocation_model_version', o.allocation_model_version),
    -- Recorded for her, enrolment to now. A fact, not an estimate.
    'so_far', v_now || jsonb_build_object(
      'per_100_of_ticket_cents',
      case when o.amount_cents > 0 then round((v_now ->> 'total_cents')::numeric * 10000 / o.amount_cents) end),
    -- Frozen when the opportunity opened for funding.
    'at_allocation', (
      select to_jsonb(s) - 'opportunity_id' - 'created_at'
      from public.operating_economics_snapshots s where s.opportunity_id = o.id),
    -- The programme, per R$ 100 lent: everyone counted, including everyone
    -- prepared who never borrowed.
    'programme', jsonb_build_object(
      'program_id', v_program,
      'per_100_disbursed_cents', v_prog #> '{cost,per_100_disbursed_cents}',
      'credit_per_100_disbursed_cents', v_prog #> '{cost,credit_per_100_disbursed_cents}',
      'participants', v_prog #> '{scope,participants}',
      'loans', v_prog #> '{cost,loans}',
      'disbursed_cents', v_prog #> '{cost,disbursed_cents}',
      'rate_card', v_prog #> '{cost,rate_card}')
  );
end;
$$;

revoke all on function public.opportunity_economics(uuid) from public, anon;
grant execute on function public.opportunity_economics(uuid) to authenticated;
revoke all on function private.journey_costs(uuid, timestamptz) from public, anon, authenticated;
