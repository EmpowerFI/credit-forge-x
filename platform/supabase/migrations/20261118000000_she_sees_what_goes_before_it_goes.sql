-- She sees what goes before it goes.
--
-- Step 3 of the Business Passport plan: sharing is authorised one share at a
-- time, for a named recipient, a stated purpose, a fixed list of indicators
-- over fixed months, and a limited time -- and she reads all of it, with her
-- own figures, before she says yes.
--
-- Until now AUTORIZO answered a broad question ("may partners see your
-- history?") with no recipient, no list and no end. That consent stays in
-- consents, where the rest of the platform reads it, but it is no longer what
-- lets anything of hers reach a partner. A share authorisation is:
--
--   recipient    who, by name: a row of passport_recipients, kept by staff.
--   purpose      what for, from a fixed list, in fixed words.
--   scope        which indicators, from a fixed vocabulary, and which months:
--                the exact snapshot versions shown to her. A correction issued
--                after she agreed does not change what she agreed to share;
--                a new share does.
--   time         how many days it lasts once she authorises it.
--   preview      the exact message she read, stored as sent, with its hash.
--
-- Nothing in a share names her. It carries the pseudonymous subject of the
-- snapshots; the preview tells her that her name, phone and CPF do not go, nor
-- any single sale or expense, and that an offer reaches her through EmpowerFI.
--
-- A share is proposed (by a partner benefit she earns, or by staff), sent to
-- her on WhatsApp inside a conversation she opened, and answered AUTORIZO or
-- NÃO within seven days. An authorised share lasts its days unless she ends it
-- sooner; AUTORIZAÇÕES lists hers and ENCERRAR n ends one. The rows are never
-- rewritten: only the status moves forward, and the words she read never
-- change.
--
-- What the recipient can then see -- the signed credential and the link to
-- verify it -- is step 4. This step is the gate it will open.

-- ----------------------------------------------------------------- recipients

create table public.passport_recipients (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  -- The name she reads: who will see her figures.
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  kind        text not null check (kind in ('credit_partner')),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

alter table public.passport_recipients enable row level security;
revoke all on public.passport_recipients from anon, authenticated;

/** Adds a recipient, or renames or (de)activates one by its code. Staff only. */
create function public.passport_recipient_save(p_code text, p_name text, p_active boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.passport_recipients%rowtype;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_manage_recipients' using errcode = '42501';
  end if;
  insert into public.passport_recipients (code, name, kind, active, created_by)
  values (btrim(p_code), btrim(p_name), 'credit_partner', coalesce(p_active, true), auth.uid())
  on conflict (code) do update set name = excluded.name, active = excluded.active
  returning * into v_row;
  return jsonb_build_object('code', v_row.code, 'name', v_row.name, 'kind', v_row.kind, 'active', v_row.active);
end;
$$;

create function public.passport_recipients_list()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_manage_recipients' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('code', r.code, 'name', r.name, 'kind', r.kind, 'active', r.active)
                     order by r.name)
      from public.passport_recipients r), '[]'::jsonb);
end;
$$;

-- A partner benefit can name its recipient: earning it then proposes the share
-- to that recipient on its own. Without one, staff propose it by hand.
alter table public.reward_milestones
  add column recipient_code text references public.passport_recipients (code) on update cascade on delete restrict,
  add constraint only_a_partner_benefit_has_a_recipient check (recipient_code is null or kind = 'partner_benefit');

create or replace function public.reward_programme_publish(p_milestones jsonb, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  if jsonb_typeof(p_milestones) <> 'array' or jsonb_array_length(p_milestones) = 0 then
    raise exception 'a programme has at least one milestone' using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.reward_programme_versions;
  insert into public.reward_programme_versions (version, note, published_by)
  values (v_version, p_note, auth.uid())
  returning id into v_id;

  -- The table's checks are the validation, as before; an unknown recipient
  -- code is refused by its foreign key.
  insert into public.reward_milestones
    (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name, recipient_code)
  select v_id, m ->> 'code', (m ->> 'threshold_days')::integer, m ->> 'kind',
         m ->> 'title', nullif(btrim(m ->> 'how_to_redeem'), ''), nullif(btrim(m ->> 'partner_name'), ''),
         nullif(btrim(m ->> 'recipient_code'), '')
    from jsonb_array_elements(p_milestones) m;

  return jsonb_build_object('version', v_version, 'programme_id', v_id);
end;
$$;

create or replace function public.reward_programme_current()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_manage_rewards() then
    raise exception 'not_allowed_to_read_rewards' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'version', v.version, 'published_at', v.published_at, 'note', v.note,
      'milestones', (select jsonb_agg(jsonb_build_object(
          'code', m.code, 'threshold_days', m.threshold_days, 'kind', m.kind, 'title', m.title,
          'how_to_redeem', m.how_to_redeem, 'partner_name', m.partner_name,
          'recipient_code', m.recipient_code) order by m.threshold_days)
        from public.reward_milestones m where m.programme_id = v.id))
    from public.reward_programme_versions v
    order by v.version desc limit 1
  );
end;
$$;

-- ------------------------------------------------------------- the vocabulary

/**
 * What a share may contain, in the order and the words she reads them. Keys
 * are snapshot indicators (methodology snapshot-v1.0.0).
 */
create function private.share_indicators()
returns table (key text, label text, ord integer)
language sql immutable set search_path = ''
as $$
  values
    ('revenue_cents',           'vendas',                   1),
    ('business_expenses_cents', 'gastos do negócio',        2),
    ('business_balance_cents',  'saldo do negócio',         3),
    ('days_kept',               'dias registrados',         4),
    ('selling_days',            'dias com venda',           5),
    ('receivable_cents',        'a receber',                6),
    ('payable_cents',           'a pagar',                  7),
    ('withdrawals_cents',       'retiradas para casa',      8),
    ('financing_cents',         'parcelas de dívida',       9)
$$;

/** What a share is for, in the words she reads. */
create function private.share_purpose_text(p_purpose text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_purpose
    when 'credit_offer' then 'analisar e decidir uma oferta de crédito para você'
  end
$$;

/** R$ 1.234,56, the way her other messages write money. */
create function private.brl(p_cents bigint)
returns text
language sql immutable set search_path = ''
as $$
  select case when p_cents < 0 then '-' else '' end || 'R$ '
      || reverse(regexp_replace(reverse((abs(p_cents) / 100)::text), '(\d{3})(?=\d)', '\1.', 'g'))
      || ',' || lpad((abs(p_cents) % 100)::text, 2, '0')
$$;

/** "2026-09" -> "Setembro de 2026". */
create function private.month_name_pt(p_period text)
returns text
language sql immutable set search_path = ''
as $$
  select (array['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto',
                'Setembro', 'Outubro', 'Novembro', 'Dezembro'])[substr(p_period, 6, 2)::integer]
      || ' de ' || substr(p_period, 1, 4)
$$;

/** One month of a preview: the chosen indicators of one snapshot, in words. */
create function private.share_month_line(p_indicators jsonb, p_period text, p_keys text[])
returns text
language sql immutable set search_path = ''
as $$
  select '• ' || private.month_name_pt(p_period) || ': '
      || string_agg(
           case
             when v.key = 'days_kept'
               then (p_indicators ->> 'days_kept') || ' de ' || (p_indicators ->> 'days_in_period') || ' dias registrados'
             when v.key = 'selling_days'
               then (p_indicators ->> 'selling_days') || ' dias com venda'
             else v.label || ' ' || private.brl(coalesce((p_indicators ->> v.key)::bigint, 0))
           end, '; ' order by v.ord)
      || '.'
    from private.share_indicators() v
   where v.key = any (p_keys)
$$;

-- ------------------------------------------------------------------- the shares

create table public.share_authorisations (
  id                 uuid primary key default gen_random_uuid(),
  entrepreneur_id    uuid not null references public.entrepreneurs (id) on delete cascade,
  subject_ref        text not null,
  recipient_id       uuid not null references public.passport_recipients (id) on delete restrict,
  purpose            text not null check (purpose in ('credit_offer')),
  indicators         text[] not null check (cardinality(indicators) > 0),
  -- The exact versions she was shown, oldest month first.
  snapshot_ids       uuid[] not null check (cardinality(snapshot_ids) > 0),
  periods            text[] not null check (cardinality(periods) = cardinality(snapshot_ids)),
  valid_days         integer not null check (valid_days between 1 and 90),
  text_version       text not null,
  preview_text       text not null,
  preview_sha256     text not null check (preview_sha256 ~ '^[0-9a-f]{64}$'),
  grant_id           uuid references public.reward_grants (id) on delete set null,
  status             text not null default 'proposed'
                       check (status in ('proposed', 'authorised', 'declined', 'lapsed', 'revoked')),
  proposed_at        timestamptz not null default now(),
  proposed_by        uuid,
  -- A proposal is answered within seven days of reaching her, or lapses.
  delivered_at       timestamptz,
  answered_at        timestamptz,
  answered_by        text,
  expires_at         timestamptz,
  revoked_at         timestamptz,
  revoked_by         text,
  is_simulated       boolean not null default false,
  constraint an_authorised_share_ends check ((status in ('authorised', 'revoked')) = (expires_at is not null)),
  constraint an_answer_is_recorded check ((status in ('proposed', 'lapsed')) or answered_at is not null),
  constraint a_revocation_is_recorded check ((status = 'revoked') = (revoked_at is not null))
);

-- One open question at a time, so AUTORIZO and NÃO always mean one thing.
create unique index share_authorisations_one_open on public.share_authorisations (entrepreneur_id)
  where status = 'proposed';
create index share_authorisations_by_her on public.share_authorisations (entrepreneur_id, proposed_at desc);

alter table public.share_authorisations enable row level security;
revoke all on public.share_authorisations from anon, authenticated;

/**
 * What she agreed to never changes: every column but the status and its
 * bookkeeping is fixed when the share is proposed, and the status only moves
 * forward -- proposed to authorised, declined or lapsed; authorised to
 * revoked. Deleting is erasure only, as for snapshots.
 */
create function private.share_authorisations_move_forward()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_moving constant text[] := array['status', 'delivered_at', 'answered_at', 'answered_by',
                                    'expires_at', 'revoked_at', 'revoked_by', 'grant_id'];
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.entrepreneurs where id = old.entrepreneur_id) then
      raise exception 'a share is never deleted' using errcode = '42501';
    end if;
    return old;
  end if;
  if (to_jsonb(new) - v_moving) <> (to_jsonb(old) - v_moving) then
    raise exception 'what she was shown never changes' using errcode = '42501';
  end if;
  if new.status <> old.status and not (
       (old.status = 'proposed' and new.status in ('authorised', 'declined', 'lapsed'))
    or (old.status = 'authorised' and new.status = 'revoked')) then
    raise exception 'a share cannot go from % to %', old.status, new.status using errcode = '42501';
  end if;
  -- Being delivered and being answered happen once.
  if (old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at)
     or (old.answered_at is not null and new.answered_at is distinct from old.answered_at) then
    raise exception 'a share is delivered and answered once' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger share_authorisations_move_forward
before update or delete on public.share_authorisations
for each row execute function private.share_authorisations_move_forward();

/**
 * Whether a share lets its recipient see what it lists, now: authorised, not
 * past its days, not ended by her, and the recipient still one we work with.
 * What step 4 asks.
 */
create function private.share_is_live(p_share_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.share_authorisations s
                   join public.passport_recipients r on r.id = s.recipient_id
                  where s.id = p_share_id and s.status = 'authorised' and s.expires_at > now() and r.active)
$$;

/**
 * Proposes a share and writes the exact message she will read.
 *
 * Months: the current version of each of her last p_months snapshotted
 * months. Refused with nothing_to_share before her first month has closed.
 * An open proposal she has not answered gives way to the new one.
 */
create function private.share_propose(
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

/** The indicators a share proposes unless told otherwise: what a credit offer needs, and no more. */
create function private.share_default_indicators()
returns text[]
language sql immutable set search_path = ''
as $$
  select array['revenue_cents', 'business_expenses_cents', 'business_balance_cents', 'days_kept']
$$;

/**
 * Staff propose a share by hand: for a partner benefit whose milestone names
 * no recipient, or for a recipient she has asked to share with. She receives
 * it the next time she writes.
 */
create function public.share_propose(
  p_entrepreneur_id uuid,
  p_recipient_code text,
  p_purpose text default 'credit_offer',
  p_indicators text[] default null,
  p_months integer default 3,
  p_valid_days integer default 30,
  p_grant_code text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_recipient uuid;
  v_grant uuid;
  v_row public.share_authorisations;
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_propose_shares' using errcode = '42501';
  end if;
  select id into v_recipient from public.passport_recipients where code = p_recipient_code;
  if not found then
    raise exception 'no_such_recipient' using errcode = 'P0002';
  end if;
  if p_grant_code is not null then
    select id into v_grant from public.reward_grants
     where entrepreneur_id = p_entrepreneur_id and code = p_grant_code and status = 'awaiting_consent';
    if not found then
      raise exception 'no_grant_awaiting_consent: %', p_grant_code using errcode = 'P0002';
    end if;
  end if;
  v_row := private.share_propose(p_entrepreneur_id, v_recipient, p_purpose,
                                 coalesce(p_indicators, private.share_default_indicators()),
                                 p_months, p_valid_days, v_grant, auth.uid());
  return jsonb_build_object('id', v_row.id, 'preview_text', v_row.preview_text);
end;
$$;

-- ------------------------------------------------------ earning a partner benefit

/**
 * As before, with one change: a partner benefit always waits for a share
 * authorised to its partner, whatever broad consent she gave before. When the
 * milestone names its recipient, earning it proposes that share at once; if
 * no month has closed yet, the share waits for staff to propose it.
 */
create or replace function public.journal_progress(p_entrepreneur_id uuid, p_day date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prog uuid;
  v_started date;
  v_kept integer;
  v_sim boolean;
  v_new jsonb;
  v_next jsonb;
  v_ids uuid[];
  v_codes text[];
  v_statuses text[];
  v_grant record;
begin
  select id into v_prog from public.reward_programme_versions order by version desc limit 1;
  select s.started_on, s.kept_days into v_started, v_kept from private.journal_streak(p_entrepreneur_id, p_day) s;
  select e.is_simulated into v_sim from public.entrepreneurs e where e.id = p_entrepreneur_id;

  with earned as (
    insert into public.reward_grants (entrepreneur_id, code, programme_id, status, streak_started_on, kept_days, is_simulated)
    select p_entrepreneur_id, m.code, v_prog,
           case when m.kind = 'partner_benefit' then 'awaiting_consent' else 'granted' end,
           v_started, v_kept, coalesce(v_sim, false)
      from public.reward_milestones m
     where m.programme_id = v_prog and m.threshold_days <= v_kept and v_started is not null
    on conflict (entrepreneur_id, code) do nothing
    returning id, code, status
  )
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(code), '{}'), coalesce(array_agg(status), '{}')
    into v_ids, v_codes, v_statuses
    from earned;

  for v_grant in
    select j.id, r.id as recipient_id
      from unnest(v_ids, v_codes, v_statuses) j (id, code, status)
      join public.reward_milestones m on m.programme_id = v_prog and m.code = j.code
      join public.passport_recipients r on r.code = m.recipient_code and r.active
     where j.status = 'awaiting_consent'
  loop
    begin
      perform private.share_propose(p_entrepreneur_id, v_grant.recipient_id, 'credit_offer',
                                    private.share_default_indicators(), 3, 30, v_grant.id, null);
    exception when sqlstate 'P0001' then
      null;  -- nothing_to_share: no month closed yet; staff propose it later.
    end;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', m.code, 'kind', m.kind, 'title', m.title, 'how_to_redeem', m.how_to_redeem,
           'partner_name', m.partner_name, 'threshold_days', m.threshold_days, 'status', j.status)
           order by m.threshold_days), '[]'::jsonb)
    into v_new
    from unnest(v_codes, v_statuses) j (code, status)
    join public.reward_milestones m on m.programme_id = v_prog and m.code = j.code;

  select jsonb_build_object('code', m.code, 'title', m.title, 'kind', m.kind,
                            'threshold_days', m.threshold_days, 'days_left', m.threshold_days - v_kept)
    into v_next
    from public.reward_milestones m
   where m.programme_id = v_prog
     and not exists (select 1 from public.reward_grants g where g.entrepreneur_id = p_entrepreneur_id and g.code = m.code)
   order by m.threshold_days
   limit 1;

  return jsonb_build_object(
    'streak_days', v_kept,
    'streak_started_on', v_started,
    'earned', v_new,
    'next', v_next
  );
end;
$$;

-- ------------------------------------------------------------------ on WhatsApp

/** The proposal waiting to reach her, if any, to send inside the window she just opened. */
create function public.share_to_deliver(p_entrepreneur_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', s.id, 'text', s.preview_text)
    from public.share_authorisations s
   where s.entrepreneur_id = p_entrepreneur_id and s.status = 'proposed' and s.delivered_at is null
$$;

/** Marks a proposal as having reached her: her seven days start now. */
create function public.share_delivered(p_share_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.share_authorisations set delivered_at = now()
   where id = p_share_id and status = 'proposed' and delivered_at is null
$$;

/** Whether AUTORIZO or NÃO from her has a question to answer. */
create function public.share_open(p_entrepreneur_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.share_authorisations s
                  where s.entrepreneur_id = p_entrepreneur_id and s.status = 'proposed'
                    and s.delivered_at is not null)
$$;

/**
 * Her answer to the proposal she was sent. AUTORIZO authorises it for its
 * days, records the partner scope in consents if her last record did not
 * have it (carrying the other scopes over, as every change of consent does),
 * and releases the benefit that was waiting on it. NÃO declines it, and
 * nothing goes. Past seven days the proposal has lapsed and neither applies.
 */
create function public.whatsapp_share_answer(
  p_entrepreneur_id uuid,
  p_authorise boolean,
  p_message_id text,
  p_text_version text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_share public.share_authorisations%rowtype;
  v_last public.consents%rowtype;
  v_name text;
  v_released jsonb := '[]'::jsonb;
begin
  select * into v_share from public.share_authorisations
   where entrepreneur_id = p_entrepreneur_id and status = 'proposed' and delivered_at is not null
   for update;
  if not found then
    return jsonb_build_object('status', 'nothing_open');
  end if;
  select name into v_name from public.passport_recipients where id = v_share.recipient_id;

  if v_share.delivered_at < now() - interval '7 days' then
    update public.share_authorisations set status = 'lapsed' where id = v_share.id;
    return jsonb_build_object('status', 'lapsed', 'recipient', v_name);
  end if;

  if not p_authorise then
    update public.share_authorisations
       set status = 'declined', answered_at = now(), answered_by = p_message_id
     where id = v_share.id;
    return jsonb_build_object('status', 'declined', 'recipient', v_name);
  end if;

  update public.share_authorisations
     set status = 'authorised', answered_at = now(), answered_by = p_message_id,
         expires_at = now() + make_interval(days => v_share.valid_days)
   where id = v_share.id
  returning * into v_share;

  select * into v_last from public.consents
   where entrepreneur_id = p_entrepreneur_id order by consent_no desc limit 1;
  -- Partner needs assessment; a share never turns assessment on by itself.
  if found and v_last.assessment and not v_last.partner then
    insert into public.consents
      (entrepreneur_id, consent_no, text_version, assessment, partner, investors, impact, channel, is_simulated)
    values (p_entrepreneur_id, v_last.consent_no + 1, p_text_version, true, true,
            v_last.investors, v_last.impact, 'whatsapp', v_last.is_simulated);
  end if;

  if v_share.grant_id is not null then
    with released as (
      update public.reward_grants g set status = 'granted'
       where g.id = v_share.grant_id and g.status = 'awaiting_consent'
      returning g.code, g.programme_id
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'code', m.code, 'kind', m.kind, 'title', m.title, 'how_to_redeem', m.how_to_redeem,
             'partner_name', m.partner_name, 'threshold_days', m.threshold_days, 'status', 'granted')), '[]'::jsonb)
      into v_released
      from released r join public.reward_milestones m on m.programme_id = r.programme_id and m.code = r.code;
  end if;

  return jsonb_build_object('status', 'authorised', 'recipient', v_name,
                            'expires_on', to_char(v_share.expires_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'),
                            'released', v_released);
end;
$$;

/** Her shares that are in force now, numbered as she will name them. */
create function public.whatsapp_share_list(p_entrepreneur_id uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'n', x.n, 'recipient', x.name, 'purpose', private.share_purpose_text(x.purpose),
           'periods', to_jsonb(x.periods),
           'expires_on', to_char(x.expires_at at time zone 'America/Sao_Paulo', 'YYYY-MM-DD'))
           order by x.n), '[]'::jsonb)
    from (select row_number() over (order by s.answered_at, s.id)::integer as n, r.name, s.purpose, s.periods, s.expires_at
            from public.share_authorisations s join public.passport_recipients r on r.id = s.recipient_id
           where s.entrepreneur_id = p_entrepreneur_id and s.status = 'authorised' and s.expires_at > now()) x
$$;

/** ENCERRAR n: ends one of her shares now, numbered as whatsapp_share_list numbers them. */
create function public.whatsapp_share_revoke(p_entrepreneur_id uuid, p_n integer, p_message_id text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_name text;
begin
  select x.id, x.name into v_id, v_name
    from (select s.id, r.name, row_number() over (order by s.answered_at, s.id)::integer as n
            from public.share_authorisations s join public.passport_recipients r on r.id = s.recipient_id
           where s.entrepreneur_id = p_entrepreneur_id and s.status = 'authorised' and s.expires_at > now()) x
   where x.n = p_n;
  if not found then
    return jsonb_build_object('status', 'no_such_share');
  end if;
  update public.share_authorisations
     set status = 'revoked', revoked_at = now(), revoked_by = p_message_id
   where id = v_id;
  return jsonb_build_object('status', 'revoked', 'recipient', v_name);
end;
$$;

/** Every share of hers, as staff read it, newest first. */
create function public.share_history(p_entrepreneur_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_empowerfi_staff() then
    raise exception 'not_allowed_to_read_shares' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'subject_ref', s.subject_ref, 'recipient', r.code, 'purpose', s.purpose,
      'indicators', to_jsonb(s.indicators), 'periods', to_jsonb(s.periods), 'snapshot_ids', to_jsonb(s.snapshot_ids),
      'valid_days', s.valid_days, 'status',
        case when s.status = 'authorised' and s.expires_at <= now() then 'expired' else s.status end,
      'proposed_at', s.proposed_at, 'delivered_at', s.delivered_at, 'answered_at', s.answered_at,
      'expires_at', s.expires_at, 'revoked_at', s.revoked_at,
      'preview_text', s.preview_text, 'preview_sha256', s.preview_sha256, 'text_version', s.text_version)
      order by s.proposed_at desc)
      from public.share_authorisations s join public.passport_recipients r on r.id = s.recipient_id
     where s.entrepreneur_id = p_entrepreneur_id), '[]'::jsonb);
end;
$$;

-- The broad AUTORIZO is retired: nothing of hers reaches a partner on it now.
drop function public.whatsapp_partner_consent(uuid, text);
drop function public.reward_awaiting_consent(uuid);

-- ------------------------------------------------------------------- grants

revoke execute on function private.share_indicators() from public, anon, authenticated;
revoke execute on function private.share_purpose_text(text) from public, anon, authenticated;
revoke execute on function private.brl(bigint) from public, anon, authenticated;
revoke execute on function private.month_name_pt(text) from public, anon, authenticated;
revoke execute on function private.share_month_line(jsonb, text, text[]) from public, anon, authenticated;
revoke execute on function private.share_authorisations_move_forward() from public, anon, authenticated;
revoke execute on function private.share_is_live(uuid) from public, anon, authenticated;
revoke execute on function private.share_propose(uuid, uuid, text, text[], integer, integer, uuid, uuid) from public, anon, authenticated;
revoke execute on function private.share_default_indicators() from public, anon, authenticated;

revoke execute on function public.share_to_deliver(uuid) from public, anon, authenticated;
revoke execute on function public.share_delivered(uuid) from public, anon, authenticated;
revoke execute on function public.share_open(uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_share_answer(uuid, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.whatsapp_share_list(uuid) from public, anon, authenticated;
revoke execute on function public.whatsapp_share_revoke(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.share_to_deliver(uuid) to service_role;
grant execute on function public.share_delivered(uuid) to service_role;
grant execute on function public.share_open(uuid) to service_role;
grant execute on function public.whatsapp_share_answer(uuid, boolean, text, text) to service_role;
grant execute on function public.whatsapp_share_list(uuid) to service_role;
grant execute on function public.whatsapp_share_revoke(uuid, integer, text) to service_role;

-- Signed-in callers reach the staff RPCs; the gate inside decides.
revoke execute on function public.passport_recipient_save(text, text, boolean) from public, anon;
revoke execute on function public.passport_recipients_list() from public, anon;
revoke execute on function public.share_propose(uuid, text, text, text[], integer, integer, text) from public, anon;
revoke execute on function public.share_history(uuid) from public, anon;
grant execute on function public.passport_recipient_save(text, text, boolean) to authenticated, service_role;
grant execute on function public.passport_recipients_list() to authenticated, service_role;
grant execute on function public.share_propose(uuid, text, text, text[], integer, integer, text) to authenticated, service_role;
grant execute on function public.share_history(uuid) to authenticated, service_role;
