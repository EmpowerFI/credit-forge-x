-- The waitlist tells no one who is on it.
--
-- diary_waitlist_join is open to anyone, by design: it is the site's form
-- (20270105). But it answered 'already' for an e-mail that was on the list,
-- so anyone could learn whether a given person had signed up. From now on it
-- answers 'joined' either way. The row is still written once per e-mail, and
-- the founder's notice is still sent once per e-mail (its idempotency key).
--
-- As 20270105's, with only the answer changed.

create or replace function public.diary_waitlist_join(
  p_name text, p_email text, p_sells text, p_city text, p_state text,
  p_consent boolean, p_language text default 'pt', p_source text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_consent is not true then
    raise exception 'waitlist_needs_consent' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 255 then
    raise exception 'waitlist_email_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 100
     or char_length(btrim(coalesce(p_sells, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_city, ''))) not between 1 and 80
     or coalesce(p_state, '') !~ '^[A-Z]{2}$' then
    raise exception 'waitlist_fields_invalid' using errcode = '22023';
  end if;
  insert into public.diary_waitlist (name, email, sells, city, state, language, source)
  values (btrim(p_name), v_email, btrim(p_sells), btrim(p_city), p_state,
          case when p_language = 'en' then 'en' else 'pt' end, left(nullif(btrim(p_source), ''), 60))
  on conflict ((lower(email))) do nothing;
  return 'joined';
end $$;
