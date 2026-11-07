-- EmpowerFI lists a wallet's campaign from the SQL editor.
--
-- campaign_vault_list (20261223) asked private.can_manage_rewards(), which
-- reads the caller's JWT. The SQL editor sends none, so the very statement
-- the review is done with -- select public.campaign_vault_list('<id>', true)
-- -- was refused as not_allowed. A session that did not come through the API
-- (session_user is not PostgREST's authenticator) already holds the database
-- password, and passes; through the API, the JWT gate still decides.
--
-- create or replace, so it applies whether or not 20261223 ran before it.
-- Re-listing keeps who listed it first, as it keeps when.

create or replace function public.campaign_vault_list(p_program_id uuid, p_listed boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if session_user = 'authenticator' and not private.can_manage_rewards() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.campaign_vaults
     set listed_at = case when p_listed then coalesce(listed_at, now()) end,
         listed_by = case when p_listed then coalesce(listed_by, auth.uid()) end
   where program_id = p_program_id;
  if not found then
    raise exception 'no_such_campaign' using errcode = 'P0002';
  end if;
  update public.programs set enrolment = case when p_listed then 'open' else 'invited' end, updated_at = now()
   where id = p_program_id;
  return jsonb_build_object('program_id', p_program_id, 'listed', p_listed);
end $$;

revoke execute on function public.campaign_vault_list(uuid, boolean) from public, anon;
grant execute on function public.campaign_vault_list(uuid, boolean) to authenticated, service_role;
