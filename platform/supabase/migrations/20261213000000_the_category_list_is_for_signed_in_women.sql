-- The category list is for signed-in women.
--
-- 20261210 granted public.diary_categories() to anon. Nobody needs it signed
-- out -- the diary asks for it only on the sign-up form, after the e-mail
-- code -- and audit:grants flags every function an anonymous visitor can
-- call. The list itself is not sensitive; the rule is that nothing is
-- reachable signed out unless it has to be.

revoke execute on function public.diary_categories() from public, anon;
grant execute on function public.diary_categories() to authenticated, service_role;
