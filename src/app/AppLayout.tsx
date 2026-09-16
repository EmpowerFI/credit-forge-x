import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  ArrowLeftRight,
  ArrowUpRight,
  Cpu,
  FileCheck2,
  History,
  ScanSearch,
  KeyRound,
  ServerCog,
  Share2,
  ShieldCheck,
  Gauge,
  Layers,
  Route as RouteIcon,
  Sprout,
  BadgeCheck,
  Coins,
  LayoutDashboard,
  PieChart,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Gavel,
  ClipboardCheck,
  LogOut,
  Menu,
  Store,
  Split,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import DataLegend from "./components/product/DataLegend";
import NetworkBadge from "./components/product/NetworkBadge";
import WalletChip from "./wallet/WalletChip";
import { useAuth } from "./auth/useAuth";
import { ROLE_LABEL, type Role } from "./lib/platform";
import { prototypeNotice } from "./lib/capital";
import { COMMUNITY_TABS } from "./lib/community";
import { useLedCommunity } from "./pages/community/queries";
import { localized, tr } from "./i18n";
import LanguageSwitch from "./i18n/LanguageSwitch";

// One workspace per persona: the same brand as the corporate site, in the
// product's dark financial theme. Each role sees its own navigation.

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

// Each constant is localized on its own: wrapping one that is already
// localized would copy its texts in the language of the moment.
const COMMUNITIES: NavItem = localized({ to: "/app/community", label: { en: "Communities", pt: "Comunidades" }, icon: Users });
const PIPELINE: NavItem = localized({ to: "/app/partner", label: { en: "P2P desk", pt: "Mesa P2P" }, icon: Briefcase });
const ENGINE: NavItem = localized({ to: "/app/capital", label: { en: "Allocation engine", pt: "Motor de alocação" }, icon: Split });

const AUDIT: NavItem[] = localized([
  { to: "/app/audit", label: { en: "Attestations", pt: "Atestados" }, icon: FileCheck2, end: true },
  { to: "/app/audit/events", label: { en: "Events", pt: "Eventos" }, icon: History },
  { to: "/app/audit/models", label: { en: "Models", pt: "Modelos" }, icon: Cpu },
  { to: "/app/audit/consents", label: { en: "Consents", pt: "Consentimentos" }, icon: ShieldCheck },
  { to: "/app/audit/zcash", label: { en: "Zcash treasury", pt: "Tesouraria Zcash" }, icon: KeyRound },
  { to: "/app/audit/system", label: { en: "System", pt: "Sistema" }, icon: ServerCog },
  { to: "/app/audit/reports", label: { en: "Reports", pt: "Relatórios" }, icon: Share2 },
]);

const NAV: Record<Role, NavItem[]> = {
  entrepreneur: localized([
    { to: "/app/me", label: { en: "My business", pt: "Meu negócio" }, icon: Store },
    { to: "/app/check-in", label: { en: "Monthly check-in", pt: "Check-in mensal" }, icon: CalendarCheck },
    { to: "/app/consent", label: { en: "Consent", pt: "Consentimento" }, icon: ShieldCheck },
  ]),
  community_leader: [COMMUNITIES],
  partner: [
    ...localized([
      { to: "/app/partner", label: { en: "Pipeline", pt: "Pipeline" }, icon: RouteIcon, end: true },
      { to: "/app/partner/reviews", label: { en: "Opportunities", pt: "Oportunidades" }, icon: ClipboardCheck },
      { to: "/app/partner/decisions", label: { en: "Decisions", pt: "Decisões" }, icon: Gavel },
      { to: "/app/partner/portfolio", label: { en: "Portfolio", pt: "Carteira" }, icon: PieChart },
      { to: "/app/partner/servicing", label: { en: "Servicing", pt: "Acompanhamento de pagamentos" }, icon: CalendarClock },
    ]),
    ENGINE,
  ],
  capital_provider: [
    ...localized([
      { to: "/app/investor", label: { en: "Overview", pt: "Visão geral" }, icon: LayoutDashboard, end: true },
      { to: "/app/investor/opportunities", label: { en: "Opportunities", pt: "Oportunidades" }, icon: Coins },
    ]),
    ENGINE,
    ...localized([
      { to: "/app/investor/portfolio", label: { en: "Portfolio", pt: "Carteira" }, icon: PieChart },
      { to: "/app/investor/settlement", label: { en: "Settlement", pt: "Liquidação" }, icon: ArrowLeftRight },
      { to: "/app/investor/audit", label: { en: "Audit trail", pt: "Trilha de auditoria" }, icon: BadgeCheck },
    ]),
  ],
  auditor: [...AUDIT, COMMUNITIES, PIPELINE, ENGINE],
  admin: [
    ...localized([
      { to: "/app/admin", label: { en: "Review queue", pt: "Fila de revisão" }, icon: ClipboardCheck },
      { to: "/app/audit", label: { en: "Audit console", pt: "Console de auditoria" }, icon: ScanSearch },
    ]),
    COMMUNITIES, PIPELINE, ENGINE,
  ],
};

const WORKSPACE: Record<Role, string> = localized({
  entrepreneur: { en: "My business", pt: "Meu negócio" },
  community_leader: { en: "Community Intelligence", pt: "Inteligência Comunitária" },
  partner: { en: "EmpowerFI P2P desk", pt: "Mesa P2P da EmpowerFI" },
  capital_provider: { en: "P2P Capital Console", pt: "Console de Capital P2P" },
  auditor: { en: "Audit", pt: "Auditoria" },
  admin: { en: "EmpowerFI Admin", pt: "Admin da EmpowerFI" },
});

function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between gap-8 p-4">
      <nav className="space-y-1" aria-label={tr({ en: "Workspace", pt: "Área de trabalho" })}>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} onClick={onNavigate}
            className={({ isActive }) =>
              `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                isActive
                  ? "bg-secondary font-semibold text-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-primary"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}>
            <Icon size={17} aria-hidden /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="space-y-4 border-t border-border pt-4">
        <DataLegend compact />
        <p className="text-xs leading-relaxed text-muted-foreground">{prototypeNotice()}</p>
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          empowerfi.io <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

// Keyed on the route, which does not change with the language.
const TAB_ICON: Record<string, LucideIcon> = {
  "": LayoutDashboard, cohorts: Layers, participants: Users, readiness: Gauge, pipeline: RouteIcon, impact: Sprout,
};

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const led = useLedCommunity();
  // A leader works inside her community: its six views are her navigation.
  const items = !profile ? []
    : profile.role === "community_leader" && led.data
      ? COMMUNITY_TABS.map((t) => ({
          to: `/app/community/${led.data!.id}${t.to ? `/${t.to}` : ""}`, label: t.label, icon: TAB_ICON[t.to] ?? Activity, end: "end" in t,
        }))
      : NAV[profile.role];
  const initials = profile?.display_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {items.length > 0 && (
              <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden" onClick={() => setOpen(true)}
                aria-label={tr({ en: "Open navigation", pt: "Abrir navegação" })}>
                <Menu size={22} />
              </button>
            )}
            <Link to="/app" className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
            {profile && (
              <>
                <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
                <span className="hidden truncate font-heading text-base font-semibold text-foreground sm:block">
                  {WORKSPACE[profile.role]}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden rounded-full border border-caution/35 px-2.5 py-1 text-xs font-medium text-caution md:inline">
              {tr({ en: "Simulated data", pt: "Dados simulados" })}
            </span>
            <NetworkBadge />
            <WalletChip />
            {/* On smaller screens the switch sits in the navigation sheet, where the header has no room. */}
            <LanguageSwitch className={items.length > 0 ? "hidden lg:inline-flex" : undefined} />
            {profile && (
              <>
                <div className="hidden items-center gap-2.5 sm:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground" aria-hidden>
                    {initials}
                  </span>
                  <div className="leading-tight">
                    <p className="max-w-[10rem] truncate text-sm font-medium text-foreground">{profile.display_name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut}
                  aria-label={tr({ en: "Sign out", pt: "Sair" })} title={tr({ en: "Sign out", pt: "Sair" })}>
                  <LogOut size={17} />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {items.length > 0 && (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r border-border bg-sidebar lg:block">
            <Sidebar items={items} />
          </aside>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-72 border-border bg-sidebar p-0">
            <SheetTitle className="px-7 pt-6 font-heading text-lg text-foreground">{profile ? WORKSPACE[profile.role] : "EmpowerFI"}</SheetTitle>
            <LanguageSwitch className="px-7 pt-3" />
            <Sidebar items={items} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
