-- EmpowerFI sets a sponsor's campaign rewards too.
--
-- Founder's decision, 17/11/2026: the 30-day campaign starting on 1 December
-- has lives as rewards -- a woman who has recorded 10 days gets the link to
-- the first, 20 days the second -- besides the money for completing it
-- (programs.reward_cents, 20270107). Until now a sponsor's campaign rewards
-- could be set only by that sponsor's people, in the impact area. From now on
-- whoever manages the house rewards (the dashboard's owners) may set them in
-- any campaign as well; the sponsor's people keep their say.
--
-- Nothing else changes: a sponsor's campaign still offers only gifts (perks)
-- with the words that say how to redeem them and, optionally, an https link
-- (reward_programme_publish, 20261209); every publish is a new frozen version.
-- A live is such a gift: its title, when it is, and its link.

create or replace function private.can_edit_rewards(p_program_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when g.is_default then private.can_manage_rewards()
    else private.can_manage_rewards()
      or exists (select 1 from public.sponsor_viewers v
                  where v.sponsor_id = g.sponsor_id and v.email = private.my_email())
  end
    from public.programs g
   where g.id = p_program_id and not g.is_simulated
$$;

revoke execute on function private.can_edit_rewards(uuid) from public, anon, authenticated;
