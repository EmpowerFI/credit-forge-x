-- Demo reset: wipes the scenario so the seed can rebuild it (plan: seed reset
-- in under five minutes).
--
-- Keeps accounts, profiles and partners. Deletes communities, memberships,
-- education, anchors, and entrepreneurs without a login. Entrepreneurs who
-- keep their record (the demo logins) get a fresh borrower_ref: their old
-- borrower account stays on chain, and re-enrolling under the same ref would
-- collide with it as a mismatch.
--
-- Accounts already written on devnet are not touched — they cannot be — and
-- simply stop being referenced. Service role only, and only with the exact
-- confirmation phrase, since this project exists for the demo and nothing
-- else (plan D2).

create function public.reset_demo_data(p_confirm text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anchors integer;
  v_communities integer;
  v_entrepreneurs integer;
begin
  if p_confirm is distinct from 'reset empowerfi-hackathon demo data' then
    raise exception 'confirmation_phrase_required' using errcode = '22023';
  end if;

  delete from public.chain_anchors;
  get diagnostics v_anchors = row_count;

  delete from public.education_progress;
  delete from public.education_programs;

  -- Cascades to memberships and to community programmes.
  delete from public.communities;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32);

  return jsonb_build_object(
    'anchors', v_anchors,
    'communities', v_communities,
    'entrepreneurs', v_entrepreneurs
  );
end;
$$;

revoke all on function public.reset_demo_data(text) from public, anon, authenticated;
grant execute on function public.reset_demo_data(text) to service_role;
