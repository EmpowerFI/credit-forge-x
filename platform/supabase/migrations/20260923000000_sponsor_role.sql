-- The sponsor of an impact or entrepreneurship programme (refactor spec, 16 Sep):
-- the paying customer of Impact Intelligence. Its own migration, because a new
-- enum value cannot be used in the transaction that adds it.
alter type public.app_role add value if not exists 'sponsor';
