-- Her reward, kept or sent: the Seeker's reserve, a prototype.
--
-- Founder, 27/11/2026 (EmpowerFI_Estrategia_e_Implementacao, "Modo Guardar",
-- stage 1: a prototype, no real money). When a reward is paid into her
-- reward wallet on devnet she chooses:
--
--   keep  it stays in her reward wallet -- an address of the rewards program,
--         with no private key anywhere, never EmpowerFI's -- as her reserve;
--   send  it goes on to the wallet on her phone, each time, by itself
--         (the automatic transfer of PLAN_SEEKER.md §3.2).
--
-- She may change her mind at any time; sending stays her right. The reserve
-- earns nothing: the app shows a simulation of what a remunerated reserve
-- would give her, with the 90/10 split of the strategy, said to be a
-- simulation. No partner, no Pix, no custody: those are the strategy's next
-- stages, after the legal and partner checks it requires.
--
-- Additive only: one table and five functions. Nothing the web diary calls
-- changes; withdrawals go through the payout queue as the diary's do.

create table private.seeker_reward_choices (
  entrepreneur_id uuid primary key references public.entrepreneurs (id) on delete cascade,
  choice          text not null check (choice in ('keep', 'send')),
  -- She read what the reserve is (a prototype, no yield, free to send) and agreed.
  consented_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table private.seeker_reward_choices enable row level security;

/**
 * Sends her whole balance to her destination when she chose to send and the
 * program can: the destination is active, nothing is on its way, there is
 * something to send. True when a withdrawal was queued.
 */
create function private.seeker_send_if_ready(p_entrepreneur_id uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_destination text;
begin
  if not exists (select 1 from private.seeker_reward_choices
                  where entrepreneur_id = p_entrepreneur_id and choice = 'send') then
    return false;
  end if;
  select destination into v_destination from private.reward_payouts
   where entrepreneur_id = p_entrepreneur_id and active_from is not null and active_from <= now();
  if v_destination is null then
    return false;
  end if;
  if exists (select 1 from public.payout_ops where entrepreneur_id = p_entrepreneur_id and status in ('pending', 'sent')) then
    return false;
  end if;
  if (select balance from private.reward_balance(p_entrepreneur_id)) <= 0 then
    return false;
  end if;
  insert into public.payout_ops (kind, entrepreneur_id, destination)
  values ('withdraw_reward', p_entrepreneur_id, v_destination)
  on conflict do nothing;
  return found;
end $$;
revoke execute on function private.seeker_send_if_ready(uuid) from public, anon, authenticated;

/** Her reserve: what she chose, the balance, and every movement, newest first. */
create function public.seeker_reserve()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
  v_b record;
begin
  select * into v_b from private.reward_balance(v_me);
  return jsonb_build_object(
    'choice', (select choice from private.seeker_reward_choices where entrepreneur_id = v_me),
    'consented_at', (select consented_at from private.seeker_reward_choices where entrepreneur_id = v_me),
    'decimals', 6,
    'paid_units', v_b.paid,
    'withdrawn_units', v_b.withdrawn,
    'balance_units', v_b.balance,
    'sending', exists (select 1 from public.payout_ops
                        where entrepreneur_id = v_me and kind = 'withdraw_reward' and status in ('pending', 'sent')),
    -- The prototype's simulation (strategy, 27/11/2026): a hypothesis, not an offer.
    'simulation', jsonb_build_object('rate_bps', 1200, 'her_share_bps', 9000),
    'entries', coalesce((
      select jsonb_agg(x.e order by x.e ->> 'at' desc)
        from (select u.e from (
          select jsonb_build_object('kind', 'in', 'amount_units', cp.amount_units, 'campaign', g.name,
                                    'at', cp.confirmed_at, 'signature', cp.signature) as e
            from public.campaign_payments cp
            join private.reward_wallets w on w.ref = cp.wallet_ref
            join public.programs g on g.id = cp.program_id
           where w.entrepreneur_id = v_me and cp.status = 'confirmed'
             and not exists (select 1 from public.campaign_vaults v where v.program_id = cp.program_id and v.mirror)
          union all
          select jsonb_build_object('kind', 'out', 'amount_units', o.amount_units, 'destination', o.destination,
                                    'at', o.confirmed_at, 'signature', o.signature)
            from public.payout_ops o
           where o.entrepreneur_id = v_me and o.kind = 'withdraw_reward' and o.status = 'confirmed'
        ) u(e) order by u.e ->> 'at' desc limit 50) x), '[]'::jsonb)
  );
end $$;

/** She chooses to keep or to send; choosing to send sends what is there, when it can. */
create function public.seeker_reward_choose(p_choice text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := private.diary_me();
begin
  if p_choice is null or p_choice not in ('keep', 'send') then
    raise exception 'choice_invalid' using errcode = '22023';
  end if;
  insert into private.seeker_reward_choices (entrepreneur_id, choice)
  values (v_me, p_choice)
  on conflict (entrepreneur_id) do update set choice = excluded.choice, updated_at = now();
  perform private.seeker_send_if_ready(v_me);
  return public.seeker_reserve();
end $$;

/** The Seeker app, when it opens: hers, if she chose to send and it can go now. */
create function public.seeker_send_mine()
returns boolean
language sql security definer set search_path = ''
as $$
  select private.seeker_send_if_ready(private.diary_me())
$$;

/** reward-payout, each run: everyone who chose to send and whose reward can go now. */
create function public.seeker_send_due()
returns integer
language sql security definer set search_path = ''
as $$
  select count(*)::integer
    from private.seeker_reward_choices c
   where c.choice = 'send' and private.seeker_send_if_ready(c.entrepreneur_id)
$$;

revoke execute on function public.seeker_reserve(), public.seeker_reward_choose(text), public.seeker_send_mine()
  from public, anon;
grant execute on function public.seeker_reserve(), public.seeker_reward_choose(text), public.seeker_send_mine()
  to authenticated;
revoke execute on function public.seeker_send_due() from public, anon, authenticated;
grant execute on function public.seeker_send_due() to service_role;
