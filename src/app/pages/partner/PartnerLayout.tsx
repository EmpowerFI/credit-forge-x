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
 * The partner's desk. EmpowerFI prepares and qualifies; the lending decision,
 * the price, the contract and the servicing are the partner's. Participants
 * appear under a code: indicators to decide on, never personal data.
 */
export default function PartnerLayout() {
  const { profile } = useAuth();
  const desk = usePartnerDesk();
  // Auditors and admins follow the desk; only the partner acts on it.
  const decides = profile?.role === "partner";

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Partner desk" title={desk.data?.partner?.name ?? "Credit partner"}
        description="EmpowerFI prepares and qualifies each request. Whether to lend, at what price, and when to disburse are your decisions. Investors fund an opportunity from the moment it is eligible; you formalise once it is funded, and if you decline, they are refunded."
        meta={<DataLegend />} />
      {!decides && (
        <p className="rounded-xl border tone-info px-4 py-3 text-sm">
          You are following this desk as {profile?.role === "auditor" ? "an auditor" : "EmpowerFI"}. Only the partner's own users decide, disburse and record payments.
        </p>
      )}
      {/* A partner has these views in the sidebar; everyone else, and phones, get them here. */}
      <nav aria-label="Partner views"
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
