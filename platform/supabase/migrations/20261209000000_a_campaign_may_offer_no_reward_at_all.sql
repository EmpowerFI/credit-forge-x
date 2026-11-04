-- A campaign may offer no reward at all.
--
-- Founder's decision, 04/11/2026: a programme with no milestone is a valid
-- choice, not a mistake. Publishing an empty list publishes a version with no
-- milestones: from then on nobody earns anything new there, and what was
-- already earned stays earned (the grants are untouched). It must still be a
-- list.
--
-- As 20261208's reward_programme_publish, with only that check changed.

create or replace function public.reward_programme_publish(p_milestones jsonb, p_note text default null, p_program_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_version integer;
  v_program uuid;
  v_house boolean;
begin
  v_program := private.reward_campaign(p_program_id);
  if not coalesce(private.can_edit_rewards(v_program), false) then
    raise exception 'not_allowed_to_publish_rewards' using errcode = '42501';
  end if;
  if p_milestones is null or jsonb_typeof(p_milestones) <> 'array' then
    raise exception 'milestones_must_be_a_list' using errcode = '22023';
  end if;
  select is_default into v_house from public.programs where id = v_program;

  -- A sponsor's reward is a gift it hands over itself, by code or link: no
  -- partner benefit (that is the credit partner's, and EmpowerFI's to set),
  -- and always the words that say how to redeem it.
  if not v_house then
    if exists (select 1 from jsonb_array_elements(p_milestones) m
                where coalesce(m ->> 'kind', '') <> 'perk'
                   or nullif(btrim(m ->> 'partner_name'), '') is not null
                   or nullif(btrim(m ->> 'recipient_code'), '') is not null) then
      raise exception 'a_sponsor_reward_is_a_gift' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements(p_milestones) m
                where nullif(btrim(m ->> 'how_to_redeem'), '') is null) then
      raise exception 'a_sponsor_reward_says_how_to_redeem' using errcode = '22023';
    end if;
  end if;
  if exists (select 1 from jsonb_array_elements(p_milestones) m
              where nullif(btrim(m ->> 'redeem_url'), '') is not null
                and (btrim(m ->> 'redeem_url') !~ '^https://[^[:space:]]+$' or char_length(btrim(m ->> 'redeem_url')) > 500)) then
    raise exception 'link_must_be_https' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('reward_programme:' || v_program::text));
  select coalesce(max(version), 0) + 1 into v_version from public.reward_programme_versions where program_id = v_program;
  insert into public.reward_programme_versions (program_id, version, note, published_by)
  values (v_program, v_version, p_note, auth.uid())
  returning id into v_id;

  -- The table's checks are the rest of the validation, as before; an unknown
  -- recipient code is refused by its foreign key.
  insert into public.reward_milestones
    (programme_id, code, threshold_days, kind, title, how_to_redeem, partner_name, recipient_code, redeem_url)
  select v_id, m ->> 'code', (m ->> 'threshold_days')::integer, m ->> 'kind',
         m ->> 'title', nullif(btrim(m ->> 'how_to_redeem'), ''), nullif(btrim(m ->> 'partner_name'), ''),
         nullif(btrim(m ->> 'recipient_code'), ''), nullif(btrim(m ->> 'redeem_url'), '')
    from jsonb_array_elements(p_milestones) m;

  return jsonb_build_object('version', v_version, 'programme_id', v_id);
end;
$$;
