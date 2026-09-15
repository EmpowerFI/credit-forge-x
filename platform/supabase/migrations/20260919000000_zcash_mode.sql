-- Its own migration: a new enum value cannot be used in the transaction that adds it.
alter type public.investment_mode add value 'zcash';
