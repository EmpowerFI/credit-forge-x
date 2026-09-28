-- The Local Productive Capital Rail (addendum v3 §5).
--
-- Global capital reaches a business, and then what? Until now the answer ended
-- at her bank account: dollars became reais, Pix paid her, and the story
-- stopped. The thesis of v3 is that what happens next is the point — capital
-- that circulates inside a territory buys more prosperity than capital that
-- leaves it — and a thesis nobody can measure is a slogan.
--
-- So this is a ledger. Not a currency: a clearly labelled sandbox that models
-- the economic behaviour the demo needs, and says so in its own status column,
-- which has exactly one value. EmpowerFI issues nothing, custodies nothing and
-- redeems nothing here. Every figure this rail produces carries an evidence
-- label, and for this rail that label is "simulated assumption" everywhere.
--
-- What it deliberately is not (v3 §5, §12):
--
--   1. Not a municipal or community currency, in production or in intent. The
--      status enum has one value, 'demo', so a row cannot claim otherwise, and
--      no screen may describe this as money anyone can spend outside it.
--   2. Not a claim that local circulation causes prosperity. The multiplier,
--      the retention rate and the velocity measure network activity, and §8's
--      own guardrail says they prove none of the rest. The screens repeat it.
--   3. Not the productive exchange network already in the capital registry.
--      That route trades goods and services in a unit of account that is not
--      money and never repays; this rail carries capital she does repay. They
--      look alike on a diagram and they are different promises, so they stay in
--      different tables and different words.
--
-- Units and parity. Balances are integers in the smallest subdivision of the
-- local currency, the way every other amount in this product is centavos. The
-- parity to reais is basis points against those centavos: 10000 means one unit
-- is one centavo, which is the demo's 1 LOCAL = R$ 1. A parity that is not one
-- to one is expressible without a schema change, and nothing anywhere multiplies
-- by a float to find it.
--
-- Conservation. Issuance and redemption pass through the economy's own treasury
-- account rather than appearing from nowhere, so the sum of every balance in an
-- economy is constant and a ledger that has drifted can be caught by arithmetic
-- rather than by eye. Only the treasury may go negative — it is the issuer, and
-- what it owes is exactly what is circulating.

-- ------------------------------------------------------------------- the types

-- Every number the hackathon product shows carries one of these (v3 §9). The
-- vocabulary is the addendum's, so a judge reading a screen and a judge reading
-- the addendum are reading the same four words.
create type public.evidence_label as enum (
  'observed_pilot_data',
  'partner_provided',
  'simulated_assumption',
  'external_benchmark'
);

-- One value, on purpose. A local economy in this product is a demonstration,
-- and the schema is the cheapest place to make that unfalsifiable.
create type public.local_economy_status as enum ('demo');

create type public.local_owner_type as enum ('treasury', 'entrepreneur', 'merchant');

-- v3 §5. Six movements, and no others: a ledger whose vocabulary is open is a
-- ledger whose totals mean nothing.
create type public.local_transaction_type as enum (
  'capital_injection',
  'productive_purchase',
  'merchant_payment',
  'transfer',
  'repayment',
  'redemption'
);

create type public.local_redemption_status as enum ('requested', 'settled', 'failed');

create function private.local_rail_model_version()
returns text language sql immutable set search_path = ''
as $$ select 'local-rail-v1.0.0' $$;

-- --------------------------------------------------------------- the economies

create table public.local_economies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]{3,40}$'),
  name text not null check (char_length(name) between 2 and 120),
  -- The territory it covers, in the words the people there use, and the
  -- community this product already knows by that name where there is one.
  territory text not null check (char_length(territory) between 2 and 120),
  community_id uuid references public.communities (id) on delete restrict,
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  -- Three letters, like a currency code, and never a real one: checked against
  -- nothing because it is not one.
  currency_code text not null check (currency_code ~ '^[A-Z]{3,6}$'),
  -- Basis points of a BRL centavo per unit. 10000 is one to one.
  parity_bps integer not null default 10000 check (parity_bps between 1 and 1000000),
  parity_reference text not null check (char_length(parity_reference) <= 200),
  status public.local_economy_status not null default 'demo',
  -- Redundant with the status enum having one value, and kept because a screen
  -- reads this rather than reasoning about an enum's cardinality.
  is_simulated boolean not null default true check (is_simulated),
  created_at timestamptz not null default now()
);

comment on table public.local_economies is
  'A clearly labelled local-currency sandbox (addendum v3 §5). Not a municipal currency, in production or in intent.';

-- ---------------------------------------------------------------- the accounts

create table public.local_accounts (
  id uuid primary key default gen_random_uuid(),
  economy_id uuid not null references public.local_economies (id) on delete restrict,
  owner_type public.local_owner_type not null,
  -- The entrepreneur or the merchant this account belongs to. Null only for the
  -- treasury, which belongs to the economy itself.
  owner_id uuid,
  balance_units bigint not null default 0,
  created_at timestamptz not null default now(),
  -- One treasury per economy, one account per owner.
  constraint local_accounts_owner_shape check (
    (owner_type = 'treasury' and owner_id is null) or (owner_type <> 'treasury' and owner_id is not null)
  ),
  -- Only the issuer may be short: what the treasury owes is what circulates.
  constraint local_accounts_no_overdraft check (owner_type = 'treasury' or balance_units >= 0)
);

create unique index local_accounts_treasury on public.local_accounts (economy_id)
  where owner_type = 'treasury';
create unique index local_accounts_owner on public.local_accounts (economy_id, owner_type, owner_id)
  where owner_id is not null;

comment on column public.local_accounts.balance_units is
  'Cached from the transactions that moved it; private.local_account_balance() recomputes, and pgTAP holds the two to one answer.';

-- --------------------------------------------------------------- the merchants

create table public.local_merchants (
  id uuid primary key default gen_random_uuid(),
  economy_id uuid not null references public.local_economies (id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{3,40}$'),
  name text not null check (char_length(name) between 2 and 120),
  sector text not null check (char_length(sector) between 2 and 60),
  -- Where it is, at the grain the capital need asks about.
  neighbourhood text check (char_length(neighbourhood) <= 120),
  city text not null check (char_length(city) between 2 and 120),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  -- Whether productive capital may be spent here. A merchant outside the
  -- eligible set is not a fraud case; it is a purchase the rail will not fund.
  eligible boolean not null default true,
  is_simulated boolean not null default true check (is_simulated),
  created_at timestamptz not null default now(),
  unique (economy_id, code)
);

-- ------------------------------------------------------------ the transactions

create table public.local_transactions (
  id uuid primary key default gen_random_uuid(),
  economy_id uuid not null references public.local_economies (id) on delete restrict,
  -- Per economy, so a ledger can be read in the order it happened and a gap is
  -- visible rather than inferred.
  transaction_no integer not null,
  tx_type public.local_transaction_type not null,
  from_account_id uuid not null references public.local_accounts (id) on delete restrict,
  to_account_id uuid not null references public.local_accounts (id) on delete restrict,
  amount_units bigint not null check (amount_units > 0),
  -- What it bought, where the movement has a productive purpose.
  purpose public.credit_purpose,
  merchant_id uuid references public.local_merchants (id) on delete restrict,
  -- What this movement belongs to upstream, so the capital journey can be
  -- traced from an investor's dollars to a purchase and back.
  opportunity_id uuid references public.qualified_credit_opportunities (id) on delete restrict,
  loan_id uuid references public.loans (id) on delete restrict,
  note text check (char_length(note) <= 200),
  evidence_status public.evidence_label not null default 'simulated_assumption',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (economy_id, transaction_no),
  constraint local_transactions_two_sides check (from_account_id <> to_account_id)
);

create index local_transactions_economy on public.local_transactions (economy_id, occurred_at, transaction_no);
create index local_transactions_from on public.local_transactions (from_account_id);
create index local_transactions_to on public.local_transactions (to_account_id);
create index local_transactions_loan on public.local_transactions (loan_id) where loan_id is not null;

comment on table public.local_transactions is
  'Every movement of local units. The Local Economy Dashboard derives volume, multiplier and retention from these rows and from nothing else (addendum v3 §12).';

-- ------------------------------------------------------------- the redemptions

create table public.local_redemptions (
  id uuid primary key default gen_random_uuid(),
  economy_id uuid not null references public.local_economies (id) on delete restrict,
  merchant_id uuid not null references public.local_merchants (id) on delete restrict,
  amount_units bigint not null check (amount_units > 0),
  -- What those units are worth in reais at the economy's parity. Simulated:
  -- no Pix is sent, no institution converts anything, and the label says so.
  amount_brl_cents bigint not null check (amount_brl_cents >= 0),
  status public.local_redemption_status not null default 'requested',
  -- The movement that took the units out of circulation, once it settles.
  transaction_id uuid references public.local_transactions (id) on delete restrict,
  evidence_status public.evidence_label not null default 'simulated_assumption',
  requested_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint local_redemptions_settled_shape check (
    (status = 'settled') = (settled_at is not null and transaction_id is not null)
  )
);

create index local_redemptions_economy on public.local_redemptions (economy_id, requested_at);

-- ------------------------------------------------------------------ arithmetic

-- What an account's balance comes to from the movements themselves. The stored
-- column is a cache of this, and a cache nobody checks is a second truth.
create function private.local_account_balance(p_account_id uuid)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select sum(amount_units) from public.local_transactions where to_account_id = p_account_id), 0)
       - coalesce((select sum(amount_units) from public.local_transactions where from_account_id = p_account_id), 0)
$$;

-- Units to reais at the economy's parity, down to the centavo.
create function private.local_units_brl_cents(p_units bigint, p_parity_bps integer)
returns bigint language sql immutable set search_path = ''
as $$ select floor(p_units * p_parity_bps / 10000.0)::bigint $$;

-- ----------------------------------------------------------------------- RLS

alter table public.local_economies enable row level security;
alter table public.local_accounts enable row level security;
alter table public.local_merchants enable row level security;
alter table public.local_transactions enable row level security;
alter table public.local_redemptions enable row level security;

revoke all on public.local_economies, public.local_accounts, public.local_merchants,
              public.local_transactions, public.local_redemptions from anon, authenticated;
grant select on public.local_economies, public.local_accounts, public.local_merchants,
                public.local_transactions, public.local_redemptions to authenticated;

-- An economy is a place, not a secret: whoever operates capital reads it, and so
-- does the community whose territory it is.
create policy local_economies_read on public.local_economies for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or (community_id is not null
      and ((select private.leads_community(community_id)) or (select private.is_member(community_id))))
);

-- The merchants of an economy anyone may read who may read the economy: they are
-- businesses in a network, and the table carries no person.
create policy local_merchants_read on public.local_merchants for select to authenticated using (
  exists (select 1 from public.local_economies e where e.id = economy_id)
);

-- A balance is hers. Her leader sees it because a leader already sees her
-- capital; oversight sees every one.
create policy local_accounts_read on public.local_accounts for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or owner_type <> 'entrepreneur'
  or owner_id = (select private.my_entrepreneur_id())
  or (select private.leads_entrepreneur(owner_id))
);

-- A movement follows the accounts it touched.
create policy local_transactions_read on public.local_transactions for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or exists (
    select 1 from public.local_accounts a
    where a.id in (from_account_id, to_account_id)
      and a.owner_type = 'entrepreneur'
      and (a.owner_id = (select private.my_entrepreneur_id())
           or (select private.leads_entrepreneur(a.owner_id)))
  )
);

-- A redemption is a merchant's business with the desk, not an entrepreneur's.
create policy local_redemptions_read on public.local_redemptions for select to authenticated using (
  (select private.is_auditor_or_admin())
  or coalesce(private.my_role()::text, '') in ('partner', 'sponsor', 'capital_provider')
  or exists (select 1 from public.local_economies e
             where e.id = economy_id and e.community_id is not null
               and (select private.leads_community(e.community_id)))
);

revoke all on function private.local_rail_model_version(), private.local_account_balance(uuid),
                       private.local_units_brl_cents(bigint, integer) from public, anon, authenticated;
grant execute on function private.local_rail_model_version(), private.local_account_balance(uuid),
                          private.local_units_brl_cents(bigint, integer) to service_role;
