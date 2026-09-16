import { NavLink, Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../../auth/useAuth";
import { tr } from "../../i18n";
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
      <PageHeader eyebrow={tr({ en: "P2P desk", pt: "Mesa P2P" })}
        // The seeded desk's name is stored in English; any other name shows as written.
        title={desk.data?.partner?.name && desk.data.partner.name !== "EmpowerFI P2P desk" ? desk.data.partner.name : tr({ en: "EmpowerFI P2P desk", pt: "Mesa P2P da EmpowerFI" })}
        description={tr({
          en: "Each qualified opportunity is given a pool by the Capital Allocation Engine and funded by investors, domestic or global. Once funded, the desk formalises it at the engine's rate, disburses by Pix and services it; if the desk declines, investors are refunded. A prototype of a future regulated P2P architecture.",
          pt: "Cada oportunidade qualificada recebe um pool do Motor de Alocação de Capital e é captada com investidores, domésticos ou globais. Captada, a mesa a formaliza com a taxa do motor, desembolsa por Pix e acompanha os pagamentos; se a mesa recusar, os investidores são reembolsados. Protótipo de uma futura arquitetura regulada de crédito P2P.",
        })}
        meta={<DataLegend />} />
      {!decides && (
        <p className="rounded-xl border tone-info px-4 py-3 text-sm">
          {profile?.role === "auditor"
            ? tr({
              en: "You are following this desk as an auditor. Only the desk's own users formalise, disburse and record payments.",
              pt: "Você acompanha esta mesa como auditor. Só os usuários da própria mesa formalizam, desembolsam e registram pagamentos.",
            })
            : tr({
              en: "You are following this desk as an admin. Only the desk's own users formalise, disburse and record payments.",
              pt: "Você acompanha esta mesa como admin. Só os usuários da própria mesa formalizam, desembolsam e registram pagamentos.",
            })}
        </p>
      )}
      {/* The desk has these views in the sidebar; everyone else, and phones, get them here. */}
      <nav aria-label={tr({ en: "Desk views", pt: "Visões da mesa" })}
        className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 ${decides ? "lg:hidden" : ""}`}>
        {PARTNER_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={"end" in t}
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
