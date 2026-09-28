-- The journey's picker lists what travelled, not what is still queued.

-- Following one request is the reading the whole screen exists for: one
-- woman's capital and every hop it took. It has never been able to show a hop.
-- The picker was borrowing engine_opportunities(), which is the desk's pipeline
-- and excludes anything that became a loan — so the only requests it could
-- offer were the ones that had not been disbursed, and a focused reading
-- reported zero through movements two, three and four. A true answer to a
-- question nobody asked, and it would have been read out loud on camera.
--
-- So the journey gets its own reader: every qualified request, with how far it
-- actually got, and the ones that travelled furthest first. A request whose
-- units have already been redeemed back into reais comes first of all, because
-- that one closes the loop rather than reaching its third movement — and it is
-- what the reading should open on rather than leaving to be picked out of a
-- list. A request that only crossed onto the rail comes next, then one merely
-- disbursed, because the rail is the part the rest of this product could not
-- show before.
--
-- Same guard and the same two codes as the pipeline reader: a partner sees the
-- borrower's reference and everybody else sees the opportunity's, because those
-- are the two things the two screens search by.

create function public.journey_opportunities()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role text := private.my_role();
  v_partner uuid := private.my_partner_id();
begin
  if not (private.is_investor_or_overseer() or v_partner is not null or v_role = 'sponsor') then
    raise exception 'not_allowed_to_see_capital' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'opportunity_id', o.id,
        'code', case when v_partner is not null
                     then private.partner_code(o.entrepreneur_id)
                     else private.opportunity_code(o.id) end,
        'amount_cents', o.amount_cents,
        'purpose', o.purpose,
        'reached', r.reached)
      order by array_position(array['looped', 'rail', 'disbursed', 'funded', 'raising', 'waiting'], r.reached),
               o.created_at desc, o.id), '[]')
    from public.qualified_credit_opportunities o
    left join lateral (
      select l.id, l.status from public.loans l where l.opportunity_id = o.id
      order by l.created_at desc limit 1
    ) l on true
    cross join lateral (
      select case
        when exists (select 1 from public.local_conversions lc
                     where lc.loan_id = l.id and lc.direction = 'redeem') then 'looped'
        when exists (select 1 from public.local_conversions lc
                     where lc.loan_id = l.id and lc.direction = 'issue') then 'rail'
        when l.status in ('DISBURSED', 'ACTIVE', 'PAID', 'DEFAULTED') then 'disbursed'
        when o.funding_status = 'funded' then 'funded'
        when o.funding_status in ('open', 'partially_funded') then 'raising'
        else 'waiting'
      end as reached
    ) r
  );
end;
$$;

revoke execute on function public.journey_opportunities() from public, anon;
grant execute on function public.journey_opportunities() to authenticated;
