-- The investor's side of a funded loan, as something a wallet can hold
--
-- The borrower's experience does not change: she asked for reais, she gets
-- reais by Pix, and she repays instalments. What changes is the investor's:
-- her funding position becomes a credit position with an identity, an owner
-- and a history, and — once minted — a token on Devnet that says who owns it
-- without asking this database.
--
-- Three decisions are built into this table rather than argued in the UI.
--
-- One position per *investment*, not per opportunity. A funded opportunity
-- here has up to eight investors; an asset per opportunity would have no
-- owner. Everything in money on a position is her share, and the loan's own
-- figures are read from the loan and labelled as the loan's.
--
-- A position cannot exist before its opportunity is funded, because the only
-- thing that writes one is a trigger on that transition. It is a constraint,
-- not a check somebody has to remember.
--
-- The state is not stored. A position is active, paid or delinquent because
-- its loan is, and storing a copy here would be a second answer to a question
-- the loans table already answers. Ownership is stored, because after the
-- first transfer this database is no longer the only one who knows it — and
-- the token is then the record, with this row as its index.

create table public.credit_positions (
  id uuid primary key default gen_random_uuid(),
  -- One investment, one position. An investor who funds the same opportunity
  -- twice holds two positions, which is what she did.
  investment_id uuid not null unique references public.investments (id) on delete cascade,
  opportunity_id uuid not null references public.qualified_credit_opportunities (id) on delete cascade,
  investor_id uuid not null references public.profiles (id) on delete cascade,
  -- EF-CREDIT-1042. A number with no meaning outside this platform: it says
  -- nothing about who borrowed, where, or for what.
  asset_no bigint generated always as identity (start with 1001) not null unique,
  -- Her share of the loan, struck when the opportunity filled and never
  -- recomputed: later refunds or top-ups do not rewrite what she bought.
  share_bps integer not null check (share_bps between 0 and 10000),
  principal_micro_usdc bigint not null check (principal_micro_usdc > 0),

  -- The chain. Null until minted; a position is a real thing before it is a
  -- token, and one that never gets minted is still hers.
  mint_address text,
  owner_wallet text,
  token_account text,
  mint_signature text,
  minted_at timestamptz,

  -- Set when the loan is settled and her share has been paid back.
  closed_at timestamptz,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.credit_positions is
  'One investor''s economic position in one funded loan. A Devnet prototype of a future regulated tokenised credit asset; it confers no legal right by itself.';

create index credit_positions_investor on public.credit_positions (investor_id, created_at desc);
create index credit_positions_opportunity on public.credit_positions (opportunity_id);
create unique index credit_positions_mint on public.credit_positions (mint_address) where mint_address is not null;

-- ------------------------------------------------------------- who may hold
-- Transferability without a list of who may receive is not controlled
-- transferability. The list is enforced on chain as well as here: a token
-- account for one of these mints is frozen when it is created, and only a
-- wallet on this list gets thawed.

create table public.eligible_wallets (
  wallet text primary key check (length(wallet) between 32 and 44),
  label text not null,
  note text,
  admitted_by uuid references public.profiles (id),
  active boolean not null default true,
  is_simulated boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.eligible_wallets is
  'Wallets admitted to hold a credit position on Devnet. Prototype eligibility: it stands in for the investor eligibility a regulated structure would define.';

-- ---------------------------------------------------------------- what happened
-- Creation, mint, each payment that reached her, each change of owner, and
-- the close. A signature where the event happened on chain, and none where it
-- did not — an event without one is a database fact and reads as one.

create table public.position_events (
  id bigint generated always as identity primary key,
  position_id uuid not null references public.credit_positions (id) on delete cascade,
  kind text not null check (kind in ('created', 'minted', 'payment', 'transferred', 'closed')),
  from_wallet text,
  to_wallet text,
  signature text,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index position_events_position on public.position_events (position_id, occurred_at, id);
create unique index position_events_signature on public.position_events (signature) where signature is not null;

-- ------------------------------------------------------- created when funded
-- The share is investment ÷ funding target, the same arithmetic
-- investor_position() has used since settlement was built.

create function private.open_positions(p_opportunity_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_opp public.qualified_credit_opportunities;
  v_new uuid;
  r record;
begin
  select * into v_opp from public.qualified_credit_opportunities where id = p_opportunity_id;
  if v_opp.funding_status is distinct from 'funded' or coalesce(v_opp.funding_target_micro_usdc, 0) = 0 then
    return;
  end if;
  for r in
    select i.* from public.investments i
    where i.opportunity_id = p_opportunity_id and i.status = 'allocated'
      and not exists (select 1 from public.credit_positions p where p.investment_id = i.id)
  loop
    insert into public.credit_positions (
      investment_id, opportunity_id, investor_id, share_bps, principal_micro_usdc, owner_wallet, is_simulated
    ) values (
      r.id, p_opportunity_id, r.investor_id,
      least(10000, round(r.amount_micro_usdc * 10000.0 / v_opp.funding_target_micro_usdc)),
      r.amount_micro_usdc, r.wallet_address, coalesce(r.is_simulated, false)
    )
    returning id into v_new;
    insert into public.position_events (position_id, kind, to_wallet, detail, occurred_at)
    values (v_new, 'created', r.wallet_address,
      jsonb_build_object('investment_id', r.id, 'mode', r.mode), coalesce(v_opp.allocated_at, now()));
  end loop;
end;
$$;

revoke all on function private.open_positions(uuid) from public, anon, authenticated;

create function private.positions_on_funded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.funding_status = 'funded' and old.funding_status is distinct from 'funded' then
    perform private.open_positions(new.id);
  end if;
  return new;
end $$;

create trigger positions_on_funded after update of funding_status on public.qualified_credit_opportunities
  for each row execute function private.positions_on_funded();

-- The opportunities that filled before this table existed.
select private.open_positions(id) from public.qualified_credit_opportunities where funding_status = 'funded';

-- --------------------------------------------------------------------- reading
alter table public.credit_positions enable row level security;
alter table public.eligible_wallets enable row level security;
alter table public.position_events enable row level security;
revoke all on public.credit_positions, public.eligible_wallets, public.position_events from anon, authenticated;
grant select on public.credit_positions, public.eligible_wallets, public.position_events to authenticated;

create policy credit_positions_read on public.credit_positions for select to authenticated
  using (investor_id = (select auth.uid()) or (select private.is_auditor_or_admin()));
create policy position_events_read on public.position_events for select to authenticated
  using (exists (select 1 from public.credit_positions p
    where p.id = position_id and (p.investor_id = (select auth.uid()) or (select private.is_auditor_or_admin()))));
-- Who may hold one is not a secret: an investor deciding where to send a
-- position needs to see the list before she signs anything.
create policy eligible_wallets_read on public.eligible_wallets for select to authenticated using (active);
