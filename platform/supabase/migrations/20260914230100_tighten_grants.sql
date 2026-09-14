-- Grants the platform's defaults left behind.
--
-- The two views run as the caller over tables with RLS, so nothing leaked
-- through them; they still should not offer anon a read, or anyone a write.
-- tests/rbac.test.sql now checks every table, view and function for this.

revoke all on public.checkin_cash_flow, public.latest_readiness from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.checkin_cash_flow, public.latest_readiness from authenticated;

revoke all on function private.expected_loss_bps(public.grade) from public;
grant execute on function private.expected_loss_bps(public.grade) to authenticated, service_role;
