-- A real campaign, mirrored in a vault on devnet.
--
-- Founder's request, 17/11/2026: test the vault with the campaigns that are
-- really running. EmpowerFI's operator creates and funds, on Solana devnet, a
-- campaign and its vault for a real campaign made in the dashboard: the same
-- id (so the same campaign address), the same days, at least 100 seats on
-- chain (the program's floor; more if the campaign has more), and a price per
-- seat whose entrepreneurs' half is the campaign's reward per woman, at a
-- nominal rate of test USDC per real chosen when it is made (1, 0.01 or 0.001
-- USDC per R$ 1: the operator funds it from the test USDC it holds).
--
-- The mirror is a campaign_vaults row with mirror = true on the real
-- campaign itself. From then on the daily attestation (campaign-attest) and
-- the devnet payouts run for it like any vault, but its cohort is the real
-- campaign's own participants (private.campaign_progress), not every woman of
-- the diary, and only those whose consent says yes to the impact figures, as
-- for every vault. Nothing else about the real campaign changes:
--
--   * it stays real (the devnet trigger leaves a mirror alone);
--   * it never enters the sponsors' review queue, and is listed from the
--     start: EmpowerFI made it. It cannot be unlisted or rejected;
--   * no co-sponsor vault can join it;
--   * the open Missions page does not show it: its sponsor did not pay it,
--     EmpowerFI's operator did;
--   * it does not make every woman of the diary one of its participants
--     (diary_my_programs);
--   * what the mirror pays into her reward wallet is test money and is not
--     shown in her diary as her reward (private.reward_balance): her real
--     reward is paid by hand, in reais (campaign_rewards_due).
--
-- campaign-mirror-devnet (owner only, from the dashboard) asks
-- campaign_mirror_plan, sends the transaction, checks the chain and records
-- it with campaign_mirror_record. campaign_mirror() is the dashboard's card.

alter table public.campaign_vaults
  add column mirror boolean not null default false,
  add column mirror_units_per_brl integer,
  add constraint a_mirror_has_a_rate check (mirror = (mirror_units_per_brl is not null)),
  add constraint a_mirror_rate_is_one_of_three check (mirror_units_per_brl is null or mirror_units_per_brl in (1000, 10000, 1000000));

-- ------------------------------------------------------------------ it stays what it is

/** As 20261229's: a Missions campaign is devnet when recorded; a mirror leaves its real campaign real. */
create or replace function private.a_vault_campaign_is_devnet()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.mirror then
    update public.programs set is_real = false where id = new.program_id;
  end if;
  return new;
end $$;

/** A mirror stays one, listed and not rejected; no vault joins a mirror. */
create function private.a_mirror_stays_a_mirror()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.joins is not null and exists (select 1 from public.campaign_vaults where program_id = new.joins and mirror) then
      raise exception 'no_such_lead' using errcode = 'P0002';
    end if;
    return new;
  end if;
  if new.mirror is distinct from old.mirror
     or (old.mirror and (new.listed_at is null or new.rejected_at is not null)) then
    raise exception 'campaign_is_a_mirror' using errcode = '22023';
  end if;
  return new;
end $$;
revoke execute on function private.a_mirror_stays_a_mirror() from public, anon, authenticated;
create trigger a_mirror_stays_a_mirror before insert or update on public.campaign_vaults
  for each row execute function private.a_mirror_stays_a_mirror();

-- ------------------------------------------------------------------ making it

/** What the operator must put on chain for a real campaign's mirror, at p_units_per_brl test-USDC units per R$ 1. */
create function public.campaign_mirror_plan(p_program_id uuid, p_units_per_brl integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
  v_seats integer;
  v_price bigint;
begin
  perform private.require_campaign_manager();
  select * into v_g from public.programs where id = p_program_id and not is_simulated;
  if v_g.id is null then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if v_g.is_default then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if not v_g.is_real then
    raise exception 'campaign_is_devnet' using errcode = '22023';
  end if;
  if exists (select 1 from public.campaign_vaults where program_id = p_program_id) then
    raise exception 'already_on_chain' using errcode = '23505';
  end if;
  if v_g.reward_cents is null then
    raise exception 'campaign_has_no_reward' using errcode = '22023';
  end if;
  if v_g.period_end is null or v_g.period_end - v_g.period_start + 1 < 30 then
    raise exception 'campaign_shorter_than_30_days' using errcode = '22023';
  end if;
  if v_g.period_end < private.sp_today() then
    raise exception 'campaign_over' using errcode = '22023';
  end if;
  if p_units_per_brl is null or p_units_per_brl not in (1000, 10000, 1000000) then
    raise exception 'rate_invalid' using errcode = '22023';
  end if;
  v_seats := greatest(coalesce(v_g.seats, 0), 100);
  -- The entrepreneurs' half of a seat is her reward: the price is twice it.
  v_price := v_g.reward_cents * p_units_per_brl * 2 / 100;
  if v_price < 10000 then
    raise exception 'price_below_minimum' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'program_id', v_g.id, 'name', v_g.name,
    'starts_on', v_g.period_start, 'ends_on', v_g.period_end,
    'seats', v_g.seats, 'seats_on_chain', v_seats,
    'reward_cents', v_g.reward_cents, 'units_per_brl', p_units_per_brl,
    'price_per_seat_units', v_price::text, 'funded_units', (v_price * v_seats)::text,
    'mint_decimals', 6);
end $$;

/**
 * The mirror campaign-mirror-devnet confirmed on chain. Service role only:
 * the function checked the account against campaign_mirror_plan.
 */
create function public.campaign_mirror_record(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := (p ->> 'program_id')::uuid;
begin
  if not exists (select 1 from public.programs where id = v_id and is_real and not is_default and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  insert into public.campaign_vaults (program_id, seats, price_per_seat_units, mint_decimals, program_address,
    campaign_address, vault_address, mint, sponsor_wallet, house_wallet, operator_wallet, terms_commitment,
    created_signature, funded_signature, funded_units, funded_at, listed_at, listed_by, mirror, mirror_units_per_brl)
  values (v_id, (p ->> 'seats')::integer, (p ->> 'price_per_seat_units')::bigint, (p ->> 'mint_decimals')::smallint,
    p ->> 'program_address', p ->> 'campaign_address', p ->> 'vault_address', p ->> 'mint', p ->> 'sponsor_wallet',
    p ->> 'house_wallet', p ->> 'operator_wallet', p ->> 'terms_commitment', p ->> 'created_signature',
    p ->> 'funded_signature', (p ->> 'funded_units')::bigint, (p ->> 'funded_at')::timestamptz,
    now(), nullif(p ->> 'by', '')::uuid, true, (p ->> 'units_per_brl')::integer)
  on conflict (program_id) do nothing;
  if not found then
    raise exception 'already_on_chain' using errcode = '23505';
  end if;
  return jsonb_build_object('program_id', v_id, 'status', 'recorded');
end $$;

/** The dashboard's card: a campaign's mirror, if it has one, with what happened on chain. */
create function public.campaign_mirror(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return (
    select jsonb_build_object(
      'program_id', v.program_id, 'cluster', v.cluster, 'units_per_brl', v.mirror_units_per_brl,
      'seats', v.seats, 'price_per_seat_units', v.price_per_seat_units::text,
      'funded_units', v.funded_units::text, 'mint_decimals', v.mint_decimals,
      'campaign_address', v.campaign_address, 'vault_address', v.vault_address,
      'funded_signature', v.funded_signature, 'funded_at', v.funded_at,
      'attestations', coalesce((
        select jsonb_agg(jsonb_build_object('as_of', a.as_of, 'enrolled', a.enrolled, 'engaged', a.engaged,
                                            'status', a.status, 'signature', a.signature) order by a.as_of desc)
          from (select * from public.campaign_attestations a where a.program_id = v.program_id
                 order by a.as_of desc limit 5) a), '[]'::jsonb),
      'paid', (select jsonb_build_object('count', count(*), 'units', coalesce(sum(cp.amount_units), 0)::text)
                 from public.campaign_payments cp where cp.program_id = v.program_id and cp.status = 'confirmed'))
      from public.campaign_vaults v
     where v.program_id = p_program_id and v.mirror);
end $$;

revoke execute on function public.campaign_mirror_plan(uuid, integer), public.campaign_mirror(uuid),
  public.campaign_mirror_record(jsonb) from public, anon;
revoke execute on function public.campaign_mirror_record(jsonb) from authenticated;
grant execute on function public.campaign_mirror_plan(uuid, integer), public.campaign_mirror(uuid) to authenticated, service_role;
grant execute on function public.campaign_mirror_record(jsonb) to service_role;

-- ------------------------------------------------------------------ who it attests

/**
 * As 20261230's for a Missions vault. For a mirror: the real campaign's own
 * participants who have a diary and share their impact figures, from the day
 * each started, without those who left; complete as the dashboard counts it
 * (campaign_progress: every day she opens in her window recorded, the window
 * over).
 */
create or replace function private.vault_cohort(p_program_id uuid, p_day date)
returns table (entrepreneur_id uuid, kept integer, open_days integer, done boolean)
language sql stable security definer set search_path = ''
as $$
  select m.id,
         (select count(*)::integer from public.journal_days d
           where d.entrepreneur_id = m.id
             and d.day between g.period_start and least(p_day, coalesce(g.period_end, p_day))),
         (select count(*)::integer from generate_series(g.period_start, coalesce(g.period_end, p_day), interval '1 day') s(day)
           where private.opens_on(e.open_days, s.day::date)),
         not exists (
           select 1 from generate_series(g.period_start, coalesce(g.period_end, p_day), interval '1 day') s(day)
            where private.opens_on(e.open_days, s.day::date)
              and (s.day::date > p_day
                   or not exists (select 1 from public.journal_days d
                                   where d.entrepreneur_id = m.id and d.day = s.day::date)))
    from private.diary_members() m
    join public.entrepreneurs e on e.id = m.id
    join public.programs g on g.id = p_program_id
   where private.shares_impact(m.id)
     and not exists (select 1 from public.campaign_vaults v where v.program_id = p_program_id and v.mirror)
  union all
  select c.entrepreneur_id, c.kept, c.open_days, c.done
    from private.campaign_progress(p_program_id, p_day) c
   where exists (select 1 from public.campaign_vaults v where v.program_id = p_program_id and v.mirror)
     and c.entrepreneur_id is not null
     and not c.left_early
     and c.starts_on <= p_day
     and private.shares_impact(c.entrepreneur_id)
$$;

-- ------------------------------------------------------------------ what she sees

/** As 20270104's: test money a mirror paid her is not her reward; her real one is paid in reais. */
create or replace function private.reward_balance(p_entrepreneur_id uuid)
returns table (paid bigint, withdrawn bigint, balance bigint)
language sql stable security definer set search_path = ''
as $$
  with p as (
    select coalesce(sum(cp.amount_units), 0)::bigint as paid
      from public.campaign_payments cp
      join private.reward_wallets w on w.ref = cp.wallet_ref
     where w.entrepreneur_id = p_entrepreneur_id and cp.status = 'confirmed'
       and not exists (select 1 from public.campaign_vaults v where v.program_id = cp.program_id and v.mirror)
  ), o as (
    select coalesce(sum(o.amount_units) filter (where o.status = 'confirmed'), 0)::bigint as out_confirmed,
           bool_or(o.status in ('pending', 'sent')) as in_flight
      from public.payout_ops o
     where o.entrepreneur_id = p_entrepreneur_id and o.kind = 'withdraw_reward'
  )
  -- A withdrawal on its way takes everything there is.
  select p.paid, o.out_confirmed,
         case when coalesce(o.in_flight, false) then 0 else greatest(p.paid - o.out_confirmed, 0) end
    from p, o
$$;

/** As 20270106's, without a mirror: its vault does not make every woman one of its participants. */
create or replace function private.diary_my_programs(p_me uuid)
returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_email text := private.email_of(p_me);
begin
  return query
    select g.id
      from public.programs g
     where g.is_real and not g.is_default and not g.is_simulated
       and g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today
       and (exists (select 1 from public.program_participants p
                     where p.program_id = g.id and p.email = v_email and p.starts_on <= v_today
                       and coalesce(private.participation_end(p.ends_on, p.program_id), v_today) >= v_today)
            or (private.shares_impact(p_me) and exists (
                  select 1 from public.campaign_vaults v
                   where v.program_id = g.id and v.listed_at is not null and not v.mirror
                     and (v.joins is null or exists (select 1 from public.campaign_vaults l
                                                      where l.program_id = v.joins and l.listed_at is not null)))));
end $$;
revoke execute on function private.diary_my_programs(uuid) from public, anon, authenticated;

/** As 20261230's, without the mirrors: EmpowerFI paid them, not their sponsor. */
create or replace function public.campaign_vaults_public()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select v.*, g.name, g.description, g.period_start, g.period_end, s.name as sponsor_name, s.is_house,
           k.participants, k.active, k.engaged, k.avg_days
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
      cross join lateral (
        select count(*)::integer as participants,
               count(*) filter (where x.kept >= 1)::integer as active,
               count(*) filter (where x.done)::integer as engaged,
               round(avg(x.kept) filter (where x.kept >= 1), 1) as avg_days
          from private.vault_cohort(v.program_id, private.sp_today()) x) k
     where v.listed_at is not null and not v.mirror
       and (v.joins is null or exists (select 1 from public.campaign_vaults l
                                        where l.program_id = v.joins and l.listed_at is not null))
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'program_id', c.program_id,
    'joins', c.joins,
    'name', c.name,
    'description', c.description,
    'sponsor', c.sponsor_name,
    'sponsor_is_house', c.is_house,
    'period_start', c.period_start,
    'period_end', c.period_end,
    'reward_kind', c.reward_kind,
    'seats', c.seats,
    'price_per_seat_units', c.price_per_seat_units,
    'mint_decimals', c.mint_decimals,
    'house_share_bps', c.house_share_bps,
    'unlock_days', c.unlock_days,
    'min_group', private.campaign_min_group(),
    'enrolled', case when c.participants >= private.campaign_min_group() then c.participants end,
    'active', case when c.participants >= private.campaign_min_group() then c.active end,
    'engaged', case when c.participants >= private.campaign_min_group() then c.engaged end,
    'avg_days', case when c.participants >= private.campaign_min_group() then c.avg_days end,
    'paid', (select jsonb_build_object('count', count(*), 'units', coalesce(sum(p.amount_units), 0))
               from public.campaign_payments p where p.program_id = c.program_id and p.status = 'confirmed'),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object('recipient', p.recipient_address, 'amount_units', p.amount_units,
                                          'signature', p.signature, 'block_time', p.block_time)
                       order by p.confirmed_at desc)
        from (select * from public.campaign_payments p
               where p.program_id = c.program_id and p.status = 'confirmed'
               order by p.confirmed_at desc limit 20) p), '[]'::jsonb),
    'chain', jsonb_build_object(
      'cluster', c.cluster, 'program', c.program_address, 'campaign', c.campaign_address,
      'vault', c.vault_address, 'mint', c.mint, 'sponsor_wallet', c.sponsor_wallet,
      'house_wallet', c.house_wallet, 'operator_wallet', c.operator_wallet,
      'terms_commitment', c.terms_commitment, 'created_signature', c.created_signature,
      'funded_signature', c.funded_signature, 'funded_units', c.funded_units, 'funded_at', c.funded_at),
    'attestations', coalesce((
      select jsonb_agg(jsonb_build_object('as_of', a.as_of, 'enrolled', a.enrolled, 'engaged', a.engaged,
                                          'root', a.root, 'signature', a.signature, 'block_time', a.block_time)
                       order by a.as_of desc)
        from (select * from public.campaign_attestations a
               where a.program_id = c.program_id and a.status = 'confirmed'
               order by a.as_of desc limit 30) a), '[]'::jsonb)
  ) order by c.funded_at desc), '[]'::jsonb)
  from c
$$;

/** As 20270106's, without the mirrors: EmpowerFI made them, there is nothing to review. */
create or replace function public.campaign_vault_review()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'program_id', v.program_id,
             'name', g.name,
             'description', g.description,
             'sponsor', s.name,
             'sponsor_wallet', v.sponsor_wallet,
             'cluster', v.cluster,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'seats', v.seats,
             'funded_units', v.funded_units,
             'mint_decimals', v.mint_decimals,
             'campaign_address', v.campaign_address,
             'funded_signature', v.funded_signature,
             'funded_at', v.funded_at,
             'listed_at', v.listed_at,
             'rejected_at', v.rejected_at,
             'rejected_reason', v.rejected_reason,
             'joins', v.joins,
             'joins_listed', (select l.listed_at is not null from public.campaign_vaults l where l.program_id = v.joins)
           ) order by case when v.rejected_at is not null then 2 when v.listed_at is not null then 1 else 0 end, v.funded_at desc)
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
     where not v.mirror
  ), '[]'::jsonb);
end;
$$;
