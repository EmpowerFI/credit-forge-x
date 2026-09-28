-- Measured the way the field already measures, and against what it has already
-- measured.
--
-- The local rail reported a multiplier of its own invention: circulation over
-- capital injected. It was derived honestly and it was still the wrong number,
-- for two reasons. It compares to nothing — no published study reports that
-- ratio, so a reader had no way to tell 1.03 from good or bad — and it reads as
-- failure at exactly the values a healthy young ledger produces.
--
-- The field's measure is LM3, the Local Multiplier 3 of the New Economics
-- Foundation: three rounds of spending, and the ratio of all three to the
-- first. Its range is 1 to 3 by construction, everyone in local economic
-- development knows what 1.9 means, and the seeded loop already had exactly
-- three rounds in it — capital arrives, she buys from a supplier, the supplier
-- spends locally. The arithmetic was the only thing wrong.
--
--   Round 1  the capital that entered the territory
--   Round 2  what she spent with merchants inside it
--   Round 3  what those merchants spent locally in turn, including back to her
--
--   LM3 = (R1 + R2 + R3) / R1
--
-- What LM3 does not do, and the screen says so: it stops at three rounds. A
-- fourth hop is real economic activity and LM3 does not count it, which is why
-- the measure is a floor rather than a total.
--
-- And a number with no comparison is still an assertion. Brazil has the largest
-- local-currency experiment in the world running in Maricá, whose published
-- retention is 46%. Our seeded rail retains far more than that, because a
-- demonstration loop leaks less than a municipality does, and the honest thing
-- is to show both and let the gap be visible rather than to quietly report the
-- flattering one alone.

-- ------------------------------------------------------------ what others found
--
-- Figures this product did not measure and does not own: published work about
-- comparable programmes, and the rules the Brazilian regulator sets for the
-- credit this product is modelling. Each carries its source and the addendum's
-- 'external_benchmark' label, which until now nothing in the product used —
-- a label no row can carry is a vocabulary with a dead word in it.

create table public.reference_points (
  key text primary key check (key ~ '^[a-z0-9_]{3,60}$'),
  label text not null check (char_length(label) between 3 and 160),
  -- Exactly one of the three, in the product's integer discipline: basis
  -- points for a rate or a share, centavos for money, a plain count otherwise.
  value_bps bigint,
  value_cents bigint,
  value_count bigint,
  source text not null check (char_length(source) between 3 and 160),
  source_url text not null check (source_url ~ '^https://'),
  -- When it was observed, in the words the source uses.
  observed_period text check (char_length(observed_period) <= 60),
  note text check (char_length(note) <= 400),
  evidence_status public.evidence_label not null default 'external_benchmark',
  created_at timestamptz not null default now(),
  constraint reference_points_one_value check (
    (value_bps is not null)::int + (value_cents is not null)::int + (value_count is not null)::int = 1)
);

comment on table public.reference_points is
  'Figures this product did not measure: published work about comparable programmes and the regulator''s own limits, each with its source (addendum v3 §9, external_benchmark).';

alter table public.reference_points enable row level security;
revoke all on public.reference_points from anon, authenticated;
grant select on public.reference_points to authenticated;

-- Citations, with no person in them. Whoever may read a figure may read what it
-- is being compared against.
create policy reference_points_read on public.reference_points for select to authenticated using (true);

insert into public.reference_points (key, label, value_bps, value_cents, value_count, source, source_url, observed_period, note) values
  ('mumbuca_retention',
   'Mumbucas emitidas que permaneceram em Maricá', 4600, null, null,
   'Prefeitura de Maricá / CODEMAR', 'https://www.marica.rj.gov.br/noticia/mumbuca-e-reconhecida-em-artigo-como-a-moeda-social-mais-forte-do-pais/',
   '2018–ago 2020',
   'A maior moeda social digital do país. Retenção medida sobre o total emitido, num município inteiro — não num laço de demonstração.'),
  ('mumbuca_users',
   'Pessoas usando a moeda social Mumbuca', null, null, 133000,
   'Prefeitura de Maricá', 'https://www.marica.rj.gov.br/noticia/mumbuca-e-reconhecida-em-artigo-como-a-moeda-social-mais-forte-do-pais/',
   '2024', null),
  ('bcd_count',
   'Bancos comunitários de desenvolvimento no Brasil', null, null, 103,
   'Rede Brasileira de Bancos Comunitários', 'https://redebancos.org/', '2024',
   'Articulados em rede desde o Banco Palmas, 1998, e operando sobre a plataforma E-dinheiro como OSCIP de microcrédito.'),
  ('pnmpo_rate_cap_month',
   'Teto de juros do microcrédito produtivo orientado, ao mês', 400, null, null,
   'PNMPO / Banco Central do Brasil', 'https://globalallianceagainsthungerandpoverty.org/country-example/brazil-national-program-for-productive-oriented-microcredit-pnmpo/',
   'vigente',
   'O programa também exige prazo mínimo de 120 dias.'),
  ('pnmpo_revenue_ceiling',
   'Receita bruta anual máxima para microcrédito produtivo', null, 36000000, null,
   'PNMPO / Banco Central do Brasil', 'https://globalallianceagainsthungerandpoverty.org/country-example/brazil-national-program-for-productive-oriented-microcredit-pnmpo/',
   'vigente', null),
  ('pnmpo_portfolio',
   'Carteira de microcrédito produtivo orientado no Brasil', null, 953000000000, null,
   'ANBC', 'https://anbc.org.br/en/socio-economic-impacts-of-microcredit/', 'jun 2025',
   'Crescimento de 25% sobre junho de 2024, depois de uma queda entre 2022 e 2024.'),
  ('women_default_advantage',
   'Inadimplência menor entre tomadoras, no microcrédito brasileiro', 2150, null, null,
   'Pesquisa sobre microcrédito e gênero no Brasil', 'https://www.scielo.br/j/bar/a/6n7hThCG65fKPqGckx9LSgK/?lang=en',
   null, 'Probabilidade de inadimplência 21,5% menor que a de tomadores homens.'),
  ('lm3_ceiling',
   'Máximo construtivo do LM3, por contar três rodadas', 30000, null, null,
   'New Economics Foundation', 'https://www.nefconsulting.com/what-we-do/evaluation-impact-assessment/local-multiplier-3/',
   null, 'LM3 soma três rodadas de gasto e para. Uma quarta é atividade real que a medida não conta, então ela é um piso e não um total.');

-- ----------------------------------------------------------------- the measure

create or replace function public.local_economy_dashboard(p_economy_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_economy public.local_economies;
begin
  if p_economy_id is not null then
    select * into v_economy from public.local_economies where id = p_economy_id;
  else
    -- The oldest rail this caller may open, not the oldest rail: a reader who
    -- may see one economy and not another should land on the one that is hers.
    select * into v_economy from public.local_economies
     where private.may_read_local_economy(id) order by created_at limit 1;
  end if;
  if v_economy.id is null then return null; end if;
  if not private.may_read_local_economy(v_economy.id) then
    raise exception 'not_allowed_to_see_this_local_economy' using errcode = '42501';
  end if;

  return (
    with mv as (
      select * from public.local_transactions where economy_id = v_economy.id
    ),
    sums as (
      select
        -- LM3's three rounds. Round one is the capital that entered the
        -- territory; round two is what she spent inside it; round three is what
        -- those merchants spent locally in turn, including back to her.
        coalesce(sum(amount_units) filter (where tx_type = 'capital_injection'), 0)::bigint as r1,
        coalesce(sum(amount_units) filter (where tx_type = 'productive_purchase'), 0)::bigint as r2,
        coalesce(sum(amount_units) filter (where tx_type in ('merchant_payment', 'transfer')), 0)::bigint as r3,
        coalesce(sum(amount_units) filter (where tx_type = 'repayment'), 0)::bigint as repaid,
        coalesce(sum(amount_units) filter (where tx_type = 'redemption'), 0)::bigint as redeemed,
        count(*)::int as movements,
        min(occurred_at) as first_at,
        max(occurred_at) as last_at
      from mv
    ),
    money_supply as (
      select s.r1 - s.redeemed - s.repaid as circulating from sums s
    ),
    additionality as (
      select
        coalesce(sum(t.amount_units) filter (where o.funding_pool = 'global'), 0)::bigint as global_units,
        coalesce(sum(t.amount_units), 0)::bigint as traced_units,
        count(*)::int as loans
      from mv t
      join public.loans l on l.id = t.loan_id
      join public.qualified_credit_opportunities o on o.id = l.opportunity_id
      where t.tx_type = 'capital_injection'
    ),
    reach as (
      select
        (select count(distinct a.owner_id)::int
           from mv t join public.local_accounts a on a.id = t.to_account_id
          where a.owner_type = 'merchant') as merchants_paid,
        (select count(*)::int from (
           select a.owner_id from mv t join public.local_accounts a on a.id = t.from_account_id
            where a.owner_type = 'merchant'
              and t.tx_type in ('merchant_payment', 'transfer')
            group by a.owner_id) x) as merchants_spent_onward,
        (select count(distinct a.owner_id)::int
           from mv t join public.local_accounts a on a.id = t.to_account_id
          where a.owner_type = 'entrepreneur' and t.tx_type = 'capital_injection') as businesses_funded
    ),
    balances as (
      select
        coalesce(sum(balance_units), 0)::bigint as total,
        coalesce(sum(balance_units) filter (where owner_type <> 'treasury' and balance_units > 0), 0)::bigint as held,
        count(*)::int as accounts
      from public.local_accounts where economy_id = v_economy.id
    ),
    by_type as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tx_type', x.tx_type, 'movements', x.movements, 'units', x.units)
        order by x.units desc), '[]'::jsonb) as rows
      from (select tx_type::text as tx_type, count(*)::int as movements, sum(amount_units)::bigint as units
              from mv group by tx_type) x
    ),
    recent as (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'transaction_no', r.transaction_no, 'tx_type', r.tx_type,
        'amount_units', r.amount_units, 'occurred_at', r.occurred_at,
        'from_owner_type', r.from_owner_type, 'to_owner_type', r.to_owner_type,
        'from_name', r.from_name, 'to_name', r.to_name, 'note', r.note)
        order by r.transaction_no desc), '[]'::jsonb) as rows
      from (
        select t.id, t.transaction_no, t.tx_type::text as tx_type, t.amount_units, t.occurred_at, t.note,
               fa.owner_type::text as from_owner_type, ta.owner_type::text as to_owner_type,
               fm.name as from_name, tm.name as to_name
        from mv t
        join public.local_accounts fa on fa.id = t.from_account_id
        join public.local_accounts ta on ta.id = t.to_account_id
        left join public.local_merchants fm on fm.id = fa.owner_id and fa.owner_type = 'merchant'
        left join public.local_merchants tm on tm.id = ta.owner_id and ta.owner_type = 'merchant'
        order by t.transaction_no desc limit 12) r
    )
    select jsonb_build_object(
      'economy', jsonb_build_object(
        'id', v_economy.id, 'code', v_economy.code, 'name', v_economy.name,
        'territory', v_economy.territory, 'uf', v_economy.uf,
        'community_id', v_economy.community_id,
        'currency_code', v_economy.currency_code,
        'parity_bps', v_economy.parity_bps, 'parity_reference', v_economy.parity_reference,
        'is_simulated', v_economy.is_simulated),
      'model_version', private.local_rail_model_version(),
      'measure', 'LM3 (New Economics Foundation)',
      'evidence_status', (
        select case when count(*) filter (where evidence_status = 'simulated_assumption') > 0
                      or count(*) = 0
                    then 'simulated_assumption'
                    when count(distinct evidence_status) = 1
                    then min(evidence_status::text)
                    else 'simulated_assumption' end
        from mv),
      -- The three rounds, published beside the ratio they make, so the division
      -- can be done by hand against the ledger below it.
      'round_1_units', (select r1 from sums),
      'round_2_units', (select r2 from sums),
      'round_3_units', (select r3 from sums),
      'injected_units', (select r1 from sums),
      'injected_brl_cents', private.local_units_brl_cents((select r1 from sums), v_economy.parity_bps),
      'circulated_units', (select r2 + r3 from sums),
      'circulated_brl_cents', private.local_units_brl_cents((select r2 + r3 from sums), v_economy.parity_bps),
      'repaid_units', (select repaid from sums),
      'redeemed_units', (select redeemed from sums),
      'redeemed_brl_cents', private.local_units_brl_cents((select redeemed from sums), v_economy.parity_bps),
      'circulating_units', (select circulating from money_supply),
      'movements', (select movements from sums),
      'first_movement_at', (select first_at from sums),
      'last_movement_at', (select last_at from sums),
      -- LM3: all three rounds over the first. One when nothing has moved, and
      -- three at the ceiling the method itself imposes.
      'lm3_bps', (select case when s.r1 > 0
                          then round((s.r1 + s.r2 + s.r3) * 10000.0 / s.r1)::integer else 0 end from sums s),
      'retention_bps', (select case when s.r1 > 0
                                then greatest(0, round((s.r1 - s.redeemed) * 10000.0 / s.r1))::integer
                                else 0 end from sums s),
      'velocity_bps', (select case when m.circulating > 0
                               then round((s.r2 + s.r3) * 10000.0 / m.circulating)::integer else 0 end
                         from sums s, money_supply m),
      'additionality_bps', (select case when a.traced_units > 0
                                   then round(a.global_units * 10000.0 / a.traced_units)::integer else 0 end
                              from additionality a),
      'global_injected_units', (select global_units from additionality),
      'loans_landed', (select loans from additionality),
      'merchants_total', (select count(*)::int from public.local_merchants where economy_id = v_economy.id),
      'merchants_eligible', (select count(*)::int from public.local_merchants
                              where economy_id = v_economy.id and eligible),
      'merchants_paid', (select merchants_paid from reach),
      'merchants_spent_onward', (select merchants_spent_onward from reach),
      'businesses_funded', (select businesses_funded from reach),
      'redemptions', (select count(*)::int from public.local_redemptions where economy_id = v_economy.id),
      'accounts', (select accounts from balances),
      'units_held', (select held from balances),
      'conserved', (select total = 0 from balances),
      'supply_matches_balances', (select b.held = m.circulating from balances b, money_supply m),
      -- What this is being compared against, carried with the figures so a
      -- screen cannot show the flattering number alone.
      'benchmarks', (select coalesce(jsonb_agg(jsonb_build_object(
          'key', r.key, 'label', r.label, 'value_bps', r.value_bps,
          'value_cents', r.value_cents, 'value_count', r.value_count,
          'source', r.source, 'source_url', r.source_url,
          'observed_period', r.observed_period, 'note', r.note,
          'evidence_status', r.evidence_status) order by r.key), '[]'::jsonb)
        from public.reference_points r
        where r.key in ('mumbuca_retention', 'mumbuca_users', 'lm3_ceiling')),
      'by_type', (select rows from by_type),
      'recent', (select rows from recent)));
end;
$$;

comment on function public.local_economy_dashboard(uuid) is
  'LM3, retention, velocity and additionality for one local economy, derived from local_transactions and carried beside the published figures it is compared against (addendum v3 §7.2, §8, §12).';
