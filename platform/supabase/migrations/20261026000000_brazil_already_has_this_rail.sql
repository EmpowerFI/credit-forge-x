-- The citations, readable on their own.

-- reference_points was added so the Local Economy screen could put our own
-- figures beside the field's, and it has been reachable only through that one
-- dashboard's payload — which means only a screen that has chosen an economy
-- can cite anything. The positioning argument is not about one economy: Brazil
-- has had community development banks since 1998, oriented productive
-- microcredit is a regulated national programme, and the rail this product runs
-- on was built by other people. A screen that says so needs the citations
-- without first asking which neighbourhood it is standing in.
--
-- Security invoker on purpose. The table's own policy already says whoever may
-- read a figure may read what it is being compared against, and a definer
-- wrapper around a table that is already readable would only move that decision
-- somewhere harder to find.

create function public.reference_points_listed()
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', r.key,
      'label', r.label,
      'value_bps', r.value_bps,
      'value_cents', r.value_cents,
      'value_count', r.value_count,
      'source', r.source,
      'source_url', r.source_url,
      'observed_period', r.observed_period,
      'note', r.note,
      'evidence_status', r.evidence_status
    ) order by r.key), '[]'::jsonb)
  from public.reference_points r;
$$;

revoke execute on function public.reference_points_listed() from public, anon;
grant execute on function public.reference_points_listed() to authenticated;


-- Two periods that only read in one language.
--
-- The citations are shown on English screens as well as Portuguese ones, and
-- "jun 2025" and "2018–ago 2020" carry a Portuguese month into a sentence that
-- is otherwise English. The source and the label are the publisher's own words
-- and stay as they are; the period is a date, and a date can be written so that
-- it reads the same either way. ISO does that without losing the month, which
-- is the part that matters on a portfolio figure that moves every quarter.
update public.reference_points set observed_period = '2025-06' where key = 'pnmpo_portfolio';
update public.reference_points set observed_period = '2018 – 2020-08' where key = 'mumbuca_retention';
