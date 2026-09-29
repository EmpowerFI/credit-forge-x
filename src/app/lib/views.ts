import {
  ArrowLeftRight, Banknote, BarChart3, Briefcase, CalendarCheck, CalendarClock, ClipboardList, Coins, FileCheck2, FileText, Filter,
  Gauge, Gem, GraduationCap, HandCoins, Layers, MapPin, PieChart, ShieldCheck, SlidersHorizontal,
  Sprout, Store, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { localized } from "../i18n";
import type { Role } from "./platform";
import { areaOf } from "./stories";

// "View platform as" (refactor spec §3A, 17 Sep). Five views, each with its
// value, its tools and a demo account. A view is a lens, not a permission: the
// routes stay behind RBAC, and an account only opens a view its role holds —
// except demo accounts, which switch to the view's demo persona.
//
// Three destinations left this file and none of them left the product: the
// Capital Network, operating economics and the Capital Journey are still
// routed, still linked from the pages that need them, and no longer offered in
// a menu. They were read as three more things to understand before anything
// could be understood at all — and two of them appeared under three different
// personas, which is what made the same product look like several.

export type ViewId = "sponsor" | "investor" | "operator" | "community" | "entrepreneur";

export interface Tool {
  label: string;
  what: string;
  icon: LucideIcon;
  /** A platform path, or for community tools the path inside the leader's community. */
  to: string;
  community?: true;
}

export interface View {
  id: ViewId;
  label: string;
  /** The value, in one line. */
  value: string;
  headline: string;
  lead: string;
  /** Who holds it: the roles whose accounts open it. */
  roles: Role[];
  persona: { email: string; name: string; role: Role };
  /** Where "Open" lands. */
  home: Tool;
  primary: Tool[];
  secondary: Tool[];
  icon: LucideIcon;
}

const t = (tool: Omit<Tool, "label" | "what"> & { label: { en: string; pt: string }; what: { en: string; pt: string } }) => tool;

const IMPACT = t({ to: "/app/impact", icon: Sprout,
  label: { en: "Impact Intelligence", pt: "Inteligência de Impacto" },
  what: { en: "The program at a glance: funding, reach, readiness, capital and outcomes.", pt: "O programa num relance: recursos, alcance, prontidão, capital e resultados." } });
const LOCAL = t({ to: "/app/capital/local", icon: MapPin,
  label: { en: "Local Economy", pt: "Economia Local" },
  what: { en: "What each unit of capital produced inside the territory, how much stayed, and how much came from abroad.", pt: "O que cada unidade de capital produziu dentro do território, quanto ficou, e quanto veio de fora." } });
const DESK = t({ to: "/app/partner", icon: Briefcase,
  label: { en: "P2P desk", pt: "Mesa P2P" },
  what: { en: "Requests waiting to be formalised and disbursed (simulated Pix).", pt: "Pedidos aguardando formalização e desembolso (Pix simulado)." } });
const CONSOLE = t({ to: "/app/investor", icon: Wallet,
  label: { en: "Investor Console", pt: "Console do Investidor" },
  what: { en: "Your mandate, liquidity and positions.", pt: "Seu mandato, liquidez e posições." } });
const COMMUNITY_HOME = t({ to: "", community: true, icon: Users,
  label: { en: "Community overview", pt: "Visão da comunidade" },
  what: { en: "Where the cohort stands this month.", pt: "Onde a turma está neste mês." } });
const MY_BUSINESS = t({ to: "/app/me", icon: Store,
  label: { en: "My business", pt: "Meu negócio" },
  what: { en: "Your months, your readiness and your request.", pt: "Seus meses, sua prontidão e seu pedido." } });

export const VIEWS: View[] = localized([
  {
    id: "sponsor", icon: Sprout,
    label: { en: "Program Sponsor / ESG", pt: "Patrocinador de programa / ESG" },
    value: { en: "Prove what the funded program changed and how much capital it mobilized.", pt: "Prove o que o programa financiado mudou e quanto capital ele mobilizou." },
    headline: { en: "Prove what your program changed.", pt: "Prove o que o seu programa mudou." },
    lead: {
      en: "Track participation, business progress, credit readiness, capital mobilized and outcomes — with verifiable evidence.",
      pt: "Acompanhe participação, evolução dos negócios, prontidão para crédito, capital mobilizado e resultados — com evidência verificável.",
    },
    roles: ["sponsor"],
    persona: { email: "sponsor@demo.empowerfi.io", name: "Helena Prado", role: "sponsor" },
    home: IMPACT,
    primary: [
      IMPACT,
      t({ to: "/app/impact#funnel", icon: Filter, label: { en: "Cohort funnel", pt: "Funil da turma" },
        what: { en: "From sponsored to performing, stage by stage.", pt: "De patrocinadas a em dia, etapa por etapa." } }),
      t({ to: "/app/impact#capital", icon: HandCoins, label: { en: "Capital mobilization", pt: "Mobilização de capital" },
        what: { en: "Qualified demand, domestic and global funding, the gap.", pt: "Demanda qualificada, captação doméstica e global, a lacuna." } }),
      t({ to: "/app/impact#outcomes", icon: TrendingUp, label: { en: "Outcomes", pt: "Resultados" },
        what: { en: "Repayment, productive use and change in sales, where measured.", pt: "Pagamento, uso produtivo e variação das vendas, onde medidos." } }),
      t({ to: "/app/impact#evidence", icon: ShieldCheck, label: { en: "Proofs", pt: "Provas" },
        what: { en: "Every commitment, checked against Solana from your browser.", pt: "Cada registro, conferido na Solana a partir do seu navegador." } }),
      t({ to: "/app/impact#report", icon: FileText, label: { en: "Sponsor report", pt: "Relatório do patrocinador" },
        what: { en: "The program's figures, method and proofs, to download.", pt: "Os números, o método e as provas do programa, para baixar." } }),
    ],
    secondary: [],
  },
  {
    id: "investor", icon: Wallet,
    label: { en: "Investor / Impact Fund", pt: "Investidor / Fundo de impacto" },
    value: { en: "Find qualified opportunities matching your mandate and follow funding, repayment and outcomes.", pt: "Encontre oportunidades qualificadas que cabem no seu mandato e acompanhe captação, pagamentos e resultados." },
    headline: { en: "Deploy capital into qualified productive-credit opportunities.", pt: "Aplique capital em oportunidades qualificadas de crédito produtivo." },
    lead: {
      en: "Matched to your mandate, then follow repayments and measurable outcomes.",
      pt: "De acordo com o seu mandato, e depois acompanhe pagamentos e resultados mensuráveis.",
    },
    roles: ["capital_provider"],
    persona: { email: "investor@demo.empowerfi.io", name: "Irene Costa", role: "capital_provider" },
    home: CONSOLE,
    primary: [
      CONSOLE,
      t({ to: "/app/investor/opportunities", icon: Coins, label: { en: "Opportunities", pt: "Oportunidades" },
        what: { en: "Qualified requests by code, with affordability and proof status.", pt: "Pedidos qualificados por código, com capacidade de pagamento e status das provas." } }),
      t({ to: "/app/investor/opportunities#filters", icon: SlidersHorizontal, label: { en: "Mandate filters", pt: "Filtros do mandato" },
        what: { en: "Geography, purpose, ticket, risk appetite and impact mandate.", pt: "Território, finalidade, ticket, apetite a risco e mandato de impacto." } }),
      t({ to: "/app/investor/portfolio", icon: PieChart, label: { en: "Portfolio and positions", pt: "Carteira e posições" },
        what: { en: "Funded, outstanding, repaid and the outcome of each.", pt: "Captado, em aberto, pago e o resultado de cada uma." } }),
      t({ to: "/app/investor/assets", icon: Gem, label: { en: "Tokenised positions", pt: "Posições tokenizadas" },
        what: { en: "Each funded loan as an asset you hold, and where it may go.", pt: "Cada empréstimo financiado como um ativo seu, e para onde ele pode ir." } }),
      t({ to: "/app/investor/settlement", icon: ArrowLeftRight, label: { en: "Payments", pt: "Pagamentos" },
        what: { en: "USDC in and out, the simulated off-ramp and Pix.", pt: "Entrada e saída de USDC, a conversão e o Pix simulados." } }),
      t({ to: "/app/investor/audit", icon: ShieldCheck, label: { en: "Proofs", pt: "Provas" },
        what: { en: "Your allocations and their loans, on Solana.", pt: "Suas alocações e os empréstimos delas, na Solana." } }),
    ],
    secondary: [],
  },
  {
    id: "operator", icon: Briefcase,
    label: { en: "Operations", pt: "Operação" },
    value: { en: "Formalise, disburse and follow the loans this desk carries.", pt: "Formalize, desembolse e acompanhe os empréstimos desta mesa." },
    headline: { en: "Run the desk.", pt: "Toque a mesa." },
    lead: {
      en: "Approve, disburse, record instalments and measure what the capital did.",
      pt: "Aprove, desembolse, registre parcelas e meça o que o capital fez.",
    },
    roles: ["partner"],
    persona: { email: "partner@demo.empowerfi.io", name: "Paulo Mendes", role: "partner" },
    home: DESK,
    primary: [
      DESK,
      t({ to: "/app/partner/servicing", icon: CalendarClock, label: { en: "Servicing", pt: "Acompanhamento" },
        what: { en: "Instalments due and recorded.", pt: "Parcelas a vencer e registradas." } }),
      t({ to: "/app/partner/portfolio", icon: PieChart, label: { en: "Portfolio and outcomes", pt: "Carteira e resultados" },
        what: { en: "Loans by state, and outcomes ready to measure.", pt: "Empréstimos por situação, e resultados prontos para medir." } }),
      t({ to: "/app/partner/decisions", icon: FileCheck2, label: { en: "Proofs", pt: "Provas" },
        what: { en: "Decisions, loans and instalments, each anchored on Solana.", pt: "Decisões, empréstimos e parcelas, cada um registrado na Solana." } }),
    ],
    // The engine is in no menu at all. The database allocates when a request
    // opens to investors, so by the time anyone could click a menu item the
    // decision has already been taken — and an explanation offered before the
    // thing it explains reads as a step the product makes you take. It is
    // reached from the money instead: from a position, asking why the
    // opportunity existed. The nine other analytics screens this list used to
    // carry are still routed and no longer offered here.
    secondary: [LOCAL],
  },
  {
    id: "community", icon: Users,
    label: { en: "Community / Program Operator", pt: "Comunidade / Operador do programa" },
    value: { en: "Run the sponsored journey without becoming the analytics customer.", pt: "Conduza a jornada patrocinada sem precisar virar cliente de análise de dados." },
    headline: { en: "Run cohorts, education, check-ins and follow-up.", pt: "Conduza turmas, formação, check-ins e acompanhamento." },
    lead: {
      en: "EmpowerFI turns execution into evidence.",
      pt: "A EmpowerFI transforma a execução em evidência.",
    },
    roles: ["community_leader"],
    persona: { email: "leader@demo.empowerfi.io", name: "Lúcia Santos", role: "community_leader" },
    home: COMMUNITY_HOME,
    primary: [
      t({ to: "/cohorts", community: true, icon: Layers, label: { en: "Cohorts", pt: "Turmas" },
        what: { en: "Each intake, and how far it has come.", pt: "Cada entrada, e até onde chegou." } }),
      t({ to: "/participants", community: true, icon: Users, label: { en: "Participants", pt: "Participantes" },
        what: { en: "Everyone's education, reporting and consent.", pt: "Formação, envio de dados e consentimento de cada uma." } }),
      t({ to: "/participants?stage=joined", community: true, icon: GraduationCap, label: { en: "Education", pt: "Formação" },
        what: { en: "Who has not finished the core modules.", pt: "Quem ainda não concluiu os módulos essenciais." } }),
      t({ to: "/participants?action=checkin_reminder", community: true, icon: CalendarCheck, label: { en: "Check-ins", pt: "Check-ins" },
        what: { en: "Who has not reported this month.", pt: "Quem não informou o mês." } }),
      t({ to: "/readiness", community: true, icon: Gauge, label: { en: "Missing data", pt: "Dados faltantes" },
        what: { en: "What each business still lacks to be assessed.", pt: "O que falta a cada negócio para ser avaliado." } }),
      t({ to: "/participants?action=any", community: true, icon: ClipboardList, label: { en: "Tasks", pt: "Tarefas" },
        what: { en: "The follow-ups waiting on the community.", pt: "Os acompanhamentos que esperam pela comunidade." } }),
    ],
    // No secondary: a leader's work is all inside her community, and the
    // overview is already the button above. Her territory's local economy is
    // hers to read — the row-level policy says so — but it lives inside the
    // engine's area, whose other pages she cannot open, so sending her there
    // would hand her a sidebar of refusals. It belongs on her own overview
    // instead, and is not there yet.
    secondary: [],
  },
  {
    id: "entrepreneur", icon: Store,
    label: { en: "Entrepreneur", pt: "Empreendedora" },
    value: { en: "Build business history, understand readiness, request capital and follow repayments.", pt: "Construa o histórico do negócio, entenda sua prontidão, peça capital e acompanhe os pagamentos." },
    headline: { en: "Build a simple business history.", pt: "Construa um histórico simples do seu negócio." },
    lead: {
      en: "Understand your readiness and access productive-capital opportunities when eligible.",
      pt: "Entenda sua prontidão e acesse oportunidades de capital produtivo quando estiver elegível.",
    },
    roles: ["entrepreneur"],
    persona: { email: "maria@demo.empowerfi.io", name: "Maria Oliveira", role: "entrepreneur" },
    home: MY_BUSINESS,
    primary: [
      MY_BUSINESS,
      t({ to: "/app/check-in", icon: CalendarCheck, label: { en: "Check-ins", pt: "Check-ins" },
        what: { en: "Your month in two minutes.", pt: "Seu mês em dois minutos." } }),
      t({ to: "/app/me#readiness", icon: Gauge, label: { en: "Readiness", pt: "Prontidão" },
        what: { en: "Where you stand, and what is missing.", pt: "Onde você está, e o que falta." } }),
      t({ to: "/app/me#capital", icon: HandCoins, label: { en: "Ask for capital", pt: "Pedir capital" },
        what: { en: "Ask when you are ready, and follow what happens to the request.", pt: "Peça quando estiver pronta, e acompanhe o que acontece com o pedido." } }),
      t({ to: "/app/me/loan", icon: Banknote, label: { en: "My loan", pt: "Meu empréstimo" },
        what: { en: "What you owe, and paying an instalment — in the currency you trade in.", pt: "O que você deve, e pagar uma parcela — na moeda em que você negocia." } }),
      t({ to: "/app/consent", icon: ShieldCheck, label: { en: "Consent", pt: "Consentimento" },
        what: { en: "You decide what your data is used for.", pt: "Você decide para que seus dados são usados." } }),
    ],
    secondary: [],
  },
]);

export const viewById = (id: string | null | undefined) => VIEWS.find((v) => v.id === id);

/** The view an account's role holds. Admins and auditors oversee every view and hold none. */
export const viewOf = (role: Role | undefined) => VIEWS.find((v) => role && v.roles.includes(role));

/** Where a tool opens; a community tool needs the community the leader runs. */
export function toolPath(tool: Tool, communityId?: string | null): string {
  if (!tool.community) return tool.to;
  if (communityId) return `/app/community/${communityId}${tool.to}`;
  return `/app${tool.to ? `?community=${encodeURIComponent(tool.to)}` : ""}`;
}

/** Whether a role opens a platform path: the path's own area decides, as RBAC does. */
export function roleOpensPath(path: string, role: Role | undefined): boolean {
  if (!role) return false;
  if (path.startsWith("/app/capital/economics")) return ["sponsor", "partner", "admin", "auditor"].includes(role);
  const area = areaOf(path.split(/[?#]/)[0]);
  // A path inside no area (/app, /app/start, a single record's proof) is not
  // role-gated: anyone signed in opens it.
  return area ? area.roles.includes(role) : true;
}

/** Whether a role opens a tool. */
export const roleOpens = (tool: Tool, role: Role | undefined) =>
  roleOpensPath(tool.community ? "/app/community" : tool.to, role);

/** A view an account opens without switching: its role holds it, or oversees every tool in it. */
export const opensView = (view: View, role: Role | undefined) =>
  Boolean(role && (view.roles.includes(role) || ((role === "admin" || role === "auditor") && roleOpens(view.home, role))));
