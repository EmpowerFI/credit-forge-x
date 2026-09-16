import { NavLink, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../auth/useAuth";
import LoadError from "../../components/LoadError";
import DataLegend from "../../components/product/DataLegend";
import PageHeader from "../../components/product/PageHeader";
import { PARTNER_TABS } from "../../lib/partner";
import type { DeskContext } from "./context";
import { usePartnerDesk } from "./queries";

/**
 * EmpowerFI's P2P desk (founder decision D1): it formalises what investors
 * fund, at the allocation engine's rate, and services the loans. Participants
 * appear under a code: indicators, never personal data.
 */
export default function PartnerLayout() {
  const { profile } = useAuth();
  const desk = usePartnerDesk();
  // Auditors and admins follow the desk; only the desk's own users act on it.
  const decides = profile?.role === "partner";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="P2P desk" title={desk.data?.partner?.name ?? "EmpowerFI P2P desk"}
        description="Each qualified opportunity is given a pool by the Capital Allocation Engine and funded by investors, domestic or global. Once funded, the desk formalises it at the engine's rate, disburses by Pix and services it; if the desk declines, investors are refunded. A prototype of a future regulated P2P architecture."
        meta={<DataLegend />} />
      {!decides && (
        <p className="rounded-xl border tone-info px-4 py-3 text-sm">
          You are following this desk as {profile?.role === "auditor" ? "an auditor" : "an admin"}. Only the desk's own users formalise, disburse and record payments.
        </p>
      )}
      {/* The desk has these views in the sidebar; everyone else, and phones, get them here. */}
      <nav aria-label="Desk views"
        className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 ${decides ? "lg:hidden" : ""}`}>
        {PARTNER_TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={"end" in t}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isActive ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      {desk.isError ? <LoadError error={desk.error} onRetry={() => desk.refetch()} />
        : !desk.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
            <Skeleton className="h-72 w-full" />
          </div>
        ) : <Outlet context={{ desk: desk.data, decides } satisfies DeskContext} />}
    </div>
  );
}
