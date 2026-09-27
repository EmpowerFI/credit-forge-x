-- An impact fund is a kind of capital provider, and the capital it offers is a
-- kind of instrument (addendum v2 §6).
--
-- Two values rather than one, because `global_impact_capital` is not available
-- to it: that type is bound to a funding pool by pool_is_a_p2p_route, and the
-- pool it names is EmpowerFI's own book. A third party's capital is a different
-- route with a different owner, and reusing the pool's type would have made the
-- fund look like the house.
--
-- Alone in its own migration: a value added to an enum cannot be used until the
-- transaction that added it commits, and the next migration seeds both.
alter type public.capital_provider_type add value if not exists 'impact_fund';
alter type public.capital_instrument_type add value if not exists 'impact_fund_capital';
