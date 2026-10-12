-- The credit platform's trigger now fires on the mobile app's sign-up, and it
-- can refuse one.
--
-- private.handle_new_user() was written for a database the credit platform
-- owned alone, where a failed profile insert meant a failed seed script. It
-- now runs in the database the live app shares, on every new account, and an
-- exception in an after-insert trigger aborts the statement that fired it:
-- the row never reaches auth.users and the woman cannot create an account.
--
-- Two ways that happens today, both found by reading the constraint rather
-- than by waiting for it:
--
--   * display_name is checked at 1 to 80 characters. A name longer than
--     eighty -- or an e-mail whose local part is -- raises, and she loses the
--     account over the length of her own name.
--   * coalesce skips nulls, not empty strings. An account with email = ''
--     and no display_name in its metadata produces '', which is shorter than
--     one character, and raises.
--
-- So: the name is trimmed to what the column takes, an empty one falls
-- through to the default, a profile that somehow exists is left alone, and
-- anything still unforeseen is written to the server log and swallowed.
--
-- Swallowing is the right trade here and not a general licence. A profile
-- that was not created is a row that can be added later from auth.users; a
-- sign-up that did not happen is a person who is simply gone. This trigger is
-- the guest in that path, and a guest does not get to close the door.

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Participant'
  );
  -- Eighty is what the column takes. A longer name is still her name.
  v_name := left(v_name, 80);

  insert into public.profiles (id, display_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  return new;
exception when others then
  raise warning 'handle_new_user could not create a profile for %: %', new.id, sqlerrm;
  return new;
end;
$$;
