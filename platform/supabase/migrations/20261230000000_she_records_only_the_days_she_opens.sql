-- She records only the days her business opens.
--
-- Founder's request, 10/11/2026: a Missions campaign still runs for 30
-- calendar days, but an entrepreneur no longer has to record a day her
-- business does not open. She completes the campaign when she has recorded
-- every day she opens within its 30 days (entrepreneurs.open_days, as she
-- set it in the diary). A business open every day still records all 30.
-- A day she records on a closed day still counts as kept (she sold, so it
-- was open, as in 20261218), but it does not stand in for an open day she
-- missed.
--
-- On chain nothing changes: unlock_days (30) is the campaign's window, and
-- the program checks who is paid against the root the operator attests.
-- Which women complete is decided here, in private.vault_cohort, and read by
-- the daily attestation and the open page.

drop function private.vault_cohort(uuid, date);

/**
 * Everyone in a vault campaign on a given day: the days she kept in its
 * window so far, how many days she opens in the whole window, and whether
 * she has recorded every one of them (so a day still to come is not yet
 * recorded, and she completes on the last day she opens).
 */
create function private.vault_cohort(p_program_id uuid, p_day date)
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
$$;

revoke execute on function private.vault_cohort(uuid, date) from public, anon, authenticated;

/** As 20261226's: a woman's salt and leaf once she has recorded every day she opens. */
create or replace function public.campaign_attestation_due()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := private.sp_today();
  v_g record;
  v_enrolled integer;
  v_leaves text[];
begin
  for v_g in
    select v.program_id, v.campaign_address, v.operator_wallet, v.unlock_days, g.period_start, g.period_end
      from public.campaign_vaults v join public.programs g on g.id = v.program_id
     where v.listed_at is not null
       and g.period_start <= v_today and coalesce(g.period_end, v_today) >= v_today - 1
       and not exists (select 1 from public.campaign_attestations a
                        where a.program_id = v.program_id and a.as_of = v_today)
     order by g.period_start
  loop
    select count(*) into v_enrolled from private.vault_cohort(v_g.program_id, v_today);
    continue when v_enrolled < private.campaign_min_group();

    insert into private.reward_wallets (entrepreneur_id)
    select c.entrepreneur_id from private.vault_cohort(v_g.program_id, v_today) c
    on conflict do nothing;
    insert into private.campaign_leaf_salts (program_id, entrepreneur_id)
    select v_g.program_id, c.entrepreneur_id from private.vault_cohort(v_g.program_id, v_today) c
     where c.done
    on conflict do nothing;

    select coalesce(array_agg(l.leaf order by l.leaf), '{}') into v_leaves
      from (select private.vault_leaf(v_g.program_id, w.ref, s.salt) as leaf
              from private.vault_cohort(v_g.program_id, v_today) c
              join private.campaign_leaf_salts s on s.program_id = v_g.program_id and s.entrepreneur_id = c.entrepreneur_id
              join private.reward_wallets w on w.entrepreneur_id = c.entrepreneur_id
             where c.done) l;

    return jsonb_build_object('program_id', v_g.program_id, 'as_of', v_today,
                              'campaign_address', v_g.campaign_address, 'operator_wallet', v_g.operator_wallet,
                              'enrolled', v_enrolled, 'leaves', to_jsonb(v_leaves));
  end loop;
  return null;
end $$;


/** As 20261228's: "engaged" counts those who recorded every day they open. */
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

