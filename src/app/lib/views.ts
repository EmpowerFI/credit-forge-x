import {
  ArrowLeftRight, BarChart3, Briefcase, CalendarCheck, CalendarClock, ClipboardList, Coins, FileCheck2, FileText, Filter,
  Gauge, GraduationCap, HandCoins, History, Layers, ListChecks, PieChart, Route as RouteIcon, ShieldCheck, SlidersHorizontal,
  Split, Sprout, Store, TrendingUp, Users, Wallet, type LucideIcon,
} from "lucide-react";
import { localized } from "../i18n";
import type { Role } from "./platform";
import { areaOf } from "./stories";

// "View platform as" (refactor spec §3A, 17 Sep). Five views, each with its
// value, its tools and a demo account. A view is a lens, not a permission: the
// routes stay behind RBAC, and an account only opens a view its role holds —
// except demo accounts, which switch to the view's demo persona.

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
const ENGINE = t({ to: "/app/capital", icon: Split,
  label: { en: "Credit & Capital Engine", pt: "Motor de Crédito e Capital" },
  what: { en: "Qualify an opportunity, then route it to the pool that can fund it.", pt: "Qualifique uma oportunidade e depois encaminhe-a ao pool que pode financiá-la." } });
const ECONOMICS = t({ to: "/app/capital/economics", icon: BarChart3,
  label: { en: "Operating economics", pt: "Economia operacional" },
  what: { en: "Cost to serve, time to decision, follow-up and portfolio quality, side by side.", pt: "Custo de servir, tempo até a decisão, acompanhamento e qualidade da carteira, lado a lado." } });
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
    secondary: [ENGINE, ECONOMICS],
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
      t({ to: "/app/investor/opportunities", icon: SlidersHorizontal, label: { en: "Mandate filters", pt: "Filtros do mandato" },
        what: { en: "Geography, purpose, ticket, risk appetite and impact mandate.", pt: "Território, finalidade, ticket, apetite a risco e mandato de impacto." } }),
      t({ to: "/app/investor/portfolio", icon: PieChart, label: { en: "Portfolio and positions", pt: "Carteira e posições" },
        what: { en: "Funded, outstanding, repaid and the outcome of each.", pt: "Captado, em aberto, pago e o resultado de cada uma." } }),
      t({ to: "/app/investor/settlement", icon: ArrowLeftRight, label: { en: "Payments", pt: "Pagamentos" },
        what: { en: "USDC in and out, the simulated off-ramp and Pix.", pt: "Entrada e saída de USDC, a conversão e o Pix simulados." } }),
      t({ to: "/app/investor/audit", icon: ShieldCheck, label: { en: "Proofs", pt: "Provas" },
        what: { en: "Your allocations and their loans, on Solana.", pt: "Suas alocações e os empréstimos delas, na Solana." } }),
    ],
    secondary: [ENGINE],
  },
  {
    id: "operator", icon: Split,
    label: { en: "Credit / Capital Operator", pt: "Operador de crédito / capital" },
    value: { en: "Qualify opportunities, route feasible capital and measure operating economics.", pt: "Qualifique oportunidades, encaminhe o capital viável e meça a economia da operação." },
    headline: { en: "Qualify opportunities, compare capital pools.", pt: "Qualifique oportunidades, compare pools de capital." },
    lead: {
      en: "And measure the cost of serving small-ticket productive credit.",
      pt: "E meça o custo de servir crédito produtivo de ticket pequeno.",
    },
    roles: ["partner"],
    persona: { email: "partner@demo.empowerfi.io", name: "Paulo Mendes", role: "partner" },
    home: ENGINE,
    primary: [
      t({ ...ENGINE, label: { en: "Credit Engine", pt: "Motor de crédito" },
        what: { en: "Readiness, affordability, risk and eligibility, run live.", pt: "Prontidão, capacidade de pagamento, risco e elegibilidade, rodados ao vivo." } }),
      t({ to: "/app/capital", icon: RouteIcon, label: { en: "Capital allocation", pt: "Alocação de capital" },
        what: { en: "Domestic or global, on liquidity, ticket, risk appetite, mandate and economics.", pt: "Doméstico ou global, por liquidez, ticket, apetite a risco, mandato e economia." } }),
      t({ to: "/app/capital#replay", icon: History, label: { en: "Portfolio replay", pt: "Replay da carteira" },
        what: { en: "The whole demand, re-run through the engine.", pt: "Toda a demanda, rodada de novo pelo motor." } }),
      t({ to: "/app/capital#assumptions", icon: SlidersHorizontal, label: { en: "Pool assumptions", pt: "Premissas dos pools" },
        what: { en: "Liquidity, tickets, returns, FX and ramp costs.", pt: "Liquidez, tickets, retornos, câmbio e custos de conversão." } }),
      t({ to: "/app/capital/economics#cost", icon: BarChart3, label: { en: "Cost to serve", pt: "Custo de servir" },
        what: { en: "What each stage costs, for every R$ 100 lent.", pt: "Quanto custa cada etapa, a cada R$ 100 emprestados." } }),
      t({ to: "/app/capital/economics#discipline", icon: ListChecks, label: { en: "Reason codes", pt: "Códigos de motivo" },
        what: { en: "Why the engines decided what they decided.", pt: "Por que os motores decidiram o que decidiram." } }),
      t({ to: "/app/partner/decisions", icon: FileCheck2, label: { en: "Proofs", pt: "Provas" },
        what: { en: "Decisions, loans and instalments, each anchored on Solana.", pt: "Decisões, empréstimos e parcelas, cada um registrado na Solana." } }),
    ],
    secondary: [
      t({ to: "/app/partner", icon: Briefcase, label: { en: "P2P desk", pt: "Mesa P2P" },
        what: { en: "Formalise and disburse (simulated Pix).", pt: "Formalizar e desembolsar (Pix simulado)." } }),
      t({ to: "/app/partner/servicing", icon: CalendarClock, label: { en: "Servicing", pt: "Acompanhamento de pagamentos" },
        what: { en: "Instalments due and recorded.", pt: "Parcelas a vencer e registradas." } }),
      t({ to: "/app/partner/portfolio", icon: PieChart, label: { en: "Portfolio and outcomes", pt: "Carteira e resultados" },
        what: { en: "Loans by state, and outcomes ready to measure.", pt: "Empréstimos por situação, e resultados prontos para medir." } }),
    ],
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
    secondary: [COMMUNITY_HOME],
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
      t({ to: "/app/me#capital", icon: HandCoins, label: { en: "Credit intent", pt: "Pedido de crédito" },
        what: { en: "Ask for capital when you are ready.", pt: "Peça capital quando estiver pronta." } }),
      t({ to: "/app/me#capital", icon: CalendarClock, label: { en: "Loan and payments", pt: "Empréstimo e pagamentos" },
        what: { en: "Your instalments, paid by Pix.", pt: "Suas parcelas, pagas por Pix." } }),
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

/** Whether a role opens a tool: the route's own area decides, as RBAC does. */
export function roleOpens(tool: Tool, role: Role | undefined): boolean {
  if (!role) return false;
  if (tool.to.startsWith("/app/capital/economics")) return ["sponsor", "partner", "admin", "auditor"].includes(role);
  const area = areaOf(tool.community ? "/app/community" : tool.to.split(/[?#]/)[0]);
  return Boolean(area?.roles.includes(role));
}

/** A view an account opens without switching: its role holds it, or oversees every tool in it. */
export const opensView = (view: View, role: Role | undefined) =>
  Boolean(role && (view.roles.includes(role) || ((role === "admin" || role === "auditor") && roleOpens(view.home, role))));
