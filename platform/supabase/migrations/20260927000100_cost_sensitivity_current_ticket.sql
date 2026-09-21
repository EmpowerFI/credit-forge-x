-- The model has to include the ticket actually lent, or nobody can check it
--
-- cost_sensitivity() answered for the four tickets it was asked about, and none
-- of them is the average ticket here. A model nobody can compare against the
-- measurement is a claim. So the row for the ticket actually lent is always in
-- the answer, marked, and the page puts the measured number beside it.

create or replace function public.cost_sensitivity(
  p_program_id uuid default null,
  p_tickets_cents bigint[] default array[100000, 200000, 500000, 1000000]::bigint[],
  p_participants_per_loan numeric default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_card public.cost_rate_cards;
begin
  if not private.may_read_economics(p_program_id) then
    raise exception 'not_allowed_to_see_costs' using errcode = '42501';
  end if;
  if p_program_id is not null and not exists (select 1 from public.programs where id = p_program_id) then
    raise exception 'program_not_found' using errcode = 'P0002';
  end if;
  if coalesce(array_length(p_tickets_cents, 1), 0) not between 1 and 8
     or exists (select 1 from unnest(p_tickets_cents) t where t <= 0) then
    raise exception 'tickets_out_of_range' using errcode = '22023';
  end if;
  if p_participants_per_loan is not null and p_participants_per_loan <= 0 then
    raise exception 'conversion_out_of_range' using errcode = '22023';
  end if;

  select * into v_card from public.cost_rate_cards where version = private.rate_card_at(now());

  return (
    with card as (
      select r.stage, r.phase, r.borne_by,
        -- What one occurrence of the stage costs, by the card.
        round(r.staff_minutes * r.hourly_rate_cents / 60.0) + r.fixed_cents as cents
      from public.cost_rates r where r.card_version = v_card.version
    ),
    communities as materialized (
      select c.id from public.communities c
      where p_program_id is null
         or c.id in (select community_id from public.program_communities where program_id = p_program_id)
    ),
    people as materialized (
      select distinct m.entrepreneur_id from public.community_memberships m
      where m.community_id in (select id from communities)
    ),
    lent as materialized (
      select l.* from public.loans l
      where l.entrepreneur_id in (select entrepreneur_id from people)
        and l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED')
    ),
    occurrences as (
      select ce.stage, count(*)::numeric as n
      from public.cost_events ce
      where ce.community_id in (select id from communities)
         or ce.entrepreneur_id in (select entrepreneur_id from people)
      group by ce.stage
    ),
    basis as (
      select
        (select count(*) from people)::numeric as participants,
        (select count(*) from lent)::numeric as loans,
        (select coalesce(sum(principal_cents), 0) from lent)::numeric as disbursed
    ),
    -- How often each stage happens per unit: per participant for preparation,
    -- per loan for the rest. With no loans yet there is nothing to observe, so
    -- the model falls back to one occurrence per loan and twelve instalments,
    -- and says so.
    per_stage as (
      select c.stage, c.phase, c.borne_by, c.cents,
        case
          when c.phase = 'preparation' then
            case when b.participants > 0 then coalesce(o.n, 0) / b.participants end
          when b.loans > 0 then coalesce(o.n, 0) / b.loans
          when c.stage = 'servicing' then 12
          else 1
        end as per_unit
      from card c cross join basis b left join occurrences o on o.stage = c.stage
    ),
    model as (
      select
        coalesce(sum(p.cents * p.per_unit) filter (where p.phase <> 'preparation'), 0) as credit_per_loan,
        sum(p.cents * p.per_unit) filter (where p.phase = 'preparation') as pipeline_per_participant
      from per_stage p
    ),
    shape as (
      select m.credit_per_loan, m.pipeline_per_participant,
        coalesce(p_participants_per_loan, case when b.loans > 0 then b.participants / b.loans end) as conversion,
        case when p_participants_per_loan is not null then 'given'
             when b.loans > 0 then 'observed' end as conversion_source,
        case when b.loans > 0 then 'observed' else 'assumed' end as occurrence_basis,
        b.participants, b.loans, b.disbursed,
        case when b.loans > 0 then round(b.disbursed / b.loans) end as current_ticket_cents
      from model m cross join basis b
    ),
    -- The tickets asked about, and the one actually lent here beside them.
    asked as (
      select unnest(p_tickets_cents) as ticket, false as is_current
      union all
      select s.current_ticket_cents, true from shape s where s.current_ticket_cents is not null
    ),
    ticket_rows as (
      select ticket, bool_or(is_current) as is_current from asked group by ticket
    ),
    priced as (
      select t.ticket, t.is_current,
        round(s.credit_per_loan * 10000 / t.ticket)::bigint as credit_per_100_cents,
        case when s.conversion is not null
          then round((s.credit_per_loan + s.pipeline_per_participant * s.conversion) * 10000 / t.ticket)::bigint
        end as per_100_disbursed_cents
      from ticket_rows t cross join shape s
    )
    select jsonb_build_object(
      'card', jsonb_build_object(
        'version', v_card.version, 'source', v_card.source,
        'effective_from', v_card.effective_from, 'note', v_card.note),
      'basis', jsonb_build_object(
        'program_id', p_program_id,
        'participants', s.participants, 'loans', s.loans, 'disbursed_cents', s.disbursed,
        'current_ticket_cents', s.current_ticket_cents,
        'participants_per_loan', s.conversion,
        'participants_per_loan_source', s.conversion_source,
        'occurrences', s.occurrence_basis),
      'per_loan', jsonb_build_object(
        'credit_cents', round(s.credit_per_loan)::bigint,
        'pipeline_cents', case when s.conversion is not null
          then round(s.pipeline_per_participant * s.conversion)::bigint end,
        'by_stage', (
          select coalesce(jsonb_agg(jsonb_build_object(
              'stage', p.stage, 'phase', p.phase, 'borne_by', p.borne_by,
              'cents', p.cents,
              'per_unit_milli', round(p.per_unit * 1000)::bigint,
              'cents_per_loan', round(p.cents * p.per_unit *
                case when p.phase = 'preparation' then coalesce(s.conversion, 0) else 1 end)::bigint
            ) order by p.stage), '[]')
          from per_stage p where p.per_unit is not null and p.per_unit > 0)),
      'tickets', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'ticket_cents', r.ticket,
            'is_current', r.is_current,
            'credit_per_100_cents', r.credit_per_100_cents,
            'per_100_disbursed_cents', r.per_100_disbursed_cents
          ) order by r.ticket), '[]')
        from priced r)
    )
    from shape s
  );
end;
$$;

revoke all on function public.cost_sensitivity(uuid, bigint[], numeric) from public, anon;
grant execute on function public.cost_sensitivity(uuid, bigint[], numeric) to authenticated;
