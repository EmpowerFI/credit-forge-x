// The home page's words, in both languages, side by side.
//
// One story from hero to footer: productive demand → capital intelligence →
// capital allocation → local and domestic capital → a qualified external gap →
// global capital → the local productive economy → servicing and outcomes.
// Each language is written whole, not translated word by word.
//
// The rule that keeps this page honest is the same one the product follows: a
// claim and where it stands travel together. Anything that is a hypothesis says
// so, anything that is future says so, and a figure this company did not
// measure carries the name of whoever did.

export type Lang = "en" | "pt";

const en = {
  seo: {
    title: "EmpowerFI — Global capital. Local circulation. Measurable prosperity.",
    description:
      "EmpowerFI is building the capital infrastructure that connects productive businesses to local, domestic and global capital — local capital first, global capital where it adds capacity. Brazil first.",
  },
  hero: {
    badge: "Capital infrastructure · Brazil first",
    title: "Global capital. Local circulation.",
    accent: "Measurable prosperity.",
    body:
      "EmpowerFI is building the infrastructure that connects productive businesses to the capital they need — using local and domestic capital first, and unlocking additional global capital where qualified demand remains underserved.",
    explore: "Explore the platform",
    partner: "Partner with us",
    note: "Brazil first. Built for local productive economies.",
    statusLabel: "Prototype",
    status: [
      "The EmpowerFI capital infrastructure is being tested through a working prototype on Solana devnet. Capital allocation, investor flows and global-to-local settlement are prototype simulations, and blockchain transactions use test assets.",
      "Our first real-world pilot is being prepared in Brazil, to validate business readiness, productive capital needs, servicing economics and outcomes.",
    ],
    // The architecture, in four layers. EmpowerFI is the layer between the
    // capital and the economy — not a rail that has to own the ones below it.
    stack: {
      title: "The architecture",
      layers: [
        { name: "Global capital", sub: "Impact · Institutional · Development", emphasis: false },
        { name: "EmpowerFI", sub: "Capital intelligence + orchestration", emphasis: true },
        { name: "Local capital rails", sub: "Community · Regional · Domestic", emphasis: false },
        { name: "Local economy", sub: "Entrepreneurs · Suppliers · Merchants", emphasis: false },
      ],
      note: "Capital moves down; repayment, evidence and outcomes move back up.",
    },
  },
  engines: {
    eyebrow: "One platform · four capital engines",
    title: "Understand the business, find the capital,",
    accent: "route it, and measure what happened.",
    subtitle:
      "Four engines over one dataset. Each answers a different question, and none of them stands in for another: knowing a business is ready says nothing about which capital can reach it, and deploying capital says nothing about what it did.",
    items: [
      {
        number: "01",
        name: "Capital intelligence",
        lead: "Understand the business before capital is deployed.",
        points: ["Readiness", "Productive capital need", "Affordability", "Business behaviour", "Longitudinal evidence"],
      },
      {
        number: "02",
        name: "Capital allocation",
        lead: "Find the best-fit source of capital.",
        points: ["Local capital", "Regional products", "Productive credit", "Sponsored capital", "Domestic capital", "Global capital where eligible"],
      },
      {
        number: "03",
        name: "Capital orchestration",
        lead: "Route capital through the appropriate infrastructure.",
        points: ["Capital providers", "Regulated financial partners", "Local economic rails", "BRL / Pix", "Future global settlement"],
      },
      {
        number: "04",
        name: "Impact intelligence",
        lead: "Measure what happens after capital is deployed.",
        points: ["Capital deployed", "Repayment", "Business progress", "Productive outcomes", "Local circulation where applicable", "Evidence quality"],
      },
    ],
    flowLabel: "The loop the four engines run",
    flow: ["Observe", "Qualify", "Allocate", "Route", "Service", "Measure"],
  },
  problem: {
    eyebrow: "The problem",
    title: "Capital exists. Productive demand exists.",
    accent: "The connection is broken.",
    subtitle:
      "Small productive businesses often need relatively small amounts of capital. Capital providers operate through larger mandates, different eligibility rules and fragmented distribution channels. The challenge is not creating another loan.",
    qualifiesLabel: "What productive demand has to become",
    qualifies: [
      { word: "Qualified", desc: "Assessed against readiness, capital need and what the business can actually afford." },
      { word: "Routable", desc: "Matched to an instrument whose mandate, ticket and eligibility it actually fits." },
      { word: "Serviceable", desc: "Followed after disbursement, with repayment and behaviour recorded rather than assumed." },
      { word: "Measurable", desc: "Outcomes observed from the months a business reports anyway, with their evidence quality stated." },
      { word: "Investable", desc: "Eventually: aggregated into exposure a capital provider can evaluate.", future: true },
    ],
    futureNote: "The last of the five is where this is going, not where it is.",
    benchmark: {
      label: "Why the small ticket is the hard part",
      figure: "$14",
      unit: "/ $100",
      lead: "Median operating expense for every US$100 of microfinance loans outstanding.",
      caveat: "International and historical — not EmpowerFI's or Brazil's current cost to serve.",
      source: "Source: World Bank WPS 8252, 2005–2009.",
    },
    brazil: {
      label: "Brazil, where this starts",
      items: [
        { figure: "2.6%", desc: "of women-owned micro and small enterprises access formal loans, against 4.6% of men-owned ones in the same study." },
        { figure: "US$15.8B", desc: "estimated financing gap for women-owned micro and small enterprises in Brazil." },
      ],
      source: "Source: IFC + Sicredi, 2025.",
    },
    sources: "Every number, with its source",
  },
  pilot: {
    eyebrow: "Operating hypothesis",
    title: "Can productive credit become cheaper to operate",
    accent: "without becoming weaker credit?",
    subtitle:
      "This is not the company-level problem, and it is still the question the pilot has to answer. The prototype measures these variables; the pilot must show the cost falling without the credit weakening.",
    measure: {
      note: "A hypothesis, not a result.",
      headers: ["Must improve", "Must not be sacrificed", "How the platform measures it"],
      rows: [
        ["Cost to serve", "Eligibility discipline", "Cost events by stage and opportunity"],
        ["Time to decision", "Affordability checks", "Engine timestamps and reason codes"],
        ["Operational scalability", "Continuous follow-up", "Digital check-ins and servicing events"],
        ["Capital access", "Portfolio quality", "Repayment, delinquency and outcome states"],
      ],
    },
  },
  how: {
    eyebrow: "How it works",
    title: "From a productive need",
    accent: "to capital that can be serviced and measured.",
    steps: [
      { number: "01", name: "Productive demand", desc: "A business identifies a productive capital need: equipment, inventory, raw materials, working capital, productive services." },
      { number: "02", name: "Business readiness", desc: "EmpowerFI evaluates whether the business is ready — from months it reports anyway, not from a form filled in on the day of the request." },
      { number: "03", name: "Capital need", desc: "How much, for what, what the business can afford, and where the capital will be spent." },
      { number: "04", name: "Capital engine", desc: "The available sources of capital are evaluated against this specific need: liquidity, ticket, mandate, eligibility and cost." },
      { number: "05", name: "Local capital first", desc: "Community and municipal capital, regional products, productive microcredit, commercial credit, sponsored capital and domestic investors are considered before anything from outside." },
      { number: "06", name: "External capital gap", desc: "Qualified productive demand, less local and domestic capital coverage, is the potential external capital gap." },
      { number: "07", name: "Global eligibility", desc: "The gap is evaluated separately. A funding gap does not automatically make an opportunity eligible for global capital." },
      { number: "08", name: "Deploy, service, measure", desc: "Capital is deployed through the appropriate regulated infrastructure, and EmpowerFI tracks servicing, repayment and outcomes." },
    ],
    judgements: [
      { q: "Is the business ready?", a: "Readiness" },
      { q: "Is this capital amount sustainable?", a: "Eligibility" },
      { q: "Which capital source is the best fit?", a: "Allocation" },
    ],
    judgementsNote: "Three separate decisions. Being ready is not being eligible, and being eligible is not being funded.",
    more: "The full explanation, for capital providers",
  },
  network: {
    eyebrow: "Capital network",
    title: "One productive need.",
    accent: "Multiple possible sources of capital.",
    subtitle:
      "EmpowerFI does not create a loan every time a business needs capital. It identifies the best-fit productive-capital instrument — and can combine sources when appropriate.",
    needLabel: "Productive capital need",
    engineLabel: "Capital engine",
    sourcesLabel: "What it can route to",
    sources: [
      "Local / community capital",
      "Regional financial products",
      "Productive microcredit",
      "Commercial credit",
      "Sponsored capital",
      "Domestic investors",
      "Global impact capital",
    ],
    outcomeLabel: "What comes out",
    outcomes: ["Best-fit capital", "or a blended capital route"],
    callout:
      "A route the engine refuses is as much an answer as one it recommends, and it says which check the request did not pass: a ticket above a product's limit, a state a route does not serve, a mandate it falls outside. A refusal a person can check beats one she has to believe.",
  },
  localFirst: {
    eyebrow: "Local capital first",
    title: "Local capital first.",
    accent: "Global capital where it adds capacity.",
    body: [
      "Global capital should not replace capital that is already available locally. EmpowerFI first maps the capital already available to a business or a territory.",
      "Only qualified productive demand that remains underserved becomes a candidate for additional global capital.",
    ],
    equation: [
      { label: "Qualified productive demand", op: "" },
      { label: "Local + domestic capital", op: "−" },
      { label: "Potential external capital gap", op: "=", emphasis: true },
    ],
    then: [
      { label: "Global capital eligibility", desc: "Asked separately, and it can answer no." },
      { label: "Additional capital", desc: "What reaches the business on top of what local capital already covered." },
    ],
    callout: "Global capital is additional, not substitutive.",
  },
  rails: {
    eyebrow: "Local economic rails",
    title: "Capital can reach a business.",
    accent: "What happens next matters too.",
    body: [
      "Brazil already has local economic infrastructure: community development banks, regional financial networks, Pix, and local and social currency systems. That infrastructure was built by other people, over decades.",
      "EmpowerFI's long-term architecture can connect to existing local financial rails rather than recreate them.",
    ],
    chain: ["Capital", "Entrepreneur", "Supplier", "Merchant", "Local economy", "Repayment"],
    chainCaption:
      "Capital reaches an entrepreneur, who buys from a supplier, who trades with a merchant, inside the same local economy — and the repayment returns from it.",
    hypothesisLabel: "Hypothesis",
    hypothesis:
      "We want to measure whether routing productive capital through local economic networks can increase local circulation while preserving financial sustainability. This is a question the platform is built to answer, not a result it has.",
    cautions: [
      "Local currencies do not inherently generate economic growth, and nothing here claims they do.",
      "EmpowerFI does not operate a local currency today, and has no integration or partnership with E-Dinheiro or any local currency operator.",
    ],
    evidenceLabel: "External market evidence · not EmpowerFI data, not EmpowerFI partners",
    evidence: [
      { figure: "103", desc: "community development banks in Brazil, issuing local currencies since Banco Palmas in 1998.", source: "Rede Brasileira de Bancos Comunitários, 2024" },
      { figure: "133,000", desc: "people paying with the Mumbuca, the local currency of one city, Maricá.", source: "Prefeitura de Maricá, 2024" },
      { figure: "R$9.53bn", desc: "outstanding in Brazil's regulated oriented productive microcredit programme.", source: "ANBC, 2025-06" },
    ],
    sources: "Every figure, with its source",
  },
  global: {
    eyebrow: "Global capital",
    title: "The world has capital.",
    accent: "Local economies have productive demand.",
    subtitle: "The two do not meet, and the reason is structural rather than a shortage on either side.",
    columns: [
      {
        label: "Global capital",
        items: ["Impact funds", "Institutional investors", "Development capital"],
        note: "Large pools, large mandates.",
      },
      {
        label: "The missing layer",
        items: ["Qualify", "Aggregate", "Service", "Measure"],
        note: "What neither side is built to do.",
        emphasis: true,
      },
      {
        label: "Local productive opportunities",
        items: ["Thousands of small capital needs", "R$1,000 to R$10,000", "Spread across territories"],
        note: "Each one too small to evaluate alone.",
      },
    ],
    callout: "EmpowerFI is building the missing infrastructure between them.",
    caveat:
      "Market evidence on the size of the gap is cited from IFC and Sicredi research. EmpowerFI has no access to IFC capital and no relationship with it.",
  },
  northStar: {
    eyebrow: "North star",
    label: "Future architecture",
    title: "From fragmented productive demand",
    accent: "to investable local economies.",
    body: [
      "A global investor cannot efficiently evaluate thousands of tiny productive opportunities one at a time. The cost of looking is larger than the ticket.",
      "EmpowerFI's long-term role is to make that demand qualified, aggregated, serviceable and measurable. That can eventually create investable exposure to local productive economies.",
    ],
    ticketsLabel: "Thousands of small businesses",
    tickets: ["R$1,000", "R$2,000", "R$5,000", "R$3,000", "R$1,500", "R$8,000"],
    stepsLabel: "EmpowerFI",
    steps: ["Qualify", "Aggregate", "Allocate", "Service", "Measure"],
    outLabel: "What that could become",
    out: ["Local productive capital portfolios", "Local + domestic + global capital"],
    caveat: "No such portfolio exists today. This section describes where the architecture is going, under structures that would have to be regulated before any of it is offered to anyone.",
  },
  solana: {
    eyebrow: "Technology",
    title: "Local last mile.",
    accent: "Global capital rail.",
    subtitle:
      "Solana is not the domestic payment rail. It is the global settlement, verifiability and future programmable-asset layer.",
    roles: [
      { number: "01", name: "Global settlement", desc: "USDC and programmable settlement for future international capital." },
      { number: "02", name: "Verifiable evidence", desc: "Funding, repayment and selected lifecycle commitments, recorded as hashes without personal data." },
      { number: "03", name: "Future programmable assets", desc: "Potential infrastructure for aggregated productive-capital positions.", future: true },
    ],
    callout: "The entrepreneur should not need to understand wallets, USDC, FX or blockchain. She receives and repays in her own currency.",
  },
  audit: {
    eyebrow: "Auditability",
    title: "Evidence without",
    accent: "financial surveillance.",
    layers: [
      { name: "Private business data", desc: "Identity, documents, Pix details, revenue, costs and check-ins. Never leaves the private layer." },
      { name: "Derived intelligence", desc: "Readiness, capital need, affordability, eligibility, allocation, repayment, capital outcomes, local circulation where applicable, and the evidence quality of each — computed by versioned engines." },
      { name: "Cryptographic proof", desc: "Hash commitments and lifecycle states on Solana. Anyone can verify; no one can read her life." },
    ],
    keyLine: "No personal data on chain, at any layer.",
  },
  audiences: {
    eyebrow: "Who it is for",
    title: "One infrastructure.",
    accent: "Multiple participants.",
    statusLabel: "Status",
    items: [
      {
        number: "01",
        who: "Entrepreneurs",
        title: "Organise the business.",
        accent: "Build a track record.",
        desc: "Understand the capital the business actually needs, and reach better-fit capital opportunities when it is ready.",
        points: ["Free app to run the business", "Readiness before the request", "Capital need and affordability, worked out rather than guessed"],
        status: "App live in Brazil. Capital access in pilot development.",
        cta: "",
      },
      {
        number: "02",
        who: "Capital providers",
        title: "Reach qualified",
        accent: "productive demand.",
        desc: "Use EmpowerFI to understand readiness, capital need, affordability, eligibility, servicing and outcomes — before deploying, and after.",
        points: ["Qualified demand rather than applications", "Eligibility and affordability, with their reasons", "Servicing and outcome states you can check"],
        status: "Prototype. EmpowerFI holds no lending, P2P or investment licence today.",
        cta: "Talk to us about capital",
      },
      {
        number: "03",
        who: "Impact and global investors",
        title: "Aggregated productive",
        accent: "opportunities, over time.",
        desc: "Portfolio infrastructure, servicing, impact intelligence and verifiable evidence for exposure to local productive economies.",
        points: ["Portfolio infrastructure", "Servicing and monitoring", "Impact intelligence", "Verifiable evidence"],
        status: "Future functionality, under structures that would have to be regulated first. No investment product is offered here, and no return is promised.",
        cta: "Join the waitlist",
      },
      {
        number: "04",
        who: "Sponsors and foundations",
        title: "Fund programs, and know",
        accent: "whether businesses got stronger.",
        desc: "Follow whether the businesses in a program are becoming more resilient and more capital-ready — per program or cohort, with the evidence behind each figure.",
        points: ["Executive dashboard by program and cohort", "Auditable outcome reporting", "Evidence quality stated beside every number"],
        status: "Demonstrated in the devnet prototype. Impact intelligence is a product capability, not the definition of EmpowerFI.",
        cta: "Bring your program",
      },
      {
        number: "05",
        who: "Communities and program operators",
        title: "Prepare entrepreneurs.",
        accent: "Capture the evidence.",
        desc: "Run programs, follow participants over months, and connect them to the capital network when they are ready.",
        points: ["Program execution and check-ins", "Longitudinal evidence", "A route into the capital network"],
        status: "Demonstrated in the prototype. Communities are distribution and execution partners, not automatically the paying customer.",
        cta: "Run a program with us",
      },
      {
        number: "06",
        who: "Governments and local economic programs",
        title: "Map the capital",
        accent: "a territory can actually reach.",
        desc: "Understand productive capital demand in a territory, map how much of it local instruments cover, connect businesses to what exists, and measure the economic activity that follows.",
        points: ["Productive capital demand, mapped", "Capital coverage and the gap", "Local economic activity and outcomes"],
        status: "Future and partnership-driven. No municipal deployment exists today.",
        cta: "Explore a local program",
      },
    ],
  },
  revenue: {
    eyebrow: "Business model",
    title: "One infrastructure.",
    accent: "Multiple revenue layers.",
    label: "In validation",
    subtitle:
      "The business model is in validation. What follows is where revenue could come from, not revenue that exists — and no pricing on this page is an offer.",
    layers: [
      { name: "Capital intelligence", desc: "Enterprise and program infrastructure." },
      { name: "Capital deployment", desc: "Infrastructure and transaction economics, where legally permitted." },
      { name: "Servicing", desc: "Qualification, monitoring and servicing infrastructure." },
      { name: "Impact intelligence", desc: "Measurement, evidence and reporting." },
      { name: "Integrations", desc: "Capital-provider and infrastructure integrations." },
      { name: "Portfolio infrastructure", desc: "Aggregation and investor infrastructure, under appropriate regulated structures.", future: true },
    ],
    keyLine: "The same data that qualifies capital measures what the capital did.",
    communities:
      "Communities are distribution, education and execution partners: they run the programs, and they are not automatically the paying customer.",
  },
  traction: {
    eyebrow: "Traction",
    title: "What is real",
    accent: "today.",
    items: [
      { tag: "Live", title: "The app is live in Brazil", desc: "Published on Google Play and the App Store: where the entrepreneur runs her business and the evidence begins." },
      { tag: "Devnet", title: "A working prototype, end to end", desc: "The capital engine, the investor console and impact intelligence, on Solana devnet. Capital allocation, investor flows, FX and settlement are simulated; blockchain transactions use test assets.", link: "Open App - Devnet" },
      { tag: "Institutional support", title: "Built and refined with Sebrae", desc: "Ginga Prototipa produced the working prototype; PIER refines the business model with specialist consulting." },
      { tag: "Recognition", title: "An empresa-filha of Unicamp", desc: "Registered in Unicamp Ventures, the network that connects the founders of the university's empresa-filha companies." },
      { tag: "São Paulo", title: "An operating company in Brazil", desc: "Incorporated in São Paulo, with its team, product and first market in Brazil." },
    ],
    pilotLabel: "Pilot · next",
    pilot:
      "Pilot status: in preparation in Brazil. No pilot results exist yet, and none are shown here. Future integrations, prototype simulations and external market evidence are not traction and are not presented as any.",
    fit: "Let's build the capital network.",
    fitBody:
      "We are talking to organizations across the productive-capital ecosystem — entrepreneurs, communities, capital providers, local financial networks, impact investors and institutions.",
    ctas: [
      { id: "capital", label: "I provide capital", desc: "Reach qualified productive demand, with readiness, affordability and servicing behind it." },
      { id: "rails", label: "I operate a local financial network", desc: "Community bank, regional network or local currency: let's talk about what connecting could look like." },
      { id: "sponsor", label: "I fund entrepreneurship programs", desc: "Know whether the businesses in your program are becoming stronger and more capital-ready." },
      { id: "community", label: "I support entrepreneurs", desc: "Run programs with the tools that turn execution into evidence." },
      { id: "entrepreneur", label: "I am an entrepreneur", desc: "Organise the business, build a track record, and reach capital that fits it." },
      { id: "integration", label: "I want to explore an integration", desc: "Capital providers and local economic infrastructure: tell us what you operate." },
    ],
    entrepreneur: "Running a business yourself? The app is free on Google Play and the App Store.",
  },
  contact: {
    eyebrow: "Contact",
    title: "Let's build",
    accent: "the capital network.",
    subtitle:
      "Tell us about the capital you deploy, the network you operate, the program you fund or the entrepreneurs you support. We answer every message.",
    interest: "I am writing as",
    interests: {
      capital: "A capital provider",
      rails: "A local financial network",
      sponsor: "A program sponsor",
      community: "A community or program operator",
      entrepreneur: "An entrepreneur",
      integration: "An integration",
      other: "Something else",
    },
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
    title: "EmpowerFI — Capital global. Circulação local. Prosperidade mensurável.",
    description:
      "A EmpowerFI está construindo a infraestrutura de capital que conecta negócios produtivos ao capital local, doméstico e global — capital local primeiro, capital global onde ele acrescenta capacidade. Brasil primeiro.",
  },
  hero: {
    badge: "Infraestrutura de capital · Brasil primeiro",
    title: "Capital global. Circulação local.",
    accent: "Prosperidade mensurável.",
    body:
      "A EmpowerFI está construindo a infraestrutura que conecta negócios produtivos ao capital de que precisam — usando primeiro o capital local e doméstico, e destravando capital global adicional onde a demanda qualificada continua desatendida.",
    explore: "Explore a plataforma",
    partner: "Seja parceiro",
    note: "Brasil primeiro. Feita para economias produtivas locais.",
    statusLabel: "Protótipo",
    status: [
      "A infraestrutura de capital da EmpowerFI está sendo testada por um protótipo funcional na devnet da Solana. A alocação de capital, os fluxos de investidor e a liquidação do global para o local são simulações do protótipo, e as transações em blockchain usam ativos de teste.",
      "Nosso primeiro piloto real está em preparação no Brasil, para validar prontidão dos negócios, necessidade de capital produtivo, economia do serviço e resultados.",
    ],
    stack: {
      title: "A arquitetura",
      layers: [
        { name: "Capital global", sub: "Impacto · Institucional · Desenvolvimento", emphasis: false },
        { name: "EmpowerFI", sub: "Inteligência e orquestração de capital", emphasis: true },
        { name: "Trilhos de capital local", sub: "Comunitário · Regional · Doméstico", emphasis: false },
        { name: "Economia local", sub: "Empreendedoras · Fornecedores · Comerciantes", emphasis: false },
      ],
      note: "O capital desce; o pagamento, a evidência e os resultados sobem de volta.",
    },
  },
  engines: {
    eyebrow: "Uma plataforma · quatro motores de capital",
    title: "Entender o negócio, achar o capital,",
    accent: "encaminhá-lo e medir o que aconteceu.",
    subtitle:
      "Quatro motores sobre uma base de dados. Cada um responde a uma pergunta diferente, e nenhum substitui o outro: saber que um negócio está pronto não diz qual capital consegue alcançá-lo, e desembolsar capital não diz o que ele fez.",
    items: [
      {
        number: "01",
        name: "Inteligência de capital",
        lead: "Entender o negócio antes de o capital sair.",
        points: ["Prontidão", "Necessidade de capital produtivo", "Capacidade de pagamento", "Comportamento do negócio", "Evidência longitudinal"],
      },
      {
        number: "02",
        name: "Alocação de capital",
        lead: "Achar a fonte de capital que melhor se encaixa.",
        points: ["Capital local", "Produtos regionais", "Crédito produtivo", "Capital patrocinado", "Capital doméstico", "Capital global onde elegível"],
      },
      {
        number: "03",
        name: "Orquestração de capital",
        lead: "Encaminhar o capital pela infraestrutura adequada.",
        points: ["Provedores de capital", "Parceiros financeiros regulados", "Trilhos econômicos locais", "BRL / Pix", "Liquidação global futura"],
      },
      {
        number: "04",
        name: "Inteligência de impacto",
        lead: "Medir o que acontece depois que o capital sai.",
        points: ["Capital desembolsado", "Pagamento", "Progresso do negócio", "Resultados produtivos", "Circulação local quando aplicável", "Qualidade da evidência"],
      },
    ],
    flowLabel: "O ciclo que os quatro motores rodam",
    flow: ["Observar", "Qualificar", "Alocar", "Encaminhar", "Acompanhar", "Medir"],
  },
  problem: {
    eyebrow: "O problema",
    title: "O capital existe. A demanda produtiva existe.",
    accent: "A conexão está quebrada.",
    subtitle:
      "Negócios produtivos pequenos costumam precisar de valores relativamente pequenos. Provedores de capital operam com mandatos maiores, regras de elegibilidade diferentes e canais de distribuição fragmentados. O desafio não é criar mais um empréstimo.",
    qualifiesLabel: "No que a demanda produtiva precisa se transformar",
    qualifies: [
      { word: "Qualificada", desc: "Avaliada por prontidão, necessidade de capital e o que o negócio de fato consegue pagar." },
      { word: "Encaminhável", desc: "Casada com um instrumento cujo mandato, ticket e elegibilidade ela realmente cabe." },
      { word: "Acompanhável", desc: "Seguida depois do desembolso, com pagamento e comportamento registrados em vez de supostos." },
      { word: "Mensurável", desc: "Resultados observados nos meses que o negócio já informa, com a qualidade da evidência declarada." },
      { word: "Investível", desc: "Um dia: agregada em uma exposição que um provedor de capital consiga avaliar.", future: true },
    ],
    futureNote: "A quinta é para onde isto vai, não onde está.",
    benchmark: {
      label: "Por que o ticket pequeno é a parte difícil",
      figure: "US$ 14",
      unit: "/ US$ 100",
      lead: "Despesa operacional mediana para cada US$ 100 de carteira em microfinanças.",
      caveat: "Internacional e histórico — não é o custo de servir da EmpowerFI nem o do Brasil hoje.",
      source: "Fonte: Banco Mundial WPS 8252, 2005–2009.",
    },
    brazil: {
      label: "O Brasil, onde isto começa",
      items: [
        { figure: "2,6%", desc: "das micro e pequenas empresas lideradas por mulheres acessam crédito formal, contra 4,6% das lideradas por homens no mesmo estudo." },
        { figure: "US$ 15,8 bi", desc: "é a lacuna de financiamento estimada para micro e pequenas empresas lideradas por mulheres no Brasil." },
      ],
      source: "Fonte: IFC + Sicredi, 2025.",
    },
    sources: "Cada número, com a fonte",
  },
  pilot: {
    eyebrow: "Hipótese operacional",
    title: "O crédito produtivo pode ficar mais barato de operar",
    accent: "sem virar um crédito mais fraco?",
    subtitle:
      "Este não é o problema da empresa, e continua sendo a pergunta que o piloto tem de responder. O protótipo mede essas variáveis; o piloto precisa mostrar o custo caindo sem o crédito enfraquecer.",
    measure: {
      note: "Uma hipótese, não um resultado.",
      headers: ["Precisa melhorar", "Não pode ser sacrificado", "Como a plataforma mede"],
      rows: [
        ["Custo de servir", "Disciplina de elegibilidade", "Eventos de custo por etapa e oportunidade"],
        ["Tempo até a decisão", "Verificação de capacidade de pagamento", "Carimbos de tempo e códigos de motivo dos motores"],
        ["Escalabilidade operacional", "Acompanhamento contínuo", "Check-ins digitais e eventos de acompanhamento"],
        ["Acesso a capital", "Qualidade da carteira", "Pagamento, atraso e estados de resultado"],
      ],
    },
  },
  how: {
    eyebrow: "Como funciona",
    title: "De uma necessidade produtiva",
    accent: "a um capital que dá para acompanhar e medir.",
    steps: [
      { number: "01", name: "Demanda produtiva", desc: "Um negócio identifica uma necessidade de capital produtivo: equipamento, estoque, matéria-prima, capital de giro, serviços produtivos." },
      { number: "02", name: "Prontidão do negócio", desc: "A EmpowerFI avalia se o negócio está pronto — a partir dos meses que ele já informa, não de um formulário preenchido no dia do pedido." },
      { number: "03", name: "Necessidade de capital", desc: "Quanto, para quê, o que o negócio consegue pagar, e onde o capital vai ser gasto." },
      { number: "04", name: "Motor de capital", desc: "As fontes de capital disponíveis são avaliadas contra essa necessidade específica: liquidez, ticket, mandato, elegibilidade e custo." },
      { number: "05", name: "Capital local primeiro", desc: "Capital comunitário e municipal, produtos regionais, microcrédito produtivo, crédito comercial, capital patrocinado e investidores domésticos são considerados antes de qualquer coisa de fora." },
      { number: "06", name: "Lacuna de capital externo", desc: "A demanda produtiva qualificada, menos a cobertura do capital local e doméstico, é a lacuna potencial de capital externo." },
      { number: "07", name: "Elegibilidade global", desc: "A lacuna é avaliada à parte. Faltar financiamento não torna uma oportunidade automaticamente elegível para capital global." },
      { number: "08", name: "Desembolsar, acompanhar, medir", desc: "O capital é desembolsado pela infraestrutura regulada adequada, e a EmpowerFI acompanha serviço, pagamento e resultados." },
    ],
    judgements: [
      { q: "O negócio está pronto?", a: "Prontidão" },
      { q: "Este valor de capital é sustentável?", a: "Elegibilidade" },
      { q: "Qual fonte de capital se encaixa melhor?", a: "Alocação" },
    ],
    judgementsNote: "Três decisões separadas. Estar pronta não é ser elegível, e ser elegível não é estar financiada.",
    more: "A explicação completa, para provedores de capital",
  },
  network: {
    eyebrow: "Rede de capital",
    title: "Uma necessidade produtiva.",
    accent: "Várias fontes possíveis de capital.",
    subtitle:
      "A EmpowerFI não cria um empréstimo toda vez que um negócio precisa de capital. Ela identifica o instrumento de capital produtivo que melhor se encaixa — e pode combinar fontes quando faz sentido.",
    needLabel: "Necessidade de capital produtivo",
    engineLabel: "Motor de capital",
    sourcesLabel: "Para onde pode encaminhar",
    sources: [
      "Capital local / comunitário",
      "Produtos financeiros regionais",
      "Microcrédito produtivo",
      "Crédito comercial",
      "Capital patrocinado",
      "Investidores domésticos",
      "Capital global de impacto",
    ],
    outcomeLabel: "O que sai",
    outcomes: ["Capital que melhor se encaixa", "ou uma rota de capital combinada"],
    callout:
      "Uma rota recusada é uma resposta tanto quanto uma recomendada, e ela diz em qual verificação o pedido não passou: um ticket acima do limite do produto, um estado que a rota não atende, um mandato em que ele não cabe. Uma recusa que a pessoa consegue conferir vale mais que uma em que ela precisa acreditar.",
  },
  localFirst: {
    eyebrow: "Capital local primeiro",
    title: "Capital local primeiro.",
    accent: "Capital global onde ele acrescenta capacidade.",
    body: [
      "Capital global não deve substituir capital que já está disponível localmente. A EmpowerFI mapeia primeiro o capital já disponível para um negócio ou um território.",
      "Só a demanda produtiva qualificada que continua desatendida vira candidata a capital global adicional.",
    ],
    equation: [
      { label: "Demanda produtiva qualificada", op: "" },
      { label: "Capital local + doméstico", op: "−" },
      { label: "Lacuna potencial de capital externo", op: "=", emphasis: true },
    ],
    then: [
      { label: "Elegibilidade para capital global", desc: "Perguntada à parte, e pode responder não." },
      { label: "Capital adicional", desc: "O que chega ao negócio além do que o capital local já cobriu." },
    ],
    callout: "O capital global é adicional, não substitutivo.",
  },
  rails: {
    eyebrow: "Trilhos econômicos locais",
    title: "O capital pode chegar a um negócio.",
    accent: "O que acontece depois também importa.",
    body: [
      "O Brasil já tem infraestrutura econômica local: bancos comunitários de desenvolvimento, redes financeiras regionais, Pix, e sistemas de moeda local e social. Essa infraestrutura foi construída por outras pessoas, ao longo de décadas.",
      "A arquitetura de longo prazo da EmpowerFI pode se conectar a trilhos financeiros locais que já existem, em vez de recriá-los.",
    ],
    chain: ["Capital", "Empreendedora", "Fornecedor", "Comerciante", "Economia local", "Pagamento"],
    chainCaption:
      "O capital chega a uma empreendedora, que compra de um fornecedor, que negocia com um comerciante, dentro da mesma economia local — e o pagamento volta dela.",
    hypothesisLabel: "Hipótese",
    hypothesis:
      "Queremos medir se encaminhar capital produtivo por redes econômicas locais aumenta a circulação local preservando a sustentabilidade financeira. É uma pergunta que a plataforma foi feita para responder, não um resultado que ela tem.",
    cautions: [
      "Moedas locais não geram crescimento econômico por si só, e nada aqui afirma que geram.",
      "A EmpowerFI não opera moeda local hoje, e não tem integração nem parceria com o E-Dinheiro ou com qualquer operador de moeda local.",
    ],
    evidenceLabel: "Evidência externa de mercado · não são dados da EmpowerFI, nem parceiros da EmpowerFI",
    evidence: [
      { figure: "103", desc: "bancos comunitários de desenvolvimento no Brasil, emitindo moeda local desde o Banco Palmas, em 1998.", source: "Rede Brasileira de Bancos Comunitários, 2024" },
      { figure: "133.000", desc: "pessoas pagando com a Mumbuca, a moeda local de uma cidade só, Maricá.", source: "Prefeitura de Maricá, 2024" },
      { figure: "R$ 9,53 bi", desc: "de carteira no microcrédito produtivo orientado, o programa nacional regulado.", source: "ANBC, 2025-06" },
    ],
    sources: "Cada número, com a fonte",
  },
  global: {
    eyebrow: "Capital global",
    title: "O mundo tem capital.",
    accent: "As economias locais têm demanda produtiva.",
    subtitle: "Os dois não se encontram, e a razão é estrutural — não é falta de um lado nem do outro.",
    columns: [
      {
        label: "Capital global",
        items: ["Fundos de impacto", "Investidores institucionais", "Capital de desenvolvimento"],
        note: "Bolsos grandes, mandatos grandes.",
      },
      {
        label: "A camada que falta",
        items: ["Qualificar", "Agregar", "Acompanhar", "Medir"],
        note: "O que nenhum dos dois lados foi feito para fazer.",
        emphasis: true,
      },
      {
        label: "Oportunidades produtivas locais",
        items: ["Milhares de necessidades pequenas", "De R$ 1.000 a R$ 10.000", "Espalhadas por territórios"],
        note: "Cada uma pequena demais para avaliar sozinha.",
      },
    ],
    callout: "A EmpowerFI está construindo a infraestrutura que falta entre os dois.",
    caveat:
      "A evidência de mercado sobre o tamanho da lacuna é citada de pesquisa da IFC e do Sicredi. A EmpowerFI não tem acesso a capital da IFC nem relação com ela.",
  },
  northStar: {
    eyebrow: "Norte",
    label: "Arquitetura futura",
    title: "De demanda produtiva fragmentada",
    accent: "a economias locais investíveis.",
    body: [
      "Um investidor global não consegue avaliar com eficiência milhares de oportunidades produtivas minúsculas, uma a uma. O custo de olhar é maior que o ticket.",
      "O papel de longo prazo da EmpowerFI é tornar essa demanda qualificada, agregada, acompanhável e mensurável. Isso pode, um dia, criar exposição investível a economias produtivas locais.",
    ],
    ticketsLabel: "Milhares de negócios pequenos",
    tickets: ["R$ 1.000", "R$ 2.000", "R$ 5.000", "R$ 3.000", "R$ 1.500", "R$ 8.000"],
    stepsLabel: "EmpowerFI",
    steps: ["Qualificar", "Agregar", "Alocar", "Acompanhar", "Medir"],
    outLabel: "No que isso pode virar",
    out: ["Carteiras de capital produtivo local", "Capital local + doméstico + global"],
    caveat: "Nenhuma carteira dessas existe hoje. Esta seção descreve para onde a arquitetura vai, sob estruturas que precisariam ser reguladas antes de qualquer coisa ser oferecida a alguém.",
  },
  solana: {
    eyebrow: "Tecnologia",
    title: "Última milha local.",
    accent: "Trilho global de capital.",
    subtitle:
      "A Solana não é o trilho de pagamento doméstico. É a camada de liquidação global, de verificabilidade e de ativos programáveis no futuro.",
    roles: [
      { number: "01", name: "Liquidação global", desc: "USDC e liquidação programável para o capital internacional futuro." },
      { number: "02", name: "Evidência verificável", desc: "Captação, pagamento e alguns marcos do ciclo de vida, registrados como hashes sem dado pessoal." },
      { number: "03", name: "Ativos programáveis futuros", desc: "Infraestrutura possível para posições agregadas de capital produtivo.", future: true },
    ],
    callout: "A empreendedora não deveria precisar entender carteira, USDC, câmbio ou blockchain. Ela recebe e paga na moeda dela.",
  },
  audit: {
    eyebrow: "Auditabilidade",
    title: "Evidência sem",
    accent: "vigilância financeira.",
    layers: [
      { name: "Dados privados do negócio", desc: "Identidade, documentos, chave Pix, receita, custos e check-ins. Nunca saem da camada privada." },
      { name: "Inteligência derivada", desc: "Prontidão, necessidade de capital, capacidade de pagamento, elegibilidade, alocação, pagamento, resultados do capital, circulação local quando aplicável, e a qualidade da evidência de cada um — calculadas por motores versionados." },
      { name: "Prova criptográfica", desc: "Compromissos em hash e estados do ciclo de vida na Solana. Qualquer um verifica; ninguém lê a vida dela." },
    ],
    keyLine: "Nenhum dado pessoal em blockchain, em nenhuma camada.",
  },
  audiences: {
    eyebrow: "Para quem é",
    title: "Uma infraestrutura.",
    accent: "Vários participantes.",
    statusLabel: "Situação",
    items: [
      {
        number: "01",
        who: "Empreendedoras",
        title: "Organizar o negócio.",
        accent: "Construir histórico.",
        desc: "Entender o capital de que o negócio realmente precisa, e alcançar oportunidades de capital que se encaixam nele quando estiver pronto.",
        points: ["App gratuito para tocar o negócio", "Prontidão antes do pedido", "Necessidade de capital e capacidade de pagamento, calculadas em vez de chutadas"],
        status: "App no ar no Brasil. Acesso a capital em desenvolvimento para o piloto.",
        cta: "",
      },
      {
        number: "02",
        who: "Provedores de capital",
        title: "Alcançar demanda produtiva",
        accent: "já qualificada.",
        desc: "Use a EmpowerFI para entender prontidão, necessidade de capital, capacidade de pagamento, elegibilidade, acompanhamento e resultados — antes de desembolsar, e depois.",
        points: ["Demanda qualificada em vez de propostas", "Elegibilidade e capacidade de pagamento, com os motivos", "Estados de acompanhamento e resultado que dá para conferir"],
        status: "Protótipo. A EmpowerFI não tem licença de crédito, P2P ou investimento hoje.",
        cta: "Fale com a gente sobre capital",
      },
      {
        number: "03",
        who: "Investidores de impacto e globais",
        title: "Oportunidades produtivas",
        accent: "agregadas, com o tempo.",
        desc: "Infraestrutura de carteira, acompanhamento, inteligência de impacto e evidência verificável para exposição a economias produtivas locais.",
        points: ["Infraestrutura de carteira", "Acompanhamento e monitoramento", "Inteligência de impacto", "Evidência verificável"],
        status: "Funcionalidade futura, sob estruturas que precisariam ser reguladas antes. Nada aqui é oferta de produto de investimento, e nenhum retorno é prometido.",
        cta: "Entrar na lista de espera",
      },
      {
        number: "04",
        who: "Patrocinadores e fundações",
        title: "Financiar programas e saber",
        accent: "se os negócios ficaram mais fortes.",
        desc: "Acompanhe se os negócios do programa estão ficando mais resilientes e mais prontos para capital — por programa ou turma, com a evidência por trás de cada número.",
        points: ["Painel executivo por programa e turma", "Relatório de resultados auditável", "Qualidade da evidência declarada ao lado de cada número"],
        status: "Demonstrado no protótipo na devnet. Inteligência de impacto é uma capacidade do produto, não a definição da EmpowerFI.",
        cta: "Traga o seu programa",
      },
      {
        number: "05",
        who: "Comunidades e operadores de programa",
        title: "Preparar empreendedoras.",
        accent: "Capturar a evidência.",
        desc: "Toque programas, acompanhe participantes ao longo de meses e conecte-as à rede de capital quando estiverem prontas.",
        points: ["Execução de programa e check-ins", "Evidência longitudinal", "Um caminho para dentro da rede de capital"],
        status: "Demonstrado no protótipo. Comunidades são parceiras de distribuição e execução, não automaticamente o cliente pagante.",
        cta: "Toque um programa com a gente",
      },
      {
        number: "06",
        who: "Governos e programas econômicos locais",
        title: "Mapear o capital que um",
        accent: "território de fato alcança.",
        desc: "Entenda a demanda de capital produtivo de um território, mapeie quanto dela os instrumentos locais cobrem, conecte negócios ao que existe, e meça a atividade econômica que vem depois.",
        points: ["Demanda de capital produtivo, mapeada", "Cobertura de capital e a lacuna", "Atividade econômica local e resultados"],
        status: "Futuro e dependente de parceria. Nenhuma implantação municipal existe hoje.",
        cta: "Explorar um programa local",
      },
    ],
  },
  revenue: {
    eyebrow: "Modelo de negócio",
    title: "Uma infraestrutura.",
    accent: "Várias camadas de receita.",
    label: "Em validação",
    subtitle:
      "O modelo de negócio está em validação. O que vem abaixo é de onde a receita poderia vir, não receita que existe — e nenhum preço nesta página é uma oferta.",
    layers: [
      { name: "Inteligência de capital", desc: "Infraestrutura para empresas e programas." },
      { name: "Desembolso de capital", desc: "Economia de infraestrutura e de transação, onde legalmente permitido." },
      { name: "Acompanhamento", desc: "Infraestrutura de qualificação, monitoramento e serviço." },
      { name: "Inteligência de impacto", desc: "Medição, evidência e relatórios." },
      { name: "Integrações", desc: "Integrações com provedores de capital e com infraestrutura." },
      { name: "Infraestrutura de carteira", desc: "Agregação e infraestrutura para investidores, sob estruturas reguladas adequadas.", future: true },
    ],
    keyLine: "Os mesmos dados que qualificam o capital medem o que o capital fez.",
    communities:
      "Comunidades são parceiras de distribuição, educação e execução: elas tocam os programas, e não são automaticamente o cliente pagante.",
  },
  traction: {
    eyebrow: "Tração",
    title: "O que é real",
    accent: "hoje.",
    items: [
      { tag: "No ar", title: "O app está no ar no Brasil", desc: "Publicado no Google Play e na App Store: onde a empreendedora toca o negócio e a evidência começa." },
      { tag: "Devnet", title: "Um protótipo funcionando de ponta a ponta", desc: "O motor de capital, o console do investidor e a inteligência de impacto, na devnet da Solana. Alocação de capital, fluxos de investidor, câmbio e liquidação são simulados; as transações em blockchain usam ativos de teste.", link: "Abrir o app · Devnet" },
      { tag: "Apoio institucional", title: "Construída e refinada com o Sebrae", desc: "O Ginga Prototipa produziu o protótipo funcional; o PIER refina o modelo de negócio com consultoria especializada." },
      { tag: "Reconhecimento", title: "Uma empresa-filha da Unicamp", desc: "Registrada na Unicamp Ventures, a rede que conecta os fundadores das empresas-filhas da universidade." },
      { tag: "São Paulo", title: "Uma empresa operando no Brasil", desc: "Constituída em São Paulo, com time, produto e primeiro mercado no Brasil." },
    ],
    pilotLabel: "Piloto · a seguir",
    pilot:
      "Situação do piloto: em preparação no Brasil. Ainda não há resultados de piloto, e nenhum é mostrado aqui. Integrações futuras, simulações do protótipo e evidência externa de mercado não são tração e não são apresentadas como tal.",
    fit: "Vamos construir a rede de capital.",
    fitBody:
      "Estamos conversando com organizações de todo o ecossistema de capital produtivo — empreendedoras, comunidades, provedores de capital, redes financeiras locais, investidores de impacto e instituições.",
    ctas: [
      { id: "capital", label: "Eu forneço capital", desc: "Alcance demanda produtiva qualificada, com prontidão, capacidade de pagamento e acompanhamento por trás." },
      { id: "rails", label: "Eu opero uma rede financeira local", desc: "Banco comunitário, rede regional ou moeda local: vamos conversar sobre como seria conectar." },
      { id: "sponsor", label: "Eu financio programas de empreendedorismo", desc: "Saiba se os negócios do seu programa estão ficando mais fortes e mais prontos para capital." },
      { id: "community", label: "Eu apoio empreendedoras", desc: "Toque programas com as ferramentas que transformam execução em evidência." },
      { id: "entrepreneur", label: "Eu sou empreendedora", desc: "Organize o negócio, construa histórico e alcance um capital que caiba nele." },
      { id: "integration", label: "Quero explorar uma integração", desc: "Provedores de capital e infraestrutura econômica local: conte o que você opera." },
    ],
    entrepreneur: "Você toca um negócio? O app é gratuito no Google Play e na App Store.",
  },
  contact: {
    eyebrow: "Contato",
    title: "Vamos construir",
    accent: "a rede de capital.",
    subtitle:
      "Conte sobre o capital que você aloca, a rede que você opera, o programa que você financia ou as empreendedoras que você apoia. Respondemos todas as mensagens.",
    interest: "Escrevo como",
    interests: {
      capital: "Provedor de capital",
      rails: "Rede financeira local",
      sponsor: "Patrocinador de programa",
      community: "Comunidade ou operador de programa",
      entrepreneur: "Empreendedora",
      integration: "Integração",
      other: "Outro assunto",
    },
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
