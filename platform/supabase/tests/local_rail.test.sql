-- The Local Productive Capital Rail: the ledger's arithmetic, the guardrails
-- that keep it a sandbox, and who may read a balance (addendum v3 §5, §12).
--   npx supabase test db --workdir platform
begin;
set local role postgres;
create extension if not exists pgtap with schema extensions;
select set_config(
  'search_path',
  'public, extensions, ' || (select extnamespace::regnamespace::text from pg_extension where extname = 'pgtap'),
  true
);

select plan(33);

-- ------------------------------------------------------------------ fixtures

create function pg_temp.act_as(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000014a1', 'rail-admin@test'),
  ('00000000-0000-0000-0000-0000000014a2', 'rail-leader@test'),
  ('00000000-0000-0000-0000-0000000014a3', 'rail-rosa@test'),
  ('00000000-0000-0000-0000-0000000014a4', 'rail-other@test'),
  ('00000000-0000-0000-0000-0000000014a5', 'rail-desk@test');
insert into partners (id, name, kind, min_ticket_cents, max_ticket_cents) values
  ('00000000-0000-0000-0000-0000000014ab', 'Rail Desk', 'fintech', 10000, 5000000);
update profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000014a1';
update profiles set role = 'community_leader' where id = '00000000-0000-0000-0000-0000000014a2';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000014a3';
update profiles set role = 'entrepreneur' where id = '00000000-0000-0000-0000-0000000014a4';
update profiles set role = 'partner', partner_id = '00000000-0000-0000-0000-0000000014ab'
  where id = '00000000-0000-0000-0000-0000000014a5';

insert into communities (id, name, kind, city, state, leader_id, status, verified_at, verified_by) values
  ('00000000-0000-0000-0000-0000000014c1', 'pgTAP Rail community', 'association', 'Salvador', 'BA',
   '00000000-0000-0000-0000-0000000014a2', 'verified', now(), '00000000-0000-0000-0000-0000000014a1');
insert into entrepreneurs (id, profile_id, display_name, business_name, business_sector, city, state) values
  ('00000000-0000-0000-0000-0000000014e1', '00000000-0000-0000-0000-0000000014a3', 'Rail Rosa', 'Ateliê Rosa', 'textiles', 'Salvador', 'BA'),
  ('00000000-0000-0000-0000-0000000014e2', '00000000-0000-0000-0000-0000000014a4', 'Rail Other', 'Outro', 'food', 'Salvador', 'BA');
insert into community_memberships (community_id, entrepreneur_id) values
  ('00000000-0000-0000-0000-0000000014c1', '00000000-0000-0000-0000-0000000014e1');

insert into local_economies (id, code, name, territory, community_id, uf, currency_code, parity_bps, parity_reference) values
  ('00000000-0000-0000-0000-0000000014f1', 'pgtap_rail', 'Moeda pgTAP', 'Território pgTAP',
   '00000000-0000-0000-0000-0000000014c1', 'BA', 'PGT', 10000, '1 PGT = R$ 1, demonstration only');
insert into local_merchants (id, economy_id, code, name, sector, city, uf, eligible) values
  ('00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-0000000014f1', 'tecidos', 'Tecidos do Bairro', 'wholesale', 'Salvador', 'BA', true),
  ('00000000-0000-0000-0000-0000000014b2', '00000000-0000-0000-0000-0000000014f1', 'grafica', 'Gráfica da Esquina', 'services', 'Salvador', 'BA', true),
  ('00000000-0000-0000-0000-0000000014b3', '00000000-0000-0000-0000-0000000014f1', 'fora', 'Loja fora da rede', 'retail', 'Salvador', 'BA', false);

-- --------------------------------------------------------- it says it is a demo

-- The status enum has one value, so a row cannot claim to be a real currency
-- however it is written. This is the guardrail of §5, as data.
select is(
  (select count(*)::int from pg_enum where enumtypid = 'public.local_economy_status'::regtype),
  1, 'a local economy has exactly one status it may be in, and it is demo');

select throws_ok(
  $$ update local_economies set is_simulated = false where code = 'pgtap_rail' $$,
  '23514', null, 'and it cannot be marked as anything but simulated');

select is(
  (select count(*)::int from pg_enum where enumtypid = 'public.evidence_label'::regtype),
  4, 'every figure carries one of the addendum''s four evidence labels');

-- The productive exchange network is a different promise and stays a different
-- table: it trades a unit of account that is not money and nobody repays it.
select is(
  (select is_credit from capital_instruments where code = 'troca_produtiva_rede'),
  false, 'the exchange route is still not credit, and the local rail did not merge with it');

-- ------------------------------------------------------------------ the moves

-- The private helpers belong to service_role, as their revokes say, so the
-- ledger is opened here the way the seed opens it. Everything a person does
-- goes through the public functions, as the desk, below.
set local role postgres;

-- R$ 1.000 of capital arrives as units, issued by the treasury.
select lives_ok($$
  select private.local_move(
    '00000000-0000-0000-0000-0000000014f1', 'capital_injection',
    private.local_account('00000000-0000-0000-0000-0000000014f1', 'treasury', null),
    private.local_account('00000000-0000-0000-0000-0000000014f1', 'entrepreneur', '00000000-0000-0000-0000-0000000014e1'),
    100000, 'inventory')
$$, 'capital is injected into her account, from the economy''s treasury');

select is(
  (select balance_units from local_accounts
   where economy_id = '00000000-0000-0000-0000-0000000014f1' and owner_id = '00000000-0000-0000-0000-0000000014e1'),
  100000::bigint, 'she holds what was injected');

-- The issuer is short by exactly what circulates, which is what makes the
-- ledger checkable rather than merely plausible.
select is(
  (select balance_units from local_accounts
   where economy_id = '00000000-0000-0000-0000-0000000014f1' and owner_type = 'treasury'),
  -100000::bigint, 'and the treasury is short by exactly that much');

select is(
  (select sum(balance_units)::bigint from local_accounts where economy_id = '00000000-0000-0000-0000-0000000014f1'),
  0::bigint, 'so every unit in the economy is accounted for, always');

-- §12: spent across at least two local entities. From here on, as the desk.
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a5');
select lives_ok($$
  select public.local_spend('00000000-0000-0000-0000-0000000014b1', 60000, 'inventory',
    '00000000-0000-0000-0000-0000000014e1')
$$, 'she buys from a merchant in the network');

select lives_ok($$
  select public.local_merchant_payment('00000000-0000-0000-0000-0000000014b1', '00000000-0000-0000-0000-0000000014b2', 25000)
$$, 'and that merchant pays another, which is the second hop');

select is(
  (select sum(amount_units)::bigint from local_transactions
   where economy_id = '00000000-0000-0000-0000-0000000014f1' and tx_type <> 'capital_injection'),
  85000::bigint, 'local transaction volume comes from the movements, not from a constant');

select is(
  (select sum(balance_units)::bigint from local_accounts where economy_id = '00000000-0000-0000-0000-0000000014f1'),
  0::bigint, 'and the economy still balances after both hops');

-- The cache and the events give one answer, which is the only reason a cached
-- balance is allowed to exist at all.
set local role postgres;
select is(
  (select count(*)::int from local_accounts a
   where a.economy_id = '00000000-0000-0000-0000-0000000014f1'
     and a.balance_units <> private.local_account_balance(a.id)),
  0, 'every stored balance equals the movements that made it');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a5');

-- --------------------------------------------------------------- the refusals

select throws_ok(
  $$ select public.local_spend('00000000-0000-0000-0000-0000000014b3', 1000, 'inventory',
       '00000000-0000-0000-0000-0000000014e1') $$,
  '22023', 'merchant_not_eligible_for_productive_capital',
  'productive capital cannot be spent at a merchant outside the eligible set');

select throws_ok(
  $$ select public.local_spend('00000000-0000-0000-0000-0000000014b1', 900000, 'inventory',
       '00000000-0000-0000-0000-0000000014e1') $$,
  '23514', null, 'and she cannot spend units she does not hold');

set local role postgres;
select throws_ok(
  $$ select private.local_move('00000000-0000-0000-0000-0000000014f1', 'transfer',
       private.local_account('00000000-0000-0000-0000-0000000014f1', 'merchant', '00000000-0000-0000-0000-0000000014b1'),
       private.local_account('00000000-0000-0000-0000-0000000014f1', 'merchant', '00000000-0000-0000-0000-0000000014b1'),
       100) $$,
  '22023', 'local_move_needs_two_sides', 'a movement needs two different sides');

select throws_ok(
  $$ select private.local_move('00000000-0000-0000-0000-0000000014f1', 'transfer',
       private.local_account('00000000-0000-0000-0000-0000000014f1', 'treasury', null),
       private.local_account('00000000-0000-0000-0000-0000000014f1', 'merchant', '00000000-0000-0000-0000-0000000014b1'),
       0) $$,
  '22023', 'local_amount_must_be_positive', 'and an amount worth recording');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a5');

select throws_ok(
  $$ select public.local_repay((select id from loans limit 1), 100) $$,
  'P0002', null, 'a loan never disbursed on a rail cannot be repaid on one');

-- --------------------------------------------------------------- the redemption

select lives_ok($$
  select public.local_redeem('00000000-0000-0000-0000-0000000014b2', 25000)
$$, 'a merchant takes units out of circulation and is paid in simulated reais');

select is(
  (select status from local_redemptions where merchant_id = '00000000-0000-0000-0000-0000000014b2'),
  'settled'::public.local_redemption_status, 'the redemption settles');

select is(
  (select amount_brl_cents from local_redemptions where merchant_id = '00000000-0000-0000-0000-0000000014b2'),
  25000::bigint, 'at the economy''s parity, one unit to one centavo');

select is(
  (select evidence_status from local_redemptions where merchant_id = '00000000-0000-0000-0000-0000000014b2'),
  'simulated_assumption'::public.evidence_label, 'and it says it is a simulated assumption, because no Pix was sent');

select is(
  (select balance_units from local_accounts
   where economy_id = '00000000-0000-0000-0000-0000000014f1' and owner_id = '00000000-0000-0000-0000-0000000014b2'),
  0::bigint, 'the redeeming merchant holds nothing afterwards');

select is(
  (select sum(balance_units)::bigint from local_accounts where economy_id = '00000000-0000-0000-0000-0000000014f1'),
  0::bigint, 'and the economy balances through a redemption too');

select ok(
  (select transaction_id is not null from local_redemptions where merchant_id = '00000000-0000-0000-0000-0000000014b2'),
  'a settled redemption names the movement that burned the units');

-- ------------------------------------------------------ numbering and ordering

select is(
  (select array_agg(transaction_no order by transaction_no) from local_transactions
   where economy_id = '00000000-0000-0000-0000-0000000014f1'),
  array[1, 2, 3, 4], 'the economy''s movements are numbered without a gap, in the order they happened');

select throws_ok(
  $$ insert into local_transactions (economy_id, transaction_no, tx_type, from_account_id, to_account_id, amount_units)
     select '00000000-0000-0000-0000-0000000014f1', 1, 'transfer', a.id, b.id, 10
       from local_accounts a, local_accounts b
      where a.owner_type = 'treasury' and b.owner_id = '00000000-0000-0000-0000-0000000014b1' $$,
  '42501', null, 'and nobody writes the ledger around private.local_move()');

-- -------------------------------------------------------------------- reading

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a3');
select is(
  (select count(*)::int from local_accounts where owner_id = '00000000-0000-0000-0000-0000000014e1'),
  1, 'she reads her own balance');
select is(
  (select count(*)::int from local_transactions),
  2, 'and the movements that touched it, and no others');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a4');
select is(
  (select count(*)::int from local_accounts where owner_type = 'entrepreneur'),
  0, 'another entrepreneur reads no balance of hers');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a2');
select is(
  (select count(*)::int from local_economies where code = 'pgtap_rail'),
  1, 'the leader of the territory reads its economy');

set local role postgres;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a5');
select is(
  (select count(*)::int from local_transactions where economy_id = '00000000-0000-0000-0000-0000000014f1'),
  4, 'the desk reads the whole ledger');

-- Not "reads nothing": the grant is not there at all, so the question itself is
-- refused. A visitor cannot count the rows to learn there are rows.
set local role anon;
select throws_ok(
  $$ select count(*) from local_economies $$,
  '42501', null, 'and a signed-out visitor cannot so much as ask');

set local role postgres;
select * from finish();
rollback;
