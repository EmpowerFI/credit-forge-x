import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import DataLegend from "../../components/product/DataLegend";
import PageHeader from "../../components/product/PageHeader";
import { tr } from "../../i18n";
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
      <PageHeader eyebrow={tr({ en: "Audit", pt: "Auditoria" })} title={tr({ en: "Audit console", pt: "Console de auditoria" })}
        description={tr({
          en: "Every fact EmpowerFI records, the proof of it on Solana, the models behind each decision, the consent it rests on, the Zcash treasury as its viewing key reads it, the machinery that keeps it all moving, and reports to share by link. Participants appear by code, never by name.",
          pt: "Cada fato que a EmpowerFI registra, sua prova na Solana, os modelos por trás de cada decisão, o consentimento em que se apoia, a tesouraria Zcash como a chave de visualização a lê, a engrenagem que mantém tudo funcionando e relatórios para compartilhar por link. As participantes aparecem por código, nunca pelo nome.",
        })}
        meta={<DataLegend />} />
      {/* An auditor has these views in the sidebar; admins, and phones, get them here. */}
      <nav aria-label={tr({ en: "Audit views", pt: "Visões da auditoria" })}
        className={`-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 ${profile?.role === "auditor" ? "lg:hidden" : ""}`}>
        {AUDIT_TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={"end" in t}
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
