// The words of the investor pages, in both languages, side by side.
//
// /investors and /pt/investidores tell the same story with the same components,
// so a claim changed in one language is changed in the other in the same edit.
// The canonical sentences, the disclaimer and the not-an-offer line come from
// PLAN_SITE.md and are kept word for word. Rules for this copy: no return or
// yield figures, no dates for opening investment, no licence claims, and only
// numbers already sourced in src/content/sources.ts.

export type InvestorLang = "en" | "pt";

export interface InvestorCopy {
  hero: {
    badge: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    ctaWaitlist: string;
    ctaApp: string;
    appNote: string;
    disclaimer: string;
    notOffer: string;
  };
  waitlist: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    institutionalLead: string;
    mailSubject: string;
  };
  thesis: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    invariants: string;
    flow: { label: string; sub?: string; emphasis?: boolean }[];
    flowCaption: string;
    pools: {
      eyebrow: string;
      title: string;
      intro: string;
      items: { name: string; rail: string; desc: string }[];
      herSide: string;
      engine: string;
      whyGlobal: string;
    };
    pillars: { title: string; desc: string }[];
    phases: {
      eyebrow: string;
      title: string;
      items: { when: string; title: string; desc: string }[];
      regulation: string;
      notOffer: string;
    };
    links: {
      prototype: string;
      sources: string;
      more: string;
      morePath: string;
    };
  };
  metrics: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    badge: string;
    noData: string;
    pools: { name: string; rail: string }[];
    tiles: { label: string; hint: string }[];
    noteBefore: string;
    demoLabel: string;
    noteAfter: string;
  };
}

// Exact text (PLAN_SITE.md, "Canonical sentences").
const DISCLAIMER_EN =
  "Prototype of a future regulated P2P productive-credit architecture. Hackathon investments, returns, FX and Pix settlement are simulated; blockchain transactions use test assets on Devnet.";
const NOT_OFFER_EN =
  "Nothing on this site is an offer of securities or of a financial product. Joining a waitlist is a non-binding expression of interest.";
const DISCLAIMER_PT =
  "Protótipo de uma futura arquitetura regulada de crédito produtivo P2P. Investimentos, retornos, câmbio e liquidação via Pix do hackathon são simulados; as transações em blockchain usam ativos de teste na Devnet.";
const NOT_OFFER_PT =
  "Nada neste site é oferta de valores mobiliários ou de produto financeiro. Entrar na lista de espera é uma manifestação de interesse, sem compromisso.";

const en: InvestorCopy = {
  hero: {
    badge: "P2P productive credit · Brazil",
    titleLead: "Productive credit for women-led businesses in Brazil,",
    titleAccent: "in reais or in USDC.",
    subtitle:
      "EmpowerFI is building P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana. Two pools of P2P capital: Brazilian investors in reais, and international and impact investors in USDC on Solana.",
    ctaWaitlist: "Join the Investor Waitlist",
    ctaApp: "App - Devnet",
    appNote: "The whole P2P model runs today as a prototype on Solana devnet.",
    disclaimer: DISCLAIMER_EN,
    notOffer: NOT_OFFER_EN,
  },
  waitlist: {
    eyebrow: "Investor waitlist",
    titleLead: "Follow the P2P model",
    titleAccent: "from the start.",
    subtitle:
      "Tell us which pool interests you and how you'd want to participate. It takes a minute, and commits you to nothing.",
    institutionalLead: "Institutional enquiries can also go straight to",
    mailSubject: "EmpowerFI P2P productive credit",
  },
  thesis: {
    eyebrow: "The thesis",
    titleLead: "From a prepared business to a funded loan,",
    titleAccent: "and back by Pix.",
    subtitle:
      "Communities prepare their members; members report their months; a readiness engine tells each what is missing. A participant who is ready may choose to ask for capital. EmpowerFI qualifies the request, a Capital Allocation Engine chooses the pool, the pool funds it, and EmpowerFI's P2P desk formalises the loan and services it until it is repaid by Pix.",
    invariants:
      "Readiness is not eligibility, and eligibility is not funding. Being ready and not asking is a complete outcome.",
    flow: [
      { label: "Prepare", sub: "Community and readiness engine", emphasis: true },
      { label: "Qualify", sub: "EmpowerFI" },
      { label: "Allocate", sub: "Capital Allocation Engine", emphasis: true },
      { label: "Fund", sub: "Domestic or global pool" },
      { label: "Formalise and service", sub: "P2P desk" },
      { label: "Repay by Pix", sub: "In reais", emphasis: true },
    ],
    flowCaption:
      "A community prepares a business, EmpowerFI qualifies its request, the Capital Allocation Engine chooses a pool, the pool funds the loan, EmpowerFI's P2P desk formalises and services it, and she repays in reais by Pix.",
    pools: {
      eyebrow: "Two pools",
      title: "Where the capital comes from.",
      intro:
        "Two pools of P2P capital: Brazilian investors in reais, and international and impact investors in USDC on Solana.",
      items: [
        {
          name: "Domestic P2P pool",
          rail: "In reais, by Pix",
          desc: "For Brazilian investors. Capital moves in reais, by Pix, from the pool to the business and back.",
        },
        {
          name: "Global P2P pool",
          rail: "In USDC on Solana",
          desc: "For international and impact investors. Capital comes in as USDC on Solana and reaches her in reais; in the prototype, the FX is simulated.",
        },
      ],
      herSide: "She receives and repays in reais, by Pix, whichever pool funds her.",
      engine:
        "A Capital Allocation Engine chooses the pool for each opportunity: first whether a pool can take it (liquidity, risk appetite, ticket, mandate), then which costs her less.",
      whyGlobal:
        "Global capital earns its place by the availability, mandate or economics it adds — not by being on a blockchain.",
    },
    pillars: [
      {
        title: "Proven on Solana, with no personal data",
        desc: "Every step is recorded in a database and proven on Solana, with no personal data on chain. Solana is the proof layer for every loan, whichever pool funds it, and the capital rail only for the global pool.",
      },
      {
        title: "Paid by the cost to serve",
        desc: "EmpowerFI is paid by the cost to serve built into each loan's rate — preparing, originating and servicing small tickets — and by Community Intelligence for programmes and communities.",
      },
      {
        title: "Cost to serve is the number that matters",
        desc: "Measured from the first day of the journey, not from disbursement — acquisition, education, readiness, origination, servicing, collection and outcome. Small tickets fail on operating cost, so that is the cost we instrument.",
      },
      {
        title: "The moat is longitudinal data",
        desc: "Readiness, qualification, funding, repayment and productive outcome, connected for the same business over time. It cannot be bought or back-filled; it only accumulates by being present before the credit request and staying after it.",
      },
    ],
    phases: {
      eyebrow: "Where it stands",
      title: "Three phases, and what is true in each.",
      items: [
        {
          when: "Today",
          title: "A working prototype on Solana devnet",
          desc: "The app runs the whole P2P model as a prototype: both pools, the engine, the desk and repayment by Pix. Investments, returns, FX and Pix are simulated; blockchain transactions use test assets. The Marketplace app is live on Google Play.",
        },
        {
          when: "The pilot",
          title: "A regulated partner's capital",
          desc: "In the pilot, a regulated financial partner provides the capital and makes the credit decision, under its licence and its credit policy. EmpowerFI prepares communities, qualifies requests, follows repayment and measures outcomes. P2P investors do not fund the pilot.",
        },
        {
          when: "P2P",
          title: "Our North Star",
          desc: "After the pilot validates, investors fund qualified opportunities through the two pools, the engine allocates, and EmpowerFI's P2P desk formalises and services each loan — under the applicable regulated structure, such as a SEP (CMN Resolution 5.050).",
        },
      ],
      regulation:
        "The P2P model will operate under the applicable regulated structure; EmpowerFI holds no such licence today.",
      notOffer: NOT_OFFER_EN,
    },
    links: {
      prototype: "Open the prototype (App - Devnet)",
      sources: "Every number, with its source",
      more: "See the full picture on the home page",
      morePath: "/#problem",
    },
  },
  metrics: {
    eyebrow: "Investor metrics",
    titleLead: "What we will report, per pool,",
    titleAccent: "once it is real.",
    badge: "Coming soon",
    noData: "No data yet",
    pools: [
      { name: "Domestic P2P pool", rail: "In reais" },
      { name: "Global P2P pool", rail: "In USDC" },
    ],
    tiles: [
      { label: "Capital Deployed", hint: "Capital placed into productive credit through this pool." },
      { label: "Businesses Funded", hint: "Businesses whose loans this pool funded." },
      { label: "Average Loan", hint: "Typical ticket funded by this pool." },
      { label: "Repayment Rate", hint: "Share of scheduled repayments performed, by Pix." },
      { label: "Capital Repaid", hint: "Capital returned to this pool and available to redeploy." },
      { label: "Investors", hint: "Investors who funded at least one opportunity." },
    ],
    noteBefore:
      "This area becomes the Public Investor Dashboard once the P2P model runs. The pilot is funded with a regulated partner's capital, so pool figures start after it. Until then the tiles carry no figures — and any data shown from a pre-production build will be labelled",
    demoLabel: "Demo / Solana Devnet",
    noteAfter: "on the page itself.",
  },
};

const pt: InvestorCopy = {
  hero: {
    badge: "Crédito produtivo P2P · Brasil",
    titleLead: "Crédito produtivo para negócios de mulheres no Brasil,",
    titleAccent: "em reais ou em USDC.",
    subtitle:
      "A EmpowerFI está construindo crédito produtivo P2P para mulheres empreendedoras no Brasil, da prontidão ao capital, com cada etapa comprovada na Solana. Investidores brasileiros participam pelo pool doméstico, em reais; investidores internacionais e de impacto, pelo pool global, em USDC na Solana.",
    ctaWaitlist: "Entrar na lista de espera",
    ctaApp: "App - Devnet",
    appNote: "Todo o modelo P2P já roda hoje como protótipo na Solana devnet.",
    disclaimer: DISCLAIMER_PT,
    notOffer: NOT_OFFER_PT,
  },
  waitlist: {
    eyebrow: "Lista de espera de investidores",
    titleLead: "Acompanhe o modelo P2P",
    titleAccent: "desde o começo.",
    subtitle:
      "Conte qual pool te interessa e como você gostaria de participar. Leva um minuto e não cria nenhum compromisso.",
    institutionalLead: "Investidores institucionais também podem escrever direto para",
    mailSubject: "Crédito produtivo P2P da EmpowerFI",
  },
  thesis: {
    eyebrow: "A tese",
    titleLead: "Do negócio preparado ao empréstimo captado,",
    titleAccent: "e de volta por Pix.",
    subtitle:
      "Comunidades preparam suas participantes; elas registram seus meses; um motor de prontidão mostra a cada uma o que falta. Quem está pronta pode escolher pedir capital. A EmpowerFI qualifica o pedido, um Motor de Alocação de Capital escolhe o pool, o pool financia, e a mesa P2P da EmpowerFI formaliza o empréstimo e acompanha os pagamentos até a quitação, por Pix.",
    invariants:
      "Prontidão não é elegibilidade, e elegibilidade não é captação. Estar pronta e não pedir crédito é um resultado completo.",
    flow: [
      { label: "Preparar", sub: "Comunidade e motor de prontidão", emphasis: true },
      { label: "Qualificar", sub: "EmpowerFI" },
      { label: "Alocar", sub: "Motor de Alocação de Capital", emphasis: true },
      { label: "Captar", sub: "Pool doméstico ou global" },
      { label: "Formalizar e acompanhar", sub: "Mesa P2P" },
      { label: "Pagar por Pix", sub: "Em reais", emphasis: true },
    ],
    flowCaption:
      "Uma comunidade prepara o negócio, a EmpowerFI qualifica o pedido, o Motor de Alocação de Capital escolhe um pool, o pool financia o empréstimo, a mesa P2P da EmpowerFI formaliza e acompanha, e ela paga em reais, por Pix.",
    pools: {
      eyebrow: "Dois pools",
      title: "De onde vem o capital.",
      intro:
        "Dois pools de capital P2P: investidores brasileiros em reais, e investidores internacionais e de impacto em USDC na Solana.",
      items: [
        {
          name: "Pool P2P doméstico",
          rail: "Em reais, por Pix",
          desc: "Para investidores brasileiros. O capital circula em reais, por Pix, do pool até o negócio e de volta.",
        },
        {
          name: "Pool P2P global",
          rail: "Em USDC na Solana",
          desc: "Para investidores internacionais e de impacto. O capital entra em USDC na Solana e chega a ela em reais; no protótipo, o câmbio é simulado.",
        },
      ],
      herSide: "Ela recebe e paga em reais, por Pix, seja qual for o pool que a financia.",
      engine:
        "Um Motor de Alocação de Capital escolhe o pool de cada oportunidade: primeiro se o pool pode recebê-la (liquidez, apetite a risco, ticket, mandato), depois qual custa menos para ela.",
      whyGlobal:
        "O capital global ganha seu lugar pela disponibilidade, pelo mandato ou pela economia que traz — não por estar em uma blockchain.",
    },
    pillars: [
      {
        title: "Comprovado na Solana, sem dados pessoais",
        desc: "Cada etapa fica registrada em banco de dados e comprovada na Solana, sem nenhum dado pessoal na blockchain. A Solana é a camada de prova de todo empréstimo, seja qual for o pool, e o trilho de capital só do pool global.",
      },
      {
        title: "Remunerada pelo custo de servir",
        desc: "A EmpowerFI é remunerada pelo custo de servir embutido na taxa de cada empréstimo — preparar, originar e acompanhar tickets pequenos — e pela Inteligência Comunitária para programas e comunidades.",
      },
      {
        title: "O custo de servir é o número que importa",
        desc: "Medido desde o primeiro dia da jornada, não a partir do desembolso: aquisição, educação, prontidão, originação, acompanhamento, cobrança e resultado. Ticket pequeno não se sustenta por causa do custo operacional, e é esse custo que medimos.",
      },
      {
        title: "O diferencial são os dados ao longo do tempo",
        desc: "Prontidão, qualificação, captação, pagamento e resultado produtivo, ligados ao mesmo negócio ao longo do tempo. Não dá para comprar nem reconstruir depois; só se acumula estando presente antes do pedido de crédito e continuando depois dele.",
      },
    ],
    phases: {
      eyebrow: "Em que ponto estamos",
      title: "Três fases, e o que vale em cada uma.",
      items: [
        {
          when: "Hoje",
          title: "Um protótipo funcionando na Solana devnet",
          desc: "O app roda todo o modelo P2P como protótipo: os dois pools, o motor, a mesa e o pagamento por Pix. Investimentos, retornos, câmbio e Pix são simulados; as transações em blockchain usam ativos de teste. O app Marketplace está no ar no Google Play.",
        },
        {
          when: "O piloto",
          title: "Capital de um parceiro regulado",
          desc: "No piloto, uma instituição financeira parceira regulada fornece o capital e toma a decisão de crédito, sob a licença e a política de crédito dela. A EmpowerFI prepara as comunidades, qualifica os pedidos, acompanha os pagamentos e mede os resultados. Investidores P2P não financiam o piloto.",
        },
        {
          when: "P2P",
          title: "Nosso norte",
          desc: "Depois que o piloto validar o modelo, investidores financiam oportunidades qualificadas pelos dois pools, o motor aloca, e a mesa P2P da EmpowerFI formaliza e acompanha cada empréstimo — sob a estrutura regulada aplicável, como uma SEP (Resolução CMN 5.050).",
        },
      ],
      regulation:
        "O modelo P2P vai operar sob a estrutura regulada aplicável; hoje a EmpowerFI não tem essa licença.",
      notOffer: NOT_OFFER_PT,
    },
    links: {
      prototype: "Abrir o protótipo (App - Devnet)",
      sources: "As fontes de cada número (em inglês)",
      more: "Conheça a EmpowerFI",
      morePath: "/pt/sobre",
    },
  },
  metrics: {
    eyebrow: "Métricas para investidores",
    titleLead: "O que vamos reportar, por pool,",
    titleAccent: "quando for real.",
    badge: "Em breve",
    noData: "Ainda sem dados",
    pools: [
      { name: "Pool P2P doméstico", rail: "Em reais" },
      { name: "Pool P2P global", rail: "Em USDC" },
    ],
    tiles: [
      { label: "Capital alocado", hint: "Capital direcionado a crédito produtivo por este pool." },
      { label: "Negócios financiados", hint: "Negócios cujos empréstimos este pool financiou." },
      { label: "Empréstimo médio", hint: "Ticket típico financiado por este pool." },
      { label: "Adimplência", hint: "Parcela dos pagamentos previstos que foram realizados, por Pix." },
      { label: "Capital devolvido", hint: "Capital que voltou a este pool e pode ser realocado." },
      { label: "Investidores", hint: "Investidores que financiaram ao menos uma oportunidade." },
    ],
    noteBefore:
      "Esta área vira o Painel Público do Investidor quando o modelo P2P estiver funcionando. O piloto usa capital de uma parceira regulada, então os números por pool começam depois dele. Até lá, nenhum número aparece aqui — e qualquer dado de uma versão de pré-produção vai trazer o rótulo",
    demoLabel: "Demo / Solana Devnet",
    noteAfter: "na própria página.",
  },
};

export const investorCopy: Record<InvestorLang, InvestorCopy> = { en, pt };
