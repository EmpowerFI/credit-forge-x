-- Her reward goes to her Conta.vc account.
--
-- Founder, 24/11/2026: the money for completing a campaign is deposited, by
-- hand, in the entrepreneur's personal account at Conta.vc. She opens that
-- account herself (subject to Conta.vc's approval) and gives the diary her
-- Conta.vc user, the "@" shown under her name in the app (e.g. @danbr). The
-- dashboard's "Rewards to pay" shows it beside each woman who completed.
--
-- And a campaign's reward may be in dollars: the 1 December campaign pays
-- US$ 1.50. programs.reward_cents stays the amount, in the cents of
-- programs.reward_currency (BRL by default); reward_brl_approx_cents is the
-- approximate value in reais that staff set, shown beside it as "~ R$". It is
-- typed, not read from fx_rates, which production may not fill.
--
-- campaign_rewards_due, diary_campaign_reward, diary_campaigns and
-- campaign_list are 20270107's, with the currency (and, in the first, her
-- handle) added.

-- ------------------------------------------------------------------ her handle

create table private.contavc_handles (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  handle          text not null check (handle ~ '^[a-z0-9_.]{2,30}$'),
  set_at          timestamptz not null default now()
);
revoke all on private.contavc_handles from public, anon, authenticated;

/** Her Conta.vc user, without the "@"; null when she has not given it. */
create function public.diary_contavc_get()
returns text
language sql stable security definer set search_path = ''
as $$
  select handle from private.contavc_handles where entrepreneur_id = private.diary_me()
$$;

/**
 * Sets her Conta.vc user, or clears it (null or blank). Trimmed, lowercased,
 * the leading "@" taken off; letters, digits, "_" and ".", 2 to 30 of them.
 * Returns what was kept.
 */
create function public.diary_contavc_set(p_handle text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_h text := lower(btrim(coalesce(p_handle, '')));
begin
  v_h := btrim(regexp_replace(v_h, '^@+', ''));
  if v_h = '' then
    delete from private.contavc_handles where entrepreneur_id = v_me;
    return null;
  end if;
  if v_h !~ '^[a-z0-9_.]{2,30}$' then
    raise exception 'contavc_handle_invalid' using errcode = '22023';
  end if;
  insert into private.contavc_handles (entrepreneur_id, handle) values (v_me, v_h)
  on conflict (entrepreneur_id) do update set handle = excluded.handle, set_at = now();
  return v_h;
end $$;

-- ------------------------------------------------------------------ the currency

alter table public.programs
  add column reward_currency text not null default 'BRL' check (reward_currency in ('BRL', 'USD')),
  add column reward_brl_approx_cents bigint check (reward_brl_approx_cents is null or reward_brl_approx_cents between 1 and 100000000);

/** A campaign's reward currency, and its approximate value in reais (dollars only). */
create function public.campaign_reward_currency_set(p_id uuid, p_currency text, p_brl_approx_cents bigint)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  if exists (select 1 from public.programs where id = p_id and is_default) then
    raise exception 'house_campaign_is_fixed' using errcode = '22023';
  end if;
  if not exists (select 1 from public.programs where id = p_id and not is_simulated) then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  if p_currency is null or p_currency not in ('BRL', 'USD') then
    raise exception 'currency_invalid' using errcode = '22023';
  end if;
  if p_brl_approx_cents is not null and p_brl_approx_cents not between 1 and 100000000 then
    raise exception 'reward_invalid' using errcode = '22023';
  end if;
  update public.programs
     set reward_currency = p_currency,
         reward_brl_approx_cents = case when p_currency = 'USD' then p_brl_approx_cents end,
         updated_at = now()
   where id = p_id;
end $$;

-- ------------------------------------------------------------------ what reads them

create or replace function public.campaign_rewards_due(p_program_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_g public.programs%rowtype;
  v_today date := private.sp_today();
begin
  perform private.require_campaign_manager();
  select * into v_g from public.programs where id = p_program_id and not is_simulated;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  return (
    with prog as (select * from private.campaign_progress(p_program_id, v_today))
    select jsonb_build_object(
      'seats', v_g.seats,
      'taken', (select count(*) from public.program_participants where program_id = p_program_id),
      'reward_cents', v_g.reward_cents,
      'reward_currency', v_g.reward_currency,
      'reward_brl_approx_cents', v_g.reward_brl_approx_cents,
      'without_handle', (select count(*) from prog x where x.done
                          and not exists (select 1 from private.contavc_handles h where h.entrepreneur_id = x.entrepreneur_id)),
      'completed', (select count(*) from prog where done),
      'paid', (select count(*) from public.program_reward_payments where program_id = p_program_id),
      'paid_cents', (select coalesce(sum(amount_cents), 0) from public.program_reward_payments where program_id = p_program_id),
      'to_pay_cents', coalesce(v_g.reward_cents, 0) * (select count(*) from prog
                                                         where done and not exists (select 1 from public.program_reward_payments r
                                                                                     where r.participant_id = prog.participant_id)),
      'people', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'participant_id', x.participant_id, 'email', x.email,
                 'name', e.display_name, 'city', e.city, 'state', e.state,
                 'enrolled', x.entrepreneur_id is not null,
                 'starts_on', x.starts_on, 'ends_on', x.ends_on, 'left_early', x.left_early,
                 'open_days', x.open_days, 'kept', x.kept, 'ended', x.ended, 'completed', x.done,
                 'paid_at', r.paid_at, 'paid_cents', r.amount_cents, 'paid_note', r.note,
                 'contavc', h.handle
               ) order by x.done desc, r.paid_at nulls first, x.kept desc, x.email)
          from prog x
          left join public.entrepreneurs e on e.id = x.entrepreneur_id
          left join public.program_reward_payments r on r.participant_id = x.participant_id
          left join private.contavc_handles h on h.entrepreneur_id = x.entrepreneur_id), '[]'::jsonb)
    ));
end $$;


create or replace function public.diary_campaign_reward()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_today date := private.sp_today();
  v_program uuid := private.program_on(v_me, v_today);
  v_g public.programs%rowtype;
begin
  select * into v_g from public.programs where id = v_program and not is_default and not is_simulated;
  if not found or v_g.reward_cents is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
             'campaign', v_g.name, 'reward_cents', v_g.reward_cents,
             'reward_currency', v_g.reward_currency, 'reward_brl_approx_cents', v_g.reward_brl_approx_cents,
             'until', c.ends_on,
             'open_days', c.open_days, 'kept', c.kept, 'completed', c.done,
             'paid_at', (select r.paid_at from public.program_reward_payments r where r.participant_id = c.participant_id))
      from private.campaign_progress(v_program, v_today) c
     where c.entrepreneur_id = v_me
     limit 1);
end $$;


create or replace function public.diary_campaigns()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_email text := private.my_email();
  v_today date := private.sp_today();
begin
  if private.program_on(v_me, v_today) <> private.house_program() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'name', g.name, 'description', g.description, 'sponsor_name', s.name,
             'period_end', g.period_end, 'logo_path', g.logo_path, 'link_url', g.link_url,
             'offers_rewards', g.offers_rewards, 'reward_cents', g.reward_cents,
             'reward_currency', g.reward_currency, 'reward_brl_approx_cents', g.reward_brl_approx_cents,
             'blocked_by', private.overlapping_campaign(v_email, v_today, g.period_end, null)
           ) order by g.period_end, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where g.enrolment = 'open' and not g.is_default and not g.is_simulated
       and v_today between g.period_start and g.period_end
       and not exists (select 1 from public.program_participants p where p.program_id = g.id and p.email = v_email)
       and (g.seats is null or (select count(*) from public.program_participants p where p.program_id = g.id) < g.seats)
  ), '[]'::jsonb);
end;
$$;


create or replace function public.campaign_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_campaign_manager();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id,
             'name', g.name,
             'description', g.description,
             'sponsor_id', s.id,
             'sponsor_name', s.name,
             'is_default', g.is_default,
             'enrolment', g.enrolment,
             'offers_rewards', g.offers_rewards,
             'reward_version', (select max(v.version) from public.reward_programme_versions v where v.program_id = g.id),
             'logo_path', g.logo_path,
             'is_real', g.is_real,
             'on_chain', exists (select 1 from public.campaign_vaults v where v.program_id = g.id),
             'link_url', g.link_url,
             'period_start', g.period_start,
             'period_end', g.period_end,
             'authorised', (select count(*) from public.program_participants p where p.program_id = g.id),
             'joined_herself', (select count(*) from public.program_participants p
                                 where p.program_id = g.id and p.joined_herself),
             'enrolled', (select count(*) from public.program_participants p
                           join auth.users u on lower(btrim(u.email)) = p.email
                           join public.entrepreneurs e on e.profile_id = u.id
                          where p.program_id = g.id),
             'viewers', coalesce((select jsonb_agg(v.email order by v.email) from public.sponsor_viewers v
                                   where v.sponsor_id = s.id), '[]'::jsonb),
             'cosponsors', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'sponsor_id', cs.id, 'name', cs.name, 'logo_path', c.logo_path, 'link_url', c.link_url,
                        'position', c.position,
                        'viewers', coalesce((select jsonb_agg(v.email order by v.email) from public.sponsor_viewers v
                                              where v.sponsor_id = cs.id), '[]'::jsonb)
                      ) order by c.position, cs.name)
                 from public.program_cosponsors c join public.sponsors cs on cs.id = c.sponsor_id
                where c.program_id = g.id), '[]'::jsonb),
             'partner_ids', coalesce((select jsonb_agg(pp.partner_id) from public.program_partners pp
                                       where pp.program_id = g.id), '[]'::jsonb),
             'seats', g.seats,
             'reward_cents', g.reward_cents,
             'reward_currency', g.reward_currency,
             'reward_brl_approx_cents', g.reward_brl_approx_cents
           ) order by g.is_default, g.period_start desc, g.name)
      from public.programs g join public.sponsors s on s.id = g.sponsor_id
     where not g.is_simulated
  ), '[]'::jsonb);
end;
$$;


-- ------------------------------------------------------------------ who may call what

revoke execute on function
  public.diary_contavc_get(), public.diary_contavc_set(text),
  public.campaign_reward_currency_set(uuid, text, bigint)
from public, anon;
grant execute on function public.diary_contavc_get(), public.diary_contavc_set(text) to authenticated;
grant execute on function public.campaign_reward_currency_set(uuid, text, bigint) to authenticated, service_role;
