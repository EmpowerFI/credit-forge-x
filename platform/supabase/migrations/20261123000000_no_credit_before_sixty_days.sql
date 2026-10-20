-- No credit before sixty days of journal.
--
-- The founder's rule (docs/whatsapp/diario.pt-BR.md, section 5): nothing
-- about credit reaches a partner before she has kept sixty days of the
-- journal. Sixty days kept, in all -- a day with lines, or one she said was
-- quiet -- not sixty in a row: the reward programme rewards the run, this
-- rule asks for the history.
--
-- Where it can be crossed: a share for a credit offer. The automatic one,
-- when a partner benefit is earned, and the one staff propose by hand. Both
-- go through private.share_propose, so the gate is there. When it holds the
-- automatic proposal back, the benefit waits and she shows in
-- share_candidates with how many days she has kept.
--
-- The credit app's own request (declare_credit_intent) already needs a
-- CREDIT_READY assessment, which needs three months that count; the readiness
-- engine stays at three months, as decided.

/** The days of journal she has kept, in all. */
create function private.journal_days_kept(p_entrepreneur_id uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.journal_days where entrepreneur_id = p_entrepreneur_id
$$;

create function private.credit_gate_days()
returns integer
language sql immutable set search_path = ''
as $$ select 60 $$;

create or replace function private.share_propose(
  p_entrepreneur_id uuid,
  p_recipient_id uuid,
  p_purpose text,
  p_indicators text[],
  p_months integer,
  p_valid_days integer,
  p_grant_id uuid,
  p_proposed_by uuid
)
returns public.share_authorisations
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipient public.passport_recipients%rowtype;
  v_keys text[];
  v_ids uuid[];
  v_periods text[];
  v_lines text;
  v_text text;
  v_sim boolean;
  v_row public.share_authorisations;
begin
  select * into v_recipient from public.passport_recipients where id = p_recipient_id;
  if not found or not v_recipient.active then
    raise exception 'no_such_recipient' using errcode = 'P0002';
  end if;
  if private.share_purpose_text(p_purpose) is null then
    raise exception 'no_such_purpose: %', p_purpose using errcode = '22023';
  end if;
  -- No credit before sixty days of journal: a share for a credit offer waits
  -- until she has kept that many.
  if p_purpose = 'credit_offer' and private.journal_days_kept(p_entrepreneur_id) < private.credit_gate_days() then
    raise exception 'too_early_for_credit: % of % days kept',
      private.journal_days_kept(p_entrepreneur_id), private.credit_gate_days() using errcode = 'P0001';
  end if;
  if p_months is null or p_months not between 1 and 12 then
    raise exception 'a share covers 1 to 12 months' using errcode = '22023';
  end if;
  if p_valid_days is null or p_valid_days not between 1 and 90 then
    raise exception 'a share lasts 1 to 90 days' using errcode = '22023';
  end if;
  -- The vocabulary's order, whatever order they came in; anything outside it refuses.
  select array_agg(v.key order by v.ord) into v_keys
    from private.share_indicators() v where v.key = any (p_indicators);
  if v_keys is null or cardinality(v_keys) <> (select count(distinct k) from unnest(p_indicators) k) then
    raise exception 'unknown_indicator' using errcode = '22023';
  end if;

  select array_agg(c.id order by c.period), array_agg(c.period order by c.period),
         string_agg(private.share_month_line(c.indicators, c.period, v_keys), E'\n' order by c.period)
    into v_ids, v_periods, v_lines
    from (select distinct on (s.period) s.id, s.period, s.indicators
            from public.metric_snapshots s
           where s.entrepreneur_id = p_entrepreneur_id
           order by s.period desc, s.version desc
           limit p_months) c;
  if v_ids is null then
    raise exception 'nothing_to_share' using errcode = 'P0001';
  end if;

  v_text := concat_ws(E'\n',
    '🔐 *Antes de compartilhar, veja exatamente o que vai.*',
    '',
    '*Para quem:* ' || v_recipient.name,
    '*Para quê:* ' || private.share_purpose_text(p_purpose),
    '*Por quanto tempo:* ' || p_valid_days || ' dias a partir da sua autorização. Depois disso, '
      || v_recipient.name || ' não consegue mais consultar.',
    '',
    '*O que vai:*',
    v_lines,
    '',
    'São os números do seu diário, marcados como *declarados por você*.',
    '*Não vai:* o seu nome, telefone ou CPF, nem cada venda ou gasto separado. No lugar do seu nome vai um código. '
      || 'Se ' || v_recipient.name || ' quiser fazer uma oferta, a EmpowerFI te avisa por aqui.',
    '',
    'Responda *AUTORIZO* para compartilhar ou *NÃO* para não compartilhar. Você tem 7 dias para responder, '
      || 'e pode encerrar quando quiser escrevendo *AUTORIZAÇÕES*.');

  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;

  update public.share_authorisations set status = 'lapsed'
   where entrepreneur_id = p_entrepreneur_id and status = 'proposed';

  insert into public.share_authorisations
    (entrepreneur_id, subject_ref, recipient_id, purpose, indicators, snapshot_ids, periods, valid_days,
     text_version, preview_text, preview_sha256, grant_id, proposed_by, is_simulated)
  values
    (p_entrepreneur_id, private.passport_subject(p_entrepreneur_id), p_recipient_id, p_purpose, v_keys,
     v_ids, v_periods, p_valid_days, 'share-preview-v1', v_text,
     encode(extensions.digest(convert_to(v_text, 'UTF8'), 'sha256'), 'hex'), p_grant_id, p_proposed_by,
     coalesce(v_sim, false))
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.share_candidates()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_shares' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'entrepreneur_id', g.entrepreneur_id,
      'first_name', split_part(coalesce(e.display_name, ''), ' ', 1),
      'grant_code', g.code, 'title', m.title, 'partner_name', m.partner_name, 'recipient_code', m.recipient_code,
      'kept_days', g.kept_days, 'earned_at', g.granted_at,
      'days_kept_total', private.journal_days_kept(g.entrepreneur_id), 'credit_gate_days', private.credit_gate_days(),
      'closed_months', (select count(distinct ms.period) from public.metric_snapshots ms where ms.entrepreneur_id = g.entrepreneur_id))
      order by g.granted_at)
      from public.reward_grants g
      join public.entrepreneurs e on e.id = g.entrepreneur_id
      join public.reward_milestones m on m.programme_id = g.programme_id and m.code = g.code
     where g.status = 'awaiting_consent'
       and not exists (select 1 from public.share_authorisations s
                        where s.grant_id = g.id and s.status in ('proposed', 'authorised'))), '[]'::jsonb);
end;
$$;

revoke execute on function private.journal_days_kept(uuid) from public, anon, authenticated;
revoke execute on function private.credit_gate_days() from public, anon, authenticated;
