-- A sponsor funds a campaign from its own wallet.
--
-- The sponsor is no longer EmpowerFI by default: whoever connects a wallet on
-- /app/missions creates the campaign and pays it into the vault, in one
-- transaction it signs. campaign-register then reads the chain -- the
-- campaign's account must say what EmpowerFI requires (its operator, its
-- half, devnet USDC, 100 seats, 30 days, funded in full) -- and records it
-- here through campaign_register().
--
-- What a wallet types (its name, the campaign's) is not shown to anyone
-- until EmpowerFI reviews it: a campaign is listed, on the open page and in
-- the diary, only once someone who manages campaigns approves it
-- (campaign_vault_list). A sponsor's name is its own: a wallet can reuse only
-- a name it registered, never one already in the dashboard.

alter table public.sponsors
  add column wallet text constraint a_sponsor_wallet_is_an_address check (wallet is null or wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$');

alter table public.campaign_vaults
  add column listed_at timestamptz,
  add column listed_by uuid;

-- Campaigns funded before this migration were created by EmpowerFI itself.
update public.campaign_vaults set listed_at = recorded_at where listed_at is null;

/**
 * The campaign campaign-register confirmed on chain. Service role only: the
 * function has checked the account; this writes the sponsor, the campaign
 * (invited, so no diary shows it yet) and its vault, in one go.
 */
create function public.campaign_register(p jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_sponsor_name text := btrim(coalesce(p ->> 'sponsor_name', ''));
  v_wallet text := p ->> 'sponsor_wallet';
  v_sponsor public.sponsors%rowtype;
  v_id uuid := (p ->> 'program_id')::uuid;
begin
  if char_length(v_name) not between 3 and 80 then
    raise exception 'campaign_name_length' using errcode = '22023';
  end if;
  if char_length(v_sponsor_name) not between 2 and 80 then
    raise exception 'sponsor_name_length' using errcode = '22023';
  end if;
  if exists (select 1 from public.programs where id = v_id) then
    return jsonb_build_object('status', 'already_registered', 'program_id', v_id);
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
    funded_units, funded_at)
  values (v_id, (p ->> 'seats')::integer, (p ->> 'price_per_seat_units')::bigint, (p ->> 'mint_decimals')::smallint,
    p ->> 'program_address', p ->> 'campaign_address', p ->> 'vault_address', p ->> 'mint', v_wallet, p ->> 'house_wallet',
    p ->> 'operator_wallet', p ->> 'terms_commitment', p ->> 'signature', p ->> 'signature',
    (p ->> 'funded_units')::bigint, (p ->> 'funded_at')::timestamptz);

  return jsonb_build_object('status', 'registered', 'program_id', v_id);
end $$;

/**
 * EmpowerFI reviews a wallet's campaign: listed, it shows on the open page and
 * opens for entrepreneurs to join from the diary; unlisted, it goes back.
 */
create function public.campaign_vault_list(p_program_id uuid, p_listed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.campaign_vaults
     set listed_at = case when p_listed then coalesce(listed_at, now()) end,
         listed_by = case when p_listed then auth.uid() end
   where program_id = p_program_id;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  update public.programs set enrolment = case when p_listed then 'open' else 'invited' end, updated_at = now()
   where id = p_program_id;
  return jsonb_build_object('program_id', p_program_id, 'listed', p_listed);
end $$;

-- The open page: as 20261222's, listed campaigns only, newest first, with
-- the sponsor's wallet beside the name it gave.
create or replace function public.campaign_vaults_public()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with c as (
    select v.*, g.name, g.description, g.period_start, g.period_end, s.name as sponsor_name, s.is_house,
           (select count(*) from private.campaign_cohort(v.program_id, private.sp_today()))::integer as enrolled,
           (select count(*) from private.campaign_cohort(v.program_id, private.sp_today()) k
             where k.kept >= v.unlock_days)::integer as engaged
      from public.campaign_vaults v
      join public.programs g on g.id = v.program_id
      join public.sponsors s on s.id = g.sponsor_id
     where v.listed_at is not null
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'program_id', c.program_id,
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
    'enrolled', case when c.enrolled >= private.campaign_min_group() then c.enrolled end,
    'engaged', case when c.enrolled >= private.campaign_min_group() then c.engaged end,
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

revoke execute on function public.campaign_register(jsonb) from public, anon, authenticated;
grant execute on function public.campaign_register(jsonb) to service_role;
revoke execute on function public.campaign_vault_list(uuid, boolean) from public, anon;
grant execute on function public.campaign_vault_list(uuid, boolean) to authenticated, service_role;
