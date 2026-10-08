import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, ArrowUpRight, Check, ChevronDown, ChevronRight, Eye, Gauge, Layers, Loader2, LogOut, Menu, Route as RouteIcon, Sprout, Users, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import DataLegend from "./components/product/DataLegend";
import ProofDrawerProvider from "./components/proof/ProofDrawer";
import NetworkBadge from "./components/product/NetworkBadge";
import WalletChip from "./wallet/WalletChip";
import { useAuth } from "./auth/useAuth";
import { useOpenArea } from "./auth/useOpenArea";
import { ROLE_LABEL } from "./lib/platform";
import { prototypeNotice } from "./lib/capital";
import { COMMUNITY_TABS } from "./lib/community";
import { type Area, areaOf, canOpen, type NavItem, OPERATIONS, STORIES, SUBNAV } from "./lib/stories";
import { opensView, roleOpensPath, viewById, viewOf, VIEWS } from "./lib/views";
import { useLedCommunity } from "./pages/community/queries";
import { tr } from "./i18n";
import LanguageSwitch from "./i18n/LanguageSwitch";

// Three stories carry the loop, in order: the sponsor's evidence, the engine
// that qualifies and routes capital, and the investor who funds it. Operations
// sit behind them. Each area keeps its own views in the sidebar.

// Keyed on the route, which does not change with the language.
const TAB_ICON: Record<string, LucideIcon> = {
  "": Activity, cohorts: Layers, participants: Users, readiness: Gauge, pipeline: RouteIcon, impact: Sprout,
};

function SubNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1" aria-label={tr({ en: "Views", pt: "Telas" })}>
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
  );
}

function Footnote() {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <DataLegend compact withEvidence />
      <p className="text-xs leading-relaxed text-muted-foreground">{prototypeNotice()}</p>
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        empowerfi.io <ArrowUpRight size={12} aria-hidden />
      </Link>
    </div>
  );
}

/**
 * "View platform as": the five views, offered where the account lives, because
 * choosing one is choosing who you are looking as — not where you are going.
 * It never widens access: a demo account switches to the view's demo persona,
 * any other account only sees the views its role opens.
 */
function ViewMenuItems({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();
  const { openView, viewVisible } = useOpenArea();
  const { pathname, search } = useLocation();
  const onStart = pathname === "/app/start";
  const current = (onStart ? viewById(new URLSearchParams(search).get("as")) : undefined) ?? viewOf(profile?.role);
  const views = VIEWS.filter(viewVisible);
  if (!profile || views.length === 0) return null;
  return (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {tr({ en: "View platform as", pt: "Ver plataforma como" })}
      </DropdownMenuLabel>
      {views.map((v) => {
        const Icon = v.icon;
        const switches = !opensView(v, profile.role);
        return (
          <DropdownMenuItem key={v.id} className="items-start gap-3 py-2"
            onSelect={() => { onNavigate?.(); void openView(v, `/app/start?as=${v.id}`); }}>
            <Icon size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-sm font-medium">{v.label}</span>
              {switches && <span className="block text-xs text-muted-foreground">{tr({ en: `As the demo ${v.persona.name}`, pt: `Como ${v.persona.name}, conta demo` })}</span>}
            </span>
            {current?.id === v.id && <Check size={15} className="mt-0.5 shrink-0" aria-hidden />}
          </DropdownMenuItem>
        );
      })}
    </>
  );
}

/** The same choice on a phone, inside the navigation sheet. */
function ViewSelector({ onNavigate }: { onNavigate?: () => void }) {
  const { profile } = useAuth();
  const { switching, viewVisible } = useOpenArea();
  const views = VIEWS.filter(viewVisible);
  if (!profile || views.length === 0) return null;
  const current = viewOf(profile.role);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2">
            {switching?.startsWith("view:") ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Eye size={15} className="text-accent" aria-hidden />}
            {current?.label ?? ROLE_LABEL[profile.role]}
          </span>
          <ChevronDown size={14} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <ViewMenuItems onNavigate={onNavigate} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Links with a #section scroll to it once the section has loaded. */
function useScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    // Below the sticky header, and again once late sections have settled the layout.
    const scroll = (el: HTMLElement) => {
      const header = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - header - 16 });
    };
    let tries = 0;
    let settle = 0;
    const timer = window.setInterval(() => {
      const el = document.getElementById(id);
      if (el || ++tries > 40) {
        window.clearInterval(timer);
        if (el) {
          scroll(el);
          settle = window.setTimeout(() => scroll(el), 600);
        }
      }
    }, 100);
    return () => { window.clearInterval(timer); window.clearTimeout(settle); };
  }, [pathname, hash]);
}

/** The three stories as numbered steps of one loop, and Operations beside them. */
function StoryBar({ current, onNavigate, vertical = false }: { current?: Area; onNavigate?: () => void; vertical?: boolean }) {
  const { profile } = useAuth();
  const { open, switching, visible } = useOpenArea();
  const stories = STORIES.filter((a) => !a.hidden && visible(a));
  // `hidden` used to be honoured for the stories only, so an operations area
  // marked hidden stayed in this menu — the flag half-applied.
  const operations = OPERATIONS.filter((a) => !a.hidden && visible(a));
  const go = (area: Area) => { onNavigate?.(); void open(area); };
  const switchHint = (area: Area) => canOpen(area, profile?.role) ? undefined
    : tr({ en: `Opens as the demo ${area.persona.name}`, pt: `Abre como ${area.persona.name}, conta demo` });

  return (
    <nav aria-label={tr({ en: "Stories", pt: "Histórias" })}
      className={cn(vertical ? "space-y-1" : "flex items-center gap-1 overflow-x-auto")}>
      {stories.map((area, i) => {
        const active = current?.id === area.id;
        const Icon = area.icon;
        return (
          <div key={area.id} className={cn(!vertical && "flex items-center gap-1")}>
            {!vertical && i > 0 && <ChevronRight size={14} className="shrink-0 text-muted-foreground/60" aria-hidden />}
            <button type="button" onClick={() => go(area)} title={switchHint(area) ?? area.audience} aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors",
                vertical && "w-full",
                active ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground")}>{i + 1}</span>
              {switching === area.id ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Icon size={15} aria-hidden />}
              {area.label}
            </button>
          </div>
        );
      })}
      {operations.length > 0 && (vertical ? (
        <div className="space-y-1 pt-3">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tr({ en: "Operations", pt: "Operações" })}</p>
          {operations.map((area) => {
            const Icon = area.icon;
            return (
              <button key={area.id} type="button" onClick={() => go(area)} title={switchHint(area)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm",
                  current?.id === area.id ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")}>
                {switching === area.id ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Icon size={15} aria-hidden />} {area.label}
              </button>
            );
          })}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn("ml-2 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm",
              current && OPERATIONS.includes(current) ? "bg-secondary font-semibold text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <Wrench size={15} aria-hidden /> {current && OPERATIONS.includes(current) ? current.label : tr({ en: "Operations", pt: "Operações" })}
              {switching && operations.some((a) => a.id === switching) ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {tr({ en: "Execution tooling behind the three stories", pt: "As ferramentas de execução por trás das três histórias" })}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {operations.map((area) => {
              const Icon = area.icon;
              return (
                <DropdownMenuItem key={area.id} onSelect={() => go(area)} className="items-start gap-3 py-2">
                  <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{area.label}</span>
                    <span className="block text-xs text-muted-foreground">{switchHint(area) ?? area.audience}</span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const led = useLedCommunity();
  const current = areaOf(pathname);
  useScrollToHash();

  // A leader works inside her community: its six views are her sidebar.
  const subnav: NavItem[] = !current ? []
    : current.id === "community" && profile?.role === "community_leader" && led.data
      ? COMMUNITY_TABS.map((t) => ({
          to: `/app/community/${led.data!.id}${t.to ? `/${t.to}` : ""}`, label: t.label, icon: TAB_ICON[t.to] ?? Activity, end: "end" in t,
        }))
      : SUBNAV[current.id] ?? [];
  // A sidebar must not offer a door that is locked. Operating economics is
  // narrower than the engine area around it, so an investor inside the engine
  // would be shown a link that refuses her. Filter only where the role opens
  // the area itself; an admin or auditor looking into someone else's area
  // keeps the whole sidebar, as the routes there let them through.
  const nav = current && canOpen(current, profile?.role)
    ? subnav.filter((item) => roleOpensPath(item.to, profile?.role))
    : subnav;
  const initials = profile?.display_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <ProofDrawerProvider>
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {profile && (
              <button className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden" onClick={() => setOpen(true)}
                aria-label={tr({ en: "Open navigation", pt: "Abrir navegação" })}>
                <Menu size={22} />
              </button>
            )}
            <Link to={profile ? "/app/start" : "/app"} className="font-heading text-xl font-bold text-gradient">EmpowerFI</Link>
            {current && (
              <>
                <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
                <span className="hidden truncate font-heading text-base font-semibold text-foreground sm:block">{current.label}</span>
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
            <LanguageSwitch className={profile ? "hidden lg:inline-flex" : undefined} />
            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-secondary/60"
                    aria-label={tr({ en: "Your account and the view", pt: "Sua conta e a visão" })}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground" aria-hidden>
                      {initials}
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block max-w-[10rem] truncate text-sm font-medium text-foreground">{profile.display_name}</span>
                      <span className="block text-xs text-muted-foreground">{viewOf(profile.role)?.label ?? ROLE_LABEL[profile.role]}</span>
                    </span>
                    <ChevronDown size={14} className="text-muted-foreground" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <ViewMenuItems />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => void signOut()} className="gap-3 py-2">
                    <LogOut size={16} aria-hidden /> <span className="text-sm">{tr({ en: "Sign out", pt: "Sair" })}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        {profile && (
          <div className="hidden border-t border-border/60 px-4 py-1.5 lg:block lg:px-6">
            <StoryBar current={current} />
          </div>
        )}
      </header>

      <div className="flex">
        {nav.length > 0 && (
          <aside className="sticky top-[6.75rem] hidden h-[calc(100vh-6.75rem)] w-60 shrink-0 border-r border-border bg-sidebar lg:block">
            <div className="flex h-full flex-col justify-between gap-8 overflow-y-auto p-4">
              <SubNav items={nav} />
              <Footnote />
            </div>
          </aside>
        )}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-80 overflow-y-auto border-border bg-sidebar p-0">
            <SheetTitle className="px-7 pt-6 font-heading text-lg text-foreground">{current?.label ?? "EmpowerFI"}</SheetTitle>
            <LanguageSwitch className="px-7 pt-3" />
            <div className="space-y-6 p-4">
              <ViewSelector onNavigate={() => setOpen(false)} />
              <StoryBar current={current} vertical onNavigate={() => setOpen(false)} />
              {nav.length > 0 && (
                <div className="space-y-1 border-t border-border pt-4">
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{current?.label}</p>
                  <SubNav items={nav} onNavigate={() => setOpen(false)} />
                </div>
              )}
              <Footnote />
            </div>
          </SheetContent>
        </Sheet>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </ProofDrawerProvider>
  );
}
