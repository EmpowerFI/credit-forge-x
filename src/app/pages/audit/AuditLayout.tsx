import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import DataLegend from "../../components/product/DataLegend";
import PageHeader from "../../components/product/PageHeader";
import { AUDIT_TABS } from "../../lib/audit";

/**
 * The audit console: what an auditor needs to check the platform without
 * taking anyone's word for it. Every proof is one click from being recomputed
 * in the browser and compared with Solana.
 */
export default function AuditLayout() {
  const { profile } = useAuth();
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit" title="Audit console"
        description="Every fact EmpowerFI records, the proof of it on Solana, the models behind each decision, the consent it rests on, the Zcash treasury as its viewing key reads it, and the machinery that keeps it all moving. Participants appear by code, never by name."
        meta={<DataLegend />} />
      {/* An auditor has these views in the sidebar; admins, and phones, get them here. */}
      <nav aria-label="Audit views"
        className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 ${profile?.role === "auditor" ? "lg:hidden" : ""}`}>
        {AUDIT_TABS.map((t) => (
          <NavLink key={t.label} to={t.to} end={"end" in t}
            className={({ isActive }) =>
              `whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                isActive ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
