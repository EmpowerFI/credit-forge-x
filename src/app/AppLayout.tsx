import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
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
  ClipboardCheck,
  LogOut,
  Menu,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import DataLegend from "./components/product/DataLegend";
import NetworkBadge from "./components/product/NetworkBadge";
import WalletChip from "./wallet/WalletChip";
import { useAuth } from "./auth/useAuth";
import { ROLE_LABEL, type Role } from "./lib/platform";
import { COMMUNITY_TABS } from "./lib/community";
import { useLedCommunity } from "./pages/community/queries";

// One workspace per persona: the same brand as the corporate site, in the
// product's dark financial theme. Each role sees its own navigation.

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

const COMMUNITIES: NavItem = { to: "/app/community", label: "Communities", icon: Users };
const PIPELINE: NavItem = { to: "/app/partner", label: "Partner pipeline", icon: Briefcase };
const PORTFOLIO: NavItem = { to: "/app/capital", label: "Capital", icon: Wallet };

const NAV: Record<Role, NavItem[]> = {
  entrepreneur: [
    { to: "/app/me", label: "My business", icon: Store },
    { to: "/app/check-in", label: "Monthly check-in", icon: CalendarCheck },
  ],
  community_leader: [COMMUNITIES],
  partner: [{ ...PIPELINE, label: "Pipeline" }],
  capital_provider: [
    { to: "/app/investor", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/app/investor/opportunities", label: "Opportunities", icon: Coins },
    { to: "/app/investor/portfolio", label: "Portfolio", icon: PieChart },
    { to: "/app/investor/audit", label: "Audit trail", icon: BadgeCheck },
  ],
  auditor: [COMMUNITIES, PIPELINE, PORTFOLIO],
  admin: [{ to: "/app/admin", label: "Review queue", icon: ClipboardCheck }, COMMUNITIES, PIPELINE, PORTFOLIO],
};

const WORKSPACE: Record<Role, string> = {
  entrepreneur: "My business",
  community_leader: "Community Intelligence",
  partner: "Partner Desk",
  capital_provider: "Investor Console",
  auditor: "Audit",
  admin: "EmpowerFI Admin",
};

function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col justify-between gap-8 p-4">
      <nav className="space-y-1" aria-label="Workspace">
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
        <p className="text-xs leading-relaxed text-muted-foreground">
          Demo data on Solana Devnet. Every figure here is simulated; no real money moves.
        </p>
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          empowerfi.io <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

const TAB_ICON: Record<string, LucideIcon> = {
  Overview: LayoutDashboard, Cohorts: Layers, Participants: Users, Readiness: Gauge, "Credit pipeline": RouteIcon, Impact: Sprout,
};

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const led = useLedCommunity();
  // A leader works inside her community: its six views are her navigation.
  const items = !profile ? []
    : profile.role === "community_leader" && led.data
      ? COMMUNITY_TABS.map((t) => ({
          to: `/app/community/${led.data!.id}${t.to ? `/${t.to}` : ""}`, label: t.label, icon: TAB_ICON[t.label] ?? Activity, end: "end" in t,
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
                aria-label="Open navigation">
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
              Simulated data
            </span>
            <NetworkBadge />
            <WalletChip />
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
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out" title="Sign out">
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
