-- reset_demo_data, callable through the API.
--
-- Supabase loads pg-safeupdate for API sessions, which rejects any DELETE or
-- UPDATE without a WHERE clause — inside functions too. The pgTAP tests run
-- over a direct connection and never saw it; the seed, calling through the
-- API, did. Same function, with the whole-table statements made explicit.

create or replace function public.reset_demo_data(p_confirm text)
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

  delete from public.chain_anchors where true;
  get diagnostics v_anchors = row_count;

  delete from public.education_progress where true;
  delete from public.education_programs where true;

  -- Cascades to memberships and to community programmes.
  delete from public.communities where true;
  get diagnostics v_communities = row_count;

  delete from public.entrepreneurs where profile_id is null;
  get diagnostics v_entrepreneurs = row_count;

  update public.entrepreneurs set borrower_ref = extensions.gen_random_bytes(32) where true;

  return jsonb_build_object(
    'anchors', v_anchors,
    'communities', v_communities,
    'entrepreneurs', v_entrepreneurs
  );
end;
$$;
