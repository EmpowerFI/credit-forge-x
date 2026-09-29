import {
  ArrowLeftRight, BarChart3, Briefcase, CalendarCheck, CalendarClock, ClipboardCheck, Coins, Cpu, FileCheck2, Gavel, Gem, History, KeyRound,
  LayoutDashboard, MapPin, Network, PieChart, Waypoints, Route as RouteIcon, ServerCog, Share2, ShieldCheck, Split, Sprout, Store, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import { localized } from "../i18n";
import type { Role } from "./platform";

// The platform tells one economic loop (refactor spec, 16 Sep): a sponsor funds
// a program, communities run it, the evidence qualifies credit, capital is
// routed and repaid, and the outcome returns to the sponsor. Three stories carry
// it: Impact Intelligence, the Credit & Capital Engine and the Investor Console.
// Everything else is operations: the entrepreneur's own journey, community
// operations, the P2P desk, admin and the audit console.

// Judges have no inbox for magic links, so the demo runs on fixed-password
// accounts (PLAN_HACKATHON.md §G.2). The password is public on purpose: this
// is a demo project with simulated data only.
export const DEMO_PASSWORD = "EmpowerFI-demo-2026";
const DEMO_DOMAIN = "@demo.empowerfi.io";

/** A demo account moves between the stories in one click, as each story's demo persona. */
export const isDemoAccount = (email: string | null | undefined) => Boolean(email?.toLowerCase().endsWith(DEMO_DOMAIN));

export type AreaId = "impact" | "engine" | "investor" | "business" | "community" | "desk" | "admin" | "audit";

export interface Area {
  id: AreaId;
  /** Where the area opens. */
  to: string;
  /** The paths that belong to it. */
  prefix: string[];
  label: string;
  /** Who it is for, in a sentence. */
  audience: string;
  roles: Role[];
  /** The demo account that opens it for someone whose role cannot. */
  persona: { email: string; name: string };
  icon: LucideIcon;
  /** Reached from the money it explains, not from a menu: the area resolves so
   * the shell knows where you are, and is left out of the numbered bar. */
  hidden?: boolean;
}

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

const SPONSOR = { email: "sponsor@demo.empowerfi.io", name: "Helena Prado" };
const INVESTOR = { email: "investor@demo.empowerfi.io", name: "Irene Costa" };

export const STORIES: Area[] = localized([
  {
    id: "impact", to: "/app/impact", prefix: ["/app/impact"], icon: Sprout,
    label: { en: "Impact Intelligence", pt: "Inteligência de Impacto" },
    audience: { en: "For program sponsors: what happened to the cohort, and can I verify it?", pt: "Para quem patrocina programas: o que aconteceu com a turma, e como eu verifico?" },
    roles: ["sponsor", "admin", "auditor"], persona: SPONSOR,
  },
  {
    id: "engine", to: "/app/capital/engine", prefix: ["/app/capital"], icon: Split,
    label: { en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" },
    audience: {
      en: "How a request is judged, where its capital comes from, and what that capital then did.",
      pt: "Como um pedido é avaliado, de onde vem o capital dele, e o que esse capital fez depois.",
    },
    roles: ["sponsor", "capital_provider", "partner", "admin", "auditor"], persona: SPONSOR,
    hidden: true,
  },
  {
    id: "investor", to: "/app/investor", prefix: ["/app/investor"], icon: Wallet,
    label: { en: "Investor Console", pt: "Console do Investidor" },
    audience: { en: "Which opportunities match my mandate, and what happened after funding?", pt: "Quais oportunidades cabem no meu mandato, e o que aconteceu depois da captação?" },
    roles: ["capital_provider", "admin", "auditor"], persona: INVESTOR,
  },
]);

export const OPERATIONS: Area[] = localized([
  {
    id: "business", to: "/app/me", prefix: ["/app/me", "/app/check-in", "/app/consent"], icon: Store,
    label: { en: "My business", pt: "Meu negócio" },
    audience: { en: "The entrepreneur's own journey: check-ins, readiness, credit and consent.", pt: "A jornada da empreendedora: check-ins, prontidão, crédito e consentimento." },
    roles: ["entrepreneur"], persona: { email: "maria@demo.empowerfi.io", name: "Maria Oliveira" },
  },
  {
    id: "community", to: "/app/community", prefix: ["/app/community"], icon: Users,
    label: { en: "Community operations", pt: "Operação da comunidade" },
    audience: { en: "Cohorts, education and check-ins, run by the community.", pt: "Turmas, formação e check-ins, conduzidos pela comunidade." },
    roles: ["community_leader", "admin", "auditor"], persona: { email: "leader@demo.empowerfi.io", name: "Lúcia Santos" },
  },
  {
    id: "desk", to: "/app/partner", prefix: ["/app/partner"], icon: Briefcase,
    label: { en: "P2P desk", pt: "Mesa P2P" },
    audience: { en: "Formalisation, simulated Pix, servicing and outcomes.", pt: "Formalização, Pix simulado, acompanhamento e resultados." },
    roles: ["partner", "admin", "auditor"], persona: { email: "partner@demo.empowerfi.io", name: "Paulo Mendes" },
  },
  {
    id: "admin", to: "/app/admin", prefix: ["/app/admin"], icon: ClipboardCheck,
    label: { en: "Admin", pt: "Admin" },
    audience: { en: "Community verification and requests held for review.", pt: "Verificação de comunidades e pedidos retidos para revisão." },
    roles: ["admin"], persona: { email: "admin@demo.empowerfi.io", name: "Ana Reis" },
  },
  {
    id: "audit", to: "/app/audit", prefix: ["/app/audit"], icon: ShieldCheck,
    label: { en: "Audit console", pt: "Console de auditoria" },
    audience: { en: "Every record, recomputed in your browser and checked against Solana.", pt: "Cada registro, recalculado no seu navegador e conferido na Solana." },
    roles: ["auditor", "admin"], persona: { email: "auditor@demo.empowerfi.io", name: "Otávio Lima" },
  },
]);

export const AREAS: Area[] = [...STORIES, ...OPERATIONS];

/** The area a path belongs to. A single record's verification page belongs to no area. */
export function areaOf(pathname: string): Area | undefined {
  if (/^\/app\/audit\/[^/]+\/[^/]+/.test(pathname)) return undefined;
  return AREAS.find((a) => a.prefix.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
}

export const canOpen = (area: Area, role: Role | undefined) => Boolean(role && area.roles.includes(role));

/** Where each role starts: the story it is for. */
export const HOME: Record<Role, AreaId> = {
  sponsor: "impact",
  capital_provider: "investor",
  // The desk, not the panel. A partner signing in has work waiting; the engine
  // shows how the mechanism decides, which is a thing to look at rather than a
  // thing to do.
  partner: "desk",
  community_leader: "community",
  entrepreneur: "business",
  auditor: "audit",
  admin: "impact",
};

/** Each area's own views, in its sidebar. A leader's community views come from her community. */
export const SUBNAV: Partial<Record<AreaId, NavItem[]>> = localized({
  // The engine's home had no sidebar at all: whoever entered as the operator
  // landed there with no way on except the header menu.
  engine: [
    { to: "/app/capital", label: { en: "Capital Journey", pt: "Jornada do Capital" }, icon: Waypoints, end: true },
    { to: "/app/capital/engine", label: { en: "Engine", pt: "Motor" }, icon: Split },
    { to: "/app/capital/network", label: { en: "Capital Network", pt: "Rede de Capital" }, icon: Network },
    { to: "/app/capital/local", label: { en: "Local Economy", pt: "Economia Local" }, icon: MapPin },
    { to: "/app/capital/economics", label: { en: "Operating economics", pt: "Economia operacional" }, icon: BarChart3 },
  ],
  business: [
    { to: "/app/me", label: { en: "My business", pt: "Meu negócio" }, icon: Store },
    { to: "/app/check-in", label: { en: "Monthly check-in", pt: "Check-in mensal" }, icon: CalendarCheck },
    { to: "/app/consent", label: { en: "Consent", pt: "Consentimento" }, icon: ShieldCheck },
  ],
  investor: [
    { to: "/app/investor", label: { en: "Overview", pt: "Visão geral" }, icon: LayoutDashboard, end: true },
    { to: "/app/investor/opportunities", label: { en: "Opportunities", pt: "Oportunidades" }, icon: Coins },
    { to: "/app/investor/portfolio", label: { en: "Portfolio", pt: "Carteira" }, icon: PieChart },
    { to: "/app/investor/assets", label: { en: "Positions", pt: "Posições" }, icon: Gem },
    { to: "/app/investor/settlement", label: { en: "Settlement", pt: "Liquidação" }, icon: ArrowLeftRight },
  ],
  desk: [
    { to: "/app/partner", label: { en: "Pipeline", pt: "Pipeline" }, icon: RouteIcon, end: true },
    { to: "/app/partner/reviews", label: { en: "Opportunities", pt: "Oportunidades" }, icon: ClipboardCheck },
    { to: "/app/partner/decisions", label: { en: "Decisions", pt: "Decisões" }, icon: Gavel },
    { to: "/app/partner/portfolio", label: { en: "Portfolio", pt: "Carteira" }, icon: PieChart },
    { to: "/app/partner/servicing", label: { en: "Servicing", pt: "Acompanhamento de pagamentos" }, icon: CalendarClock },
  ],
  audit: [
    { to: "/app/audit", label: { en: "Attestations", pt: "Atestados" }, icon: FileCheck2, end: true },
    { to: "/app/audit/events", label: { en: "Events", pt: "Eventos" }, icon: History },
    { to: "/app/audit/models", label: { en: "Models", pt: "Modelos" }, icon: Cpu },
    { to: "/app/audit/consents", label: { en: "Consents", pt: "Consentimentos" }, icon: ShieldCheck },
    { to: "/app/audit/zcash", label: { en: "Zcash treasury", pt: "Tesouraria Zcash" }, icon: KeyRound },
    { to: "/app/audit/system", label: { en: "System", pt: "Sistema" }, icon: ServerCog },
    { to: "/app/audit/reports", label: { en: "Reports", pt: "Relatórios" }, icon: Share2 },
  ],
});
