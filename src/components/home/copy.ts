// The home page's words, in both languages, side by side (refactor spec §8–9,
// 16 Sep). One story in seven sections: sponsor evidence → credit intelligence →
// qualified opportunity → capital → repayment → outcome. Each language is
// written whole, not translated word by word.

export type Lang = "en" | "pt";

const en = {
  seo: {
    title: "EmpowerFI — Turn impact programs into investable businesses",
    description:
      "EmpowerFI turns program execution into auditable evidence, credit intelligence and qualified opportunities for productive capital. Built in Brazil, proven on Solana, a working prototype on devnet.",
  },
  hero: {
    badge: "Productive-credit and impact intelligence infrastructure · Brazil first",
    title: "Turn impact programs into",
    accent: "investable businesses.",
    body:
      "EmpowerFI turns program execution into auditable evidence, credit intelligence and qualified opportunities for productive capital.",
    explore: "Explore the platform",
    partner: "Partner with us",
    statusLabel: "Prototype",
    status: [
      "The platform runs today as a working prototype on Solana devnet: the money is simulated, the proofs are real test transactions.",
      "Our first pilot is being prepared in Brazil, with a regulated financial partner's capital.",
    ],
    // The diagram beside the headline: what the platform is made of, and what
    // each of the three sides gets out of it.
    panel: {
      title: "One platform · two intelligences",
      intelligences: [
        { name: "Community intelligence", desc: "Program execution, check-ins and business progress, captured where the entrepreneur already works." },
        { name: "Credit intelligence", desc: "Readiness, affordability and eligibility, computed by versioned engines and measured through repayment." },
      ],
      outputs: [
        { who: "Sponsors", what: "Executive dashboard", future: false },
        { who: "Women SMEs", what: "Productive credit", future: false },
        { who: "Investors", what: "P2P lending", future: true },
      ],
      futureNote: "Dashed: future model, subject to regulation.",
    },
  },
  audiences: {
    eyebrow: "Who it is for",
    title: "One platform, built for",
    accent: "three sides of productive credit.",
    statusLabel: "Status",
    items: [
      {
        number: "01",
        who: "ESG program sponsors",
        title: "Evidence,",
        accent: "not attendance lists.",
        desc: "Companies, foundations and impact funds follow every business in their program through an executive dashboard: progress, readiness and outcomes, per program or cohort.",
        points: ["Executive dashboard by program and cohort", "Auditable impact reporting", "Integration with your ESG data"],
        status: "Demonstrated in the devnet prototype.",
        cta: "Bring your program",
      },
      {
        number: "02",
        who: "Women microentrepreneurs",
        title: "Credit sized to",
        accent: "the business she runs.",
        desc: "The app helps her organise the business and build a track record. When she is ready, she reaches productive credit she can afford — received and repaid in reais, by Pix.",
        points: ["Free app to run the business", "Readiness before the loan request", "Affordability checks, not guesswork"],
        status: "App live in Brazil. Credit in pilot preparation with a regulated partner.",
        // Empty on purpose: her column ends on the two store listings rather
        // than on a link that would pick a phone for her.
        cta: "",
      },
      {
        number: "03",
        who: "Investors",
        title: "Returns from loans",
        accent: "you can audit.",
        desc: "Peer-to-peer productive-credit opportunities matched to your mandate and risk appetite, with repayment, delinquency and outcome states you can verify.",
        points: ["BRL pool for Brazilian investors", "USDC on Solana for global capital", "Proofs on-chain, zero PII"],
        status: "Future model. EmpowerFI holds no lending or P2P licence today; no return is promised.",
        cta: "Join the investor waitlist",
      },
    ],
  },
  problem: {
    eyebrow: "The problem",
    title: "Can productive credit become cheaper to operate",
    accent: "without becoming weaker credit?",
    subtitle:
      "Small-ticket credit is expensive to operate — not because of the borrower, but because of the operating model. EmpowerFI tests a data-driven operating model designed to compress cost to serve while preserving credit discipline, continuous servicing and auditable outcomes.",
    cards: [
      {
        who: "Sponsors",
        title: "Programs struggle to prove business outcomes.",
        desc: "Companies, foundations and impact funds pay for entrepreneurship programs and get attendance lists and testimonials back — not evidence that a business got organised, more resilient or ready for capital.",
      },
      {
        who: "Small businesses",
        title: "Small tickets cost too much to evaluate and serve.",
        desc: "The fixed cost of origination, guidance, servicing and collection weighs most on small loans — and it barely falls as the ticket does.",
      },
      {
        who: "Investors",
        title: "Qualified opportunities with evidence are scarce.",
        desc: "Capital with an impact mandate exists. What is missing are opportunities that arrive qualified, with a longitudinal record of how the business actually runs.",
      },
    ],
    benchmark: {
      label: "Historical benchmark",
      figure: "$14",
      unit: "/ $100",
      lead: "Median operating expense for every US$100 of microfinance loans outstanding.",
      caveat: "International and historical — not EmpowerFI's or Brazil's current cost to serve.",
      source: "Source: World Bank WPS 8252, 2005–2009.",
    },
    measure: {
      note: "A hypothesis, not a result: the prototype measures these variables, and the pilot must show cost falling without weaker credit.",
      headers: ["Must improve", "Must not be sacrificed", "How the platform measures it"],
      rows: [
        ["Cost to serve", "Eligibility discipline", "Cost events by stage and opportunity"],
        ["Time to decision", "Affordability checks", "Engine timestamps and reason codes"],
        ["Operational scalability", "Continuous follow-up", "Digital check-ins and servicing events"],
        ["Capital access", "Portfolio quality", "Repayment, delinquency and outcome states"],
      ],
    },
    sources: "Every number, with its source",
  },
  pilot: {
    eyebrow: "Pilot",
    title: "What the pilot must show:",
    accent: "cost falling without weaker credit.",
  },
  how: {
    eyebrow: "How it works",
    // The figure carries the headline and the summary, so the section does not
    // repeat them in text above it.
    figureAlt:
      "From opportunity to global capital: a six-step loop around EmpowerFI. Sponsors fund programs and set impact goals; communities engage and support entrepreneurs locally; entrepreneurs build their businesses, access capital and grow; each loan, or pool of loans, becomes a programmable asset on Solana; investors provide capital in reais or USDC and can hold or trade their positions; and the result is thriving businesses, stronger communities and a more inclusive economy, whose measured results and verified impact return to the sponsors as evidence.",
    figureSwipe: "Drag the figure sideways, or open it full size.",
    figureOpen: "Open the full figure",
    judgements: [
      { q: "Is the business ready?", a: "Readiness" },
      { q: "For this amount?", a: "Eligibility" },
      { q: "From which pool?", a: "Allocation" },
    ],
    judgementsNote: "Three separate judgements: being ready is not being eligible, and being eligible is not being funded.",
    more: "The full explanation, for investors",
  },
  revenue: {
    eyebrow: "Business model",
    title: "Two revenue engines.",
    accent: "One dataset.",
    engines: [
      {
        name: "Impact Intelligence",
        customer: "Sponsors of ESG, impact and entrepreneurship programs: companies, foundations and impact funds.",
        pays: "Measurement, auditability, reporting and integration, per program or cohort.",
        status: "Demonstrated in the devnet prototype.",
      },
      {
        name: "Credit Infrastructure",
        customer: "In the pilot, the regulated financial partner. In the P2P model, the funded loans.",
        pays: "In the pilot, service fees paid by the partner for qualification, servicing and outcome measurement. In P2P, origination, transaction and servicing economics under the applicable regulated structure.",
        status: "EmpowerFI holds no lending or P2P licence today.",
      },
    ],
    labels: { customer: "Who pays", pays: "For what", status: "Where it stands" },
    keyLine: "The same data that proves impact helps qualify capital.",
    communities:
      "Communities are distribution, education and execution partners: they run the programs, and they are not the paying customer.",
  },
  capital: {
    eyebrow: "Capital",
    title: "Two routes to capital,",
    accent: "chosen per opportunity.",
    routes: [
      {
        name: "Domestic",
        steps: [{ label: "Brazilian investors" }, { label: "BRL pool", sub: "in reais" }, { label: "Pix" }, { label: "Business", emphasis: true }],
        caption: "Domestic capital: Brazilian investors fund a pool in reais that reaches the business by Pix.",
      },
      {
        name: "Global / impact",
        steps: [{ label: "Global and impact investors" }, { label: "USDC", sub: "on Solana" }, { label: "Regulated off-ramp" }, { label: "Pix" }, { label: "Business", emphasis: true }],
        caption: "Global capital: international and impact investors fund in USDC on Solana, converted by a regulated off-ramp and paid to the business by Pix.",
      },
    ],
    callout:
      "Global capital competes on availability, mandate, risk appetite and economics. Blockchain is not cheaper by default: the Capital Allocation Engine picks the route that can fund each opportunity sustainably.",
    herSide: "Either way, she receives and repays in reais, by Pix.",
    solana: "Solana is the global capital rail and the proof layer. Her financial life stays off-chain.",
  },
  audit: {
    eyebrow: "Auditability",
    title: "Evidence without",
    accent: "financial surveillance.",
    layers: [
      { name: "Private business data", desc: "Identity, documents, Pix details, revenue, costs and check-ins. Never leaves the private layer." },
      { name: "Derived intelligence", desc: "Readiness, risk, affordability, data quality and outcomes, computed by versioned engines." },
      { name: "Cryptographic proof", desc: "Hash commitments and lifecycle states on Solana. Anyone can verify; no one can read her life." },
    ],
  },
  traction: {
    eyebrow: "Traction",
    title: "What is real",
    accent: "today.",
    items: [
      { tag: "Live", title: "The app is live in Brazil", desc: "Published on Google Play and the App Store: where the entrepreneur runs her business and the evidence begins." },
      { tag: "Devnet", title: "The platform runs end to end on devnet", desc: "Impact Intelligence, the Credit & Capital Engine and the Investor Console. Investments, returns, FX and Pix are simulated; blockchain transactions use test assets.", link: "Open App - Devnet" },
      { tag: "Institutional support", title: "Built and refined with Sebrae", desc: "Ginga Prototipa produced the working prototype; PIER refines the business model with specialist consulting." },
      { tag: "São Paulo", title: "An operating company in Brazil", desc: "Incorporated in São Paulo, with its team, product and first market in Brazil." },
    ],
    pilotLabel: "Pilot · next",
    pilot:
      "Pilot status: in preparation in Brazil, with a regulated financial partner's capital. No pilot results exist yet, and none are shown here.",
    fit: "Where do you fit?",
    ctas: [
      { id: "sponsor", label: "I fund impact programs", desc: "Turn your program into auditable evidence and measurable business progress." },
      { id: "capital", label: "I deploy capital", desc: "Qualified opportunities matched to your mandate and risk appetite." },
      { id: "community", label: "I support entrepreneurs", desc: "Run programs with the tools that turn execution into evidence." },
    ],
    entrepreneur: "Running a business yourself? The app is free on Google Play and the App Store.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Partner with",
    accent: "EmpowerFI.",
    subtitle: "Tell us about your program, your capital or the entrepreneurs you support. We answer every message.",
    interest: "I am writing as",
    interests: { sponsor: "A program sponsor", capital: "An investor", community: "A community or program operator", other: "Something else" },
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@organization.com",
    message: "Message",
    messagePlaceholder: "What would you like to build with us?",
    send: "Send message",
    sending: "Sending…",
    orWrite: "or write to",
    sent: { title: "Message sent!", desc: "We'll reply shortly." },
    failed: { title: "Could not send", desc: "Please try again in a moment." },
    invalid: "Check the fields",
    errors: { name: "Enter your name", email: "Invalid email", short: "Message too short", long: "Max 2000 characters" },
  },
};

const pt: typeof en = {
  seo: {
    title: "EmpowerFI — Transforme programas de impacto em negócios investíveis",
    description:
      "A EmpowerFI transforma a execução de programas em evidência auditável, inteligência de crédito e oportunidades qualificadas para capital produtivo. Feita no Brasil, comprovada na Solana, com protótipo funcionando na devnet.",
  },
  hero: {
    badge: "Infraestrutura de crédito produtivo e inteligência de impacto · Brasil primeiro",
    title: "Transforme programas de impacto em",
    accent: "negócios investíveis.",
    body:
      "A EmpowerFI transforma a execução de programas em evidência auditável, inteligência de crédito e oportunidades qualificadas para capital produtivo.",
    explore: "Explore a plataforma",
    partner: "Seja parceiro",
    statusLabel: "Protótipo",
    status: [
      "A plataforma roda hoje como protótipo na devnet da Solana: o dinheiro é simulado, e as provas são transações de teste reais.",
      "Nosso primeiro piloto está em preparação no Brasil, com capital de uma instituição financeira parceira regulada.",
    ],
    panel: {
      title: "Uma plataforma · duas inteligências",
      intelligences: [
        { name: "Inteligência de comunidade", desc: "Execução dos programas, check-ins e progresso do negócio, captados onde a empreendedora já trabalha." },
        { name: "Inteligência de crédito", desc: "Prontidão, capacidade de pagamento e elegibilidade, calculadas por motores versionados e medidas pelo pagamento." },
      ],
      outputs: [
        { who: "Patrocinadores", what: "Painel executivo", future: false },
        { who: "Pequenos negócios", what: "Crédito produtivo", future: false },
        { who: "Investidores", what: "Crédito P2P", future: true },
      ],
      futureNote: "Tracejado: modelo futuro, sujeito à regulação.",
    },
  },
  audiences: {
    eyebrow: "Para quem é",
    title: "Uma plataforma, feita para",
    accent: "os três lados do crédito produtivo.",
    statusLabel: "Situação",
    items: [
      {
        number: "01",
        who: "Patrocinadores de programas ESG",
        title: "Evidência,",
        accent: "não lista de presença.",
        desc: "Empresas, fundações e fundos de impacto acompanham cada negócio do seu programa por um painel executivo: progresso, prontidão e resultados, por programa ou turma.",
        points: ["Painel executivo por programa e turma", "Relatórios de impacto auditáveis", "Integração com os seus dados de ESG"],
        status: "Demonstrado no protótipo na devnet.",
        cta: "Traga o seu programa",
      },
      {
        number: "02",
        who: "Mulheres empreendedoras",
        title: "Crédito no tamanho",
        accent: "do negócio que ela toca.",
        desc: "O app ajuda a organizar o negócio e a construir histórico. Quando ela está pronta, alcança um crédito produtivo que cabe no bolso — recebido e pago em reais, por Pix.",
        points: ["App gratuito para tocar o negócio", "Prontidão antes do pedido de crédito", "Capacidade de pagamento verificada, não estimada"],
        status: "App no ar no Brasil. Crédito em preparação de piloto com parceiro regulado.",
        cta: "",
      },
      {
        number: "03",
        who: "Investidores",
        title: "Retorno de empréstimos",
        accent: "que você consegue auditar.",
        desc: "Oportunidades de crédito produtivo entre pares, compatíveis com o seu mandato e apetite a risco, com estados de pagamento, atraso e resultado que você verifica.",
        points: ["Pool em reais para investidores brasileiros", "USDC na Solana para capital global", "Provas on-chain, zero dado pessoal"],
        status: "Modelo futuro. Hoje a EmpowerFI não tem licença de crédito nem de P2P; nenhum retorno é prometido.",
        cta: "Entrar na lista de investidores",
      },
    ],
  },
  problem: {
    eyebrow: "O problema",
    title: "O crédito produtivo pode ficar mais barato de operar",
    accent: "sem virar um crédito pior?",
    subtitle:
      "Crédito de ticket pequeno custa caro para operar — não por causa de quem toma, mas do modelo de operação. A EmpowerFI testa um modelo operacional baseado em dados, desenhado para reduzir o custo de servir preservando a disciplina de crédito, o acompanhamento contínuo e resultados auditáveis.",
    cards: [
      {
        who: "Patrocinadores",
        title: "Programas têm dificuldade de provar resultados nos negócios.",
        desc: "Empresas, fundações e fundos de impacto pagam por programas de empreendedorismo e recebem listas de presença e depoimentos — não a evidência de que um negócio se organizou, ficou mais resiliente ou pronto para capital.",
      },
      {
        who: "Pequenos negócios",
        title: "Tickets pequenos custam caro para avaliar e atender.",
        desc: "O custo fixo de originação, orientação, acompanhamento e cobrança pesa mais nos empréstimos pequenos — e quase não cai quando o ticket cai.",
      },
      {
        who: "Investidores",
        title: "Faltam oportunidades qualificadas com evidência.",
        desc: "Existe capital com mandato de impacto. O que falta são oportunidades que cheguem qualificadas, com um histórico longitudinal de como o negócio realmente funciona.",
      },
    ],
    benchmark: {
      label: "Referência histórica",
      figure: "US$ 14",
      unit: "/ US$ 100",
      lead: "Mediana da despesa operacional a cada US$ 100 de carteira em microfinanças.",
      caveat: "Referência internacional e histórica — não é o custo de servir da EmpowerFI nem o do Brasil hoje.",
      source: "Fonte: Banco Mundial WPS 8252, 2005–2009.",
    },
    measure: {
      note: "Uma hipótese, não um resultado: o protótipo mede estas variáveis, e o piloto precisa mostrar o custo caindo sem piorar o crédito.",
      headers: ["Precisa melhorar", "Não pode ser sacrificado", "Como a plataforma mede"],
      rows: [
        ["Custo de servir", "Disciplina de elegibilidade", "Eventos de custo por etapa e oportunidade"],
        ["Tempo até a decisão", "Checagem de capacidade de pagamento", "Horários dos motores e códigos de motivo"],
        ["Escalabilidade operacional", "Acompanhamento contínuo", "Check-ins digitais e eventos de acompanhamento"],
        ["Acesso a capital", "Qualidade da carteira", "Estados de pagamento, atraso e resultado"],
      ],
    },
    sources: "Cada número, com a sua fonte",
  },
  pilot: {
    eyebrow: "Piloto",
    title: "O que o piloto precisa mostrar:",
    accent: "custo caindo sem piorar o crédito.",
  },
  how: {
    eyebrow: "Como funciona",
    // Não há mais o aviso de que a figura está em inglês: agora ela tem versão
    // em português, e a legenda que descrevia a figura antiga saiu com ela.
    figureAlt:
      "Da oportunidade ao capital global: um ciclo de seis etapas em torno da EmpowerFI. Patrocinadores financiam programas e definem metas de impacto; comunidades engajam e apoiam empreendedoras locais; as empreendedoras desenvolvem seus negócios, acessam capital e geram renda; cada empréstimo, ou carteira, se torna um ativo programável na Solana; investidores fornecem capital em reais ou USDC e podem manter ou negociar suas posições; e o resultado são negócios mais fortes, comunidades mais resilientes e uma economia mais inclusiva, cujos resultados mensuráveis e impacto verificado voltam aos patrocinadores como evidência.",
    figureSwipe: "Arraste a figura para o lado, ou abra em tamanho cheio.",
    figureOpen: "Abrir a figura inteira",
    judgements: [
      { q: "O negócio está pronto?", a: "Prontidão" },
      { q: "Para este valor?", a: "Elegibilidade" },
      { q: "De qual pool?", a: "Alocação" },
    ],
    judgementsNote: "Três julgamentos separados: estar pronta não é ser elegível, e ser elegível não é ter captado.",
    more: "A explicação completa, para investidores",
  },
  revenue: {
    eyebrow: "Modelo de negócio",
    title: "Duas fontes de receita.",
    accent: "Uma só base de dados.",
    engines: [
      {
        name: "Inteligência de Impacto",
        customer: "Patrocinadores de programas ESG, de impacto e de empreendedorismo: empresas, fundações e fundos de impacto.",
        pays: "Medição, auditabilidade, relatórios e integração, por programa ou turma.",
        status: "Demonstrada no protótipo na devnet.",
      },
      {
        name: "Infraestrutura de Crédito",
        customer: "No piloto, a instituição financeira parceira regulada. No modelo P2P, os empréstimos financiados.",
        pays: "No piloto, taxas de serviço pagas pelo parceiro pela qualificação, pelo acompanhamento e pela medição de resultados. No P2P, a economia de originação, transação e acompanhamento, sob a estrutura regulada aplicável.",
        status: "Hoje a EmpowerFI não tem licença de crédito nem de P2P.",
      },
    ],
    labels: { customer: "Quem paga", pays: "Pelo quê", status: "Em que pé está" },
    keyLine: "Os mesmos dados que provam o impacto ajudam a qualificar o capital.",
    communities:
      "As comunidades são parceiras de distribuição, formação e execução: elas conduzem os programas e não são o cliente pagante.",
  },
  capital: {
    eyebrow: "Capital",
    title: "Duas rotas de capital,",
    accent: "escolhidas por oportunidade.",
    routes: [
      {
        name: "Doméstica",
        steps: [{ label: "Investidores brasileiros" }, { label: "Pool em reais", sub: "BRL" }, { label: "Pix" }, { label: "Negócio", emphasis: true }],
        caption: "Capital doméstico: investidores brasileiros financiam um pool em reais que chega ao negócio por Pix.",
      },
      {
        name: "Global / impacto",
        steps: [{ label: "Investidores globais e de impacto" }, { label: "USDC", sub: "na Solana" }, { label: "Off-ramp regulado" }, { label: "Pix" }, { label: "Negócio", emphasis: true }],
        caption: "Capital global: investidores internacionais e de impacto financiam em USDC na Solana, convertido por um off-ramp regulado e pago ao negócio por Pix.",
      },
    ],
    callout:
      "O capital global compete por disponibilidade, mandato, apetite a risco e economia. Blockchain não é mais barata por definição: o Motor de Alocação de Capital escolhe a rota que consegue financiar cada oportunidade de forma sustentável.",
    herSide: "Nas duas rotas, ela recebe e paga em reais, por Pix.",
    solana: "A Solana é o trilho do capital global e a camada de prova. A vida financeira dela fica fora da blockchain.",
  },
  audit: {
    eyebrow: "Auditabilidade",
    title: "Evidência sem",
    accent: "vigilância financeira.",
    layers: [
      { name: "Dados privados do negócio", desc: "Identidade, documentos, dados de Pix, faturamento, custos e check-ins. Nunca saem da camada privada." },
      { name: "Inteligência derivada", desc: "Prontidão, risco, capacidade de pagamento, qualidade dos dados e resultados, calculados por motores versionados." },
      { name: "Prova criptográfica", desc: "Compromissos em hash e estados do ciclo de vida na Solana. Qualquer pessoa verifica; ninguém lê a vida dela." },
    ],
  },
  traction: {
    eyebrow: "Tração",
    title: "O que já é",
    accent: "real hoje.",
    items: [
      { tag: "No ar", title: "O app está no ar no Brasil", desc: "Publicado no Google Play e na App Store: onde a empreendedora organiza o negócio e a evidência começa." },
      { tag: "Devnet", title: "A plataforma roda de ponta a ponta na devnet", desc: "Inteligência de Impacto, Motor de Crédito e Capital e Console do Investidor. Investimentos, retornos, câmbio e Pix são simulados; as transações em blockchain usam ativos de teste.", link: "Abrir App - Devnet" },
      { tag: "Apoio institucional", title: "Construída e refinada com o Sebrae", desc: "O Ginga Prototipa gerou o protótipo funcional; o PIER refina o modelo de negócio com consultoria especializada." },
      { tag: "São Paulo", title: "Uma empresa brasileira em operação", desc: "Constituída em São Paulo, com equipe, produto e primeiro mercado no Brasil." },
    ],
    pilotLabel: "Piloto · a seguir",
    pilot:
      "Situação do piloto: em preparação no Brasil, com capital de uma instituição financeira parceira regulada. Ainda não há resultados de piloto, e nenhum é mostrado aqui.",
    fit: "Onde você se encaixa?",
    ctas: [
      { id: "sponsor", label: "Financio programas de impacto", desc: "Transforme seu programa em evidência auditável e progresso mensurável dos negócios." },
      { id: "capital", label: "Invisto capital", desc: "Oportunidades qualificadas, compatíveis com seu mandato e apetite a risco." },
      { id: "community", label: "Apoio empreendedoras", desc: "Conduza programas com ferramentas que transformam execução em evidência." },
    ],
    entrepreneur: "Você tem um negócio? Conheça o app da EmpowerFI para empreendedoras.",
  },
  contact: {
    eyebrow: "Contato",
    title: "Seja parceiro da",
    accent: "EmpowerFI.",
    subtitle: "Conte sobre o seu programa, o seu capital ou as empreendedoras que você apoia. Respondemos todas as mensagens.",
    interest: "Escrevo como",
    interests: { sponsor: "Patrocinador de programa", capital: "Investidor", community: "Comunidade ou operador de programa", other: "Outro assunto" },
    name: "Nome",
    namePlaceholder: "Seu nome",
    email: "E-mail",
    emailPlaceholder: "voce@organizacao.com",
    message: "Mensagem",
    messagePlaceholder: "O que você gostaria de construir com a gente?",
    send: "Enviar mensagem",
    sending: "Enviando…",
    orWrite: "ou escreva para",
    sent: { title: "Mensagem enviada!", desc: "Respondemos em breve." },
    failed: { title: "Não foi possível enviar", desc: "Tente de novo em instantes." },
    invalid: "Verifique os campos",
    errors: { name: "Informe seu nome", email: "E-mail inválido", short: "Mensagem muito curta", long: "Máximo de 2000 caracteres" },
  },
};

export const HOME = { en, pt };
export type HomeCopy = typeof en;

/** Paths that differ by language. */
export const PATHS = {
  en: { home: "/", investors: "/investors", sources: "/sources", entrepreneurs: "/pt/empreendedoras", readiness: "/investors#readiness" },
  pt: { home: "/pt", investors: "/pt/investidores", sources: "/sources", entrepreneurs: "/pt/empreendedoras", readiness: "/pt/investidores#thesis" },
} as const;
