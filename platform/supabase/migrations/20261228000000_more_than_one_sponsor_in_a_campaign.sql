-- More than one sponsor in a campaign.
--
-- A campaign can now be co-sponsored. Each co-sponsor pays its own vault on
-- Solana, a campaign of the same program with the same 30 days, and the
-- database records which campaign it joins (campaign_vaults.joins). The open
-- page shows them as one campaign with every sponsor and the sum of what they
-- put in; an entrepreneur who keeps the days is paid once by each vault, so
-- her rewards add up. Each sponsor's money stays in its own vault, under its
-- own account on chain: nothing in the program changes.
--
-- Rules, checked here because the page that registers is open to anyone:
--   * a co-sponsorship joins a lead campaign, never another co-sponsorship;
--   * the lead is published, and still running on the day it is registered
--     (a co-sponsor may join until the last day; the days already kept count,
--     as the cohort is the same);
--   * its days are the lead's days;
--   * a wallet does not co-sponsor its own campaign, nor the same one twice.
-- It is reviewed like any vault before it shows (campaign_vault_list).

alter table public.campaign_vaults
  add column joins uuid references public.campaign_vaults (program_id) on delete restrict,
  add constraint campaign_vaults_joins_another check (joins is distinct from program_id);
create index campaign_vaults_joins on public.campaign_vaults (joins) where joins is not null;

/** As 20261223's, with p.joins: the lead campaign this one co-sponsors. */
create or replace function public.campaign_register(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_sponsor_name text := btrim(coalesce(p ->> 'sponsor_name', ''));
  v_wallet text := p ->> 'sponsor_wallet';
  v_sponsor public.sponsors%rowtype;
  v_id uuid := (p ->> 'program_id')::uuid;
  v_joins uuid := nullif(p ->> 'joins', '')::uuid;
  v_lead record;
begin
  if exists (select 1 from public.programs where id = v_id) then
    return jsonb_build_object('status', 'already_registered', 'program_id', v_id);
  end if;

  if v_joins is not null then
    select v.program_id, v.joins, v.listed_at, g.name, g.period_start, g.period_end
      into v_lead
      from public.campaign_vaults v join public.programs g on g.id = v.program_id
     where v.program_id = v_joins;
    if not found or v_lead.joins is not null or v_lead.listed_at is null then
      raise exception 'no_such_lead' using errcode = 'P0002';
    end if;
    if v_lead.period_end < private.sp_today() then
      raise exception 'lead_ended' using errcode = '22023';
    end if;
    if (p ->> 'period_start')::date is distinct from v_lead.period_start
       or (p ->> 'period_end')::date is distinct from v_lead.period_end then
      raise exception 'dates_differ' using errcode = '22023';
    end if;
    if exists (select 1 from public.campaign_vaults v
                where (v.program_id = v_joins or v.joins = v_joins) and v.sponsor_wallet = v_wallet) then
      raise exception 'already_sponsoring' using errcode = '23505';
    end if;
    -- A co-sponsorship carries the lead's name: it is the same campaign.
    v_name := v_lead.name;
  end if;

  if char_length(v_name) not between 3 and 80 then
    raise exception 'campaign_name_length' using errcode = '22023';
  end if;
  if char_length(v_sponsor_name) not between 2 and 80 then
    raise exception 'sponsor_name_length' using errcode = '22023';
  end if;

  select * into v_sponsor from public.sponsors where lower(name) = lower(v_sponsor_name);
  if found and v_sponsor.wallet is distinct from v_wallet then
    -- The house, a dashboard sponsor, or another wallet's name.
    raise exception 'sponsor_name_taken' using errcode = '23505';
  end if;
  if not found then
    insert into public.sponsors (name, kind, wallet) values (v_sponsor_name, 'company', v_wallet) returning * into v_sponsor;
  end if;

  begin
    insert into public.programs (id, sponsor_id, name, period_start, period_end, enrolment)
    values (v_id, v_sponsor.id, v_name, (p ->> 'period_start')::date, (p ->> 'period_end')::date, 'invited');
  exception when unique_violation then
    raise exception 'campaign_name_taken' using errcode = '23505';
  end;

  insert into public.campaign_vaults (program_id, seats, price_per_seat_units, mint_decimals, program_address, campaign_address,
    vault_address, mint, sponsor_wallet, house_wallet, operator_wallet, terms_commitment, created_signature, funded_signature,
    funded_units, funded_at, joins)
  values (v_id, (p ->> 'seats')::integer, (p ->> 'price_per_seat_units')::bigint, (p ->> 'mint_decimals')::smallint,
    p ->> 'program_address', p ->> 'campaign_address', p ->> 'vault_address', p ->> 'mint', v_wallet, p ->> 'house_wallet',
    p ->> 'operator_wallet', p ->> 'terms_commitment', p ->> 'signature', p ->> 'signature',
    (p ->> 'funded_units')::bigint, (p ->> 'funded_at')::timestamptz, v_joins);

  return jsonb_build_object('status', 'registered', 'program_id', v_id, 'joins', v_joins);
end $$;

revoke execute on function public.campaign_register(jsonb) from public, anon, authenticated;
grant execute on function public.campaign_register(jsonb) to service_role;

/**
 * As 20261226's, with `joins`. A co-sponsorship shows only once both it and
 * its lead are published; the page puts it under its lead.
 */
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
               count(*) filter (where x.kept >= v.unlock_days)::integer as engaged,
               round(avg(x.kept) filter (where x.kept >= 1), 1) as avg_days
          from private.vault_cohort(v.program_id, private.sp_today()) x) k
     where v.listed_at is not null
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

/** As 20261227's, with the campaign a co-sponsorship joins, by id and by name. */
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
             'joins', v.joins,
             'joins_listed', (select l.listed_at is not null from public.campaign_vaults l where l.program_id = v.joins)
           ) order by v.listed_at is not null, v.funded_at desc)
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.campaign_vault_review() from public, anon;
grant execute on function public.campaign_vault_review() to authenticated, service_role;
