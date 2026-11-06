// The corporate site's words, in both languages: one structure, so both say
// the same product maturity, the same campaign rules and the same vision.
// Portuguese is written for the woman who runs the business; English for
// sponsors, fintechs, investors and Web3 partners. Neither is a translation.
//
// Maturity is said beside every claim, in one of four words (MATURITY).

export type Lang = "en" | "pt";
export type Maturity = "available" | "devnet" | "development" | "planned";

export const PATHS = {
  en: { home: "/", entrepreneurs: "/entrepreneurs", sponsors: "/sponsors", protocol: "/protocol", about: "/about", privacy: "/privacy", terms: "/terms" },
  pt: { home: "/pt", entrepreneurs: "/pt/empreendedoras", sponsors: "/pt/patrocinadores", protocol: "/pt/protocolo", about: "/pt/sobre", privacy: "/privacidade", terms: "/termos" },
} as const;

/** The diary on the web, and the devnet demo of the campaign vault. */
export const DIARY_PATH = "/app/diario";
export const MISSIONS_DEMO_PATH = "/app/missions";

export const MATURITY: Record<Lang, Record<Maturity, string>> = {
  en: { available: "Available", devnet: "Devnet demo", development: "In development", planned: "Planned" },
  pt: { available: "Disponível", devnet: "Demonstração na devnet", development: "Em desenvolvimento", planned: "Planejado" },
};

const en = {
  nav: {
    links: [
      { label: "Home", key: "home" },
      { label: "Entrepreneurs", key: "entrepreneurs" },
      { label: "Sponsors", key: "sponsors" },
      { label: "Protocol", key: "protocol" },
      { label: "About", key: "about" },
    ],
    primary: "Partner With Us",
    app: "Platform · Devnet",
    menu: "Menu",
  },
  footer: {
    tagline: "Simple financial tools and sponsored opportunities for women entrepreneurs.",
    positioning: "Brazil first · Built with entrepreneurs",
    product: "Product",
    company: "Company",
    legal: "Legal",
    missionsDemo: "Missions · devnet demo",
    sources: "Evidence & sources",
    contact: "Contact",
    language: "Português",
    notices: [
      "Nothing on this site is an offer of securities, credit or a financial product. EmpowerFI does not operate a licensed lending or investment business.",
      "Campaign rewards are not live yet. The campaign vault is demonstrated on Solana devnet with test tokens that have no value. Rewards always depend on each campaign's eligibility rules.",
    ],
    rights: "All rights reserved.",
  },

  home: {
    seo: {
      title: "EmpowerFI — Financial tools and sponsored campaigns for women entrepreneurs",
      description: "Simple financial tools and sponsored opportunities for women entrepreneurs. Sponsors reach and engage them through measurable 30-day campaigns with conditional rewards.",
    },
    hero: {
      eyebrow: "For women entrepreneurs in Brazil",
      title: "Organize. Engage.",
      accent: "Thrive.",
      body: "Simple financial tools and sponsored opportunities for women entrepreneurs.",
      primary: "For Entrepreneurs",
      secondary: "Become a Sponsor",
      shotAlt: "The EmpowerFI diary: the month's sales, expenses, salary and profit",
      shotNote: "The EmpowerFI diary · illustrative data",
    },
    tools: {
      eyebrow: "Financial tools",
      title: "Know your numbers.",
      accent: "Grow your business.",
      items: [
        { maturity: "available", title: "Simple P&L tracker", body: "Sales, expenses and what is left, counting the salary she needs. Simple, not an accounting system." },
        { maturity: "available", title: "Daily financial check-ins", body: "A one-minute daily record that builds the habit, with a short reading of her week." },
        { maturity: "development", title: "Business passport", body: "Verifiable monthly summaries she chooses to share." },
      ],
      shotAlt: "The day's summary in the EmpowerFI diary: sales, expenses and profit",
    },
    campaigns: {
      eyebrow: "EmpowerFI Missions",
      title: "Sponsored campaigns that",
      accent: "reward participation.",
      body: "Organizations sponsor campaigns that encourage good financial habits and reward entrepreneurs who complete them.",
      kinds: [
        { maturity: "devnet", title: "Impact Marketing", body: "Sponsors support financial engagement and business development." },
        { maturity: "development", title: "Activation Marketing", body: "Sponsors support engagement combined with a defined product or service activation." },
      ],
      facts: ["30 days", "100+ entrepreneurs", "Priced per participant", "Conditional rewards"],
    },
    how: {
      eyebrow: "How it works",
      title: "Engage. Complete.",
      accent: "Earn.",
      split: [
        { share: "50%", label: "allocated to EmpowerFI" },
        { share: "50%", label: "reserved for entrepreneur rewards" },
      ],
      rules: [
        { title: "Impact Marketing", body: "Rewards follow successful completion of the 30-day engagement. Unclaimed allocations go to EmpowerFI under the proposed rules." },
        { title: "Activation Marketing", body: "Rewards also require a verified, sponsor-defined activation. Unclaimed allocations return to the sponsor." },
      ],
      caveat: "Rewards depend on each campaign's eligibility and completion. Signing up alone guarantees nothing.",
      demo: "See the devnet demo",
    },
    tech: {
      eyebrow: "Technology & vision",
      title: "Private data.",
      accent: "Publicly verifiable rules.",
      items: [
        { maturity: "devnet", title: "Near term: programmable rewards", body: "Solana campaign vaults make reward allocation and settlement rules transparent. Demonstrated on devnet." },
        { maturity: "planned", title: "Long term: programmable financial reputation", body: "Verifiable business credentials, repayment probability and selective disclosure, under policies institutions can verify." },
      ],
      cta: "Explore the Protocol",
    },
    traction: {
      eyebrow: "Traction",
      title: "Building with",
      accent: "real entrepreneurs.",
      items: [
        { tag: "Live", title: "Apps on Google Play and the App Store", body: "Published in Brazil.", stores: true },
        { tag: "Live", title: "The EmpowerFI diary on the web", body: "Daily records, the month's profit and a weekly reading." },
        { tag: "Devnet", title: "Campaign vaults on Solana", body: "Built and tested; demonstrated on devnet with test tokens." },
        { tag: "Sebrae", title: "Built and refined with Sebrae", body: "Ginga Prototipa and PIER.", logo: "sebrae" },
        { tag: "Unicamp", title: "An empresa-filha of Unicamp", body: "Registered in Unicamp Ventures.", logo: "unicamp" },
      ],
      join: "Join EmpowerFI",
      partner: "Partner With Us",
    },
  },

  entrepreneurs: {
    seo: {
      title: "EmpowerFI for entrepreneurs — organize your business and join sponsored campaigns",
      description: "Track sales and expenses, see your month's profit, build the habit with daily check-ins, and join sponsored campaigns with conditional rewards. Free.",
    },
    hero: {
      eyebrow: "For entrepreneurs",
      title: "Your business",
      accent: "deserves to grow.",
      body: "Organize your finances, join opportunities and follow how your business evolves.",
      primary: "Start your diary",
      stores: "Or get the app:",
    },
    tools: {
      eyebrow: "What you can use today",
      title: "Your numbers,",
      accent: "in one minute a day.",
      items: [
        { maturity: "available", title: "Sales and expenses", body: "Note each sale and expense by voice or by typing, cash, Pix or card, paid now or in instalments." },
        { maturity: "available", title: "Your month's profit", body: "Tell us the salary you need. You see what is left after expenses and after your salary." },
        { maturity: "available", title: "Daily check-ins and reminders", body: "A reminder at the time you choose, and only on the days your business opens." },
        { maturity: "available", title: "Your week, read", body: "A short reading of your week, with one thing to try. Written by AI only if you agree." },
      ],
    },
    campaigns: {
      eyebrow: "Sponsored campaigns",
      title: "Your participation can",
      accent: "open doors.",
      steps: [
        { title: "Join an eligible campaign", body: "Open campaigns appear in your diary." },
        { title: "Complete the activities", body: "Keep your diary for the campaign's 30 days." },
        { title: "Receive your reward", body: "Only if every condition of the campaign is met." },
      ],
      maturity: "devnet" as Maturity,
      caveat: "Campaign rewards are not live yet. No reward, income or credit approval is guaranteed.",
    },
    history: {
      eyebrow: "Over time",
      title: "A history of",
      accent: "your business.",
      body: "Each day you record becomes your business's history. Later, you will be able to share verifiable summaries of it, only when you choose.",
      maturity: "development" as Maturity,
    },
    privacy: { title: "Your data is yours.", body: "We never sell it. Sponsors only see totals from at least five entrepreneurs.", link: "Privacy policy" },
    cta: { title: "Start today. It is free.", primary: "Start your diary" },
  },

  sponsors: {
    seo: {
      title: "Sponsor a campaign — EmpowerFI Missions",
      description: "Reach and engage women entrepreneurs through measurable 30-day campaigns with conditional rewards, priced per participant. Impact and activation campaigns.",
    },
    hero: {
      eyebrow: "For sponsors",
      title: "Turn engagement into",
      accent: "measurable impact.",
      body: "Sponsored campaigns connecting organizations with women entrepreneurs through measurable engagement and conditional rewards.",
      primary: "Launch a Sponsored Campaign",
    },
    products: {
      eyebrow: "Two products",
      title: "Impact or",
      accent: "activation.",
      columns: ["", "Impact Marketing", "Activation Marketing"],
      rows: [
        ["Designed for", "Financial inclusion, entrepreneurship development and social impact", "Fintechs, payment companies, neobanks and Web3 protocols"],
        ["A reward unlocks after", "30 days of engagement", "30 days of engagement and a verified activation"],
        ["Unclaimed rewards", "Go to EmpowerFI", "Return to the sponsor"],
        ["Status", "Devnet demo", "In development"],
      ],
    },
    format: {
      eyebrow: "The format",
      title: "Simple to buy,",
      accent: "simple to measure.",
      items: [
        { title: "30-day campaigns", body: "One clear window for engagement." },
        { title: "100 participants minimum", body: "Priced per entrepreneur." },
        { title: "Conditional rewards", body: "Paid only when the campaign's conditions are met." },
        { title: "Engagement reporting", body: "Participation and completion, in totals from five entrepreneurs up." },
        { title: "Activation verification", body: "For activation campaigns. In development." },
        { title: "Transparent settlement rules", body: "Written on chain before the campaign starts." },
      ],
    },
    vault: {
      eyebrow: "Under the hood",
      title: "A vault for",
      accent: "every campaign.",
      body: "The sponsorship sits in a Solana vault owned by the campaign itself. The split and the unlock rule are written there, readable by anyone.",
      demo: "See the devnet demo",
    },
    contact: {
      eyebrow: "Contact",
      title: "Launch a",
      accent: "sponsored campaign.",
      body: "Tell us what you want to achieve. We reply to every message.",
    },
  },

  protocol: {
    seo: {
      title: "EmpowerFI Protocol — programmable financial reputation",
      description: "Privacy-preserving, programmable financial reputation: private data, publicly verifiable rules. The long-term infrastructure behind EmpowerFI, and what exists today.",
    },
    hero: {
      eyebrow: "EmpowerFI Protocol",
      title: "Programmable",
      accent: "financial reputation.",
      body: "Private data. Publicly verifiable rules.",
      intro: "Our long-term infrastructure: turning business activity into verifiable financial intelligence, without exposing the business behind it.",
    },
    layers: {
      eyebrow: "The architecture",
      title: "Five layers,",
      accent: "one reputation.",
      items: [
        { maturity: "available", title: "Financial evidence", body: "Daily check-ins and financial records today. Verified transactions, repayment history and economic context later." },
        { maturity: "planned", title: "Repayment probability engine", body: "Versioned models that estimate repayment probability for a specific obligation." },
        { maturity: "planned", title: "Identity-bound reputation", body: "Non-transferable credentials linked to a verified business identity." },
        { maturity: "development", title: "Selective disclosure", body: "She authorizes what to share, instead of exposing her whole financial history." },
        { maturity: "planned", title: "Verifiable risk execution", body: "Institutions set eligibility policies as smart contracts, and anyone can verify they ran as written." },
      ],
    },
    diagram: {
      eyebrow: "Where data lives",
      columns: [
        { title: "Off-chain, private", items: ["Financial records", "Identity", "Models"] },
        { title: "On Solana, public", items: ["Commitments and proofs", "Policy execution", "Campaign vaults"] },
        { title: "Institutions", items: ["Define policies", "Verify execution", "Receive what she discloses"] },
      ],
    },
    limits: {
      eyebrow: "What we do not claim",
      title: "Honest",
      accent: "limits.",
      items: [
        "Sensitive financial data stays off-chain.",
        "A blockchain does not validate external data by itself.",
        "Model performance needs real-world validation.",
        "Zero-knowledge verification is a future capability.",
        "Smart contracts can verify on-chain policy execution.",
        "Selective disclosure does not remove compliance obligations.",
      ],
    },
    roadmap: {
      eyebrow: "Roadmap",
      title: "Now, next,",
      accent: "later.",
      phases: [
        { when: "Now", items: ["Financial diary on the web and in the apps", "Campaign vaults on Solana devnet"] },
        { when: "Next", items: ["First sponsored campaigns", "Reward settlement", "Activation verification", "Business passport"] },
        { when: "Later", items: ["Repayment probability models", "Identity-bound credentials", "Verifiable institutional risk policies"] },
      ],
    },
    contact: {
      eyebrow: "Contact",
      title: "Build it",
      accent: "with us.",
      body: "Investors, financial institutions, developers and Web3 partners: tell us what you are working on.",
    },
  },

  form: {
    org: "Organization",
    orgPlaceholder: "Your organization",
    name: "Name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@organization.com",
    objective: "Objective",
    objectives: {
      impact: "An impact campaign",
      activation: "An activation campaign",
      partnership: "A partnership or integration",
      investment: "Investment",
      other: "Something else",
    },
    message: "Message (optional)",
    messagePlaceholder: "Audience, timing, anything we should know",
    send: "Send",
    sending: "Sending…",
    orWrite: "or write to",
    sent: { title: "Message sent", desc: "We'll reply shortly." },
    failed: { title: "Could not send", desc: "Please try again in a moment." },
    invalid: "Check the fields",
    errors: { org: "Enter your organization", name: "Enter your name", email: "Invalid email", long: "Max 1,500 characters" },
  },
};

export type SiteContent = typeof en;

const pt: SiteContent = {
  nav: {
    links: [
      { label: "Início", key: "home" },
      { label: "Empreendedoras", key: "entrepreneurs" },
      { label: "Patrocinadores", key: "sponsors" },
      { label: "Protocolo", key: "protocol" },
      { label: "Sobre", key: "about" },
    ],
    primary: "Seja parceiro",
    app: "Plataforma · Devnet",
    menu: "Menu",
  },
  footer: {
    tagline: "Ferramentas financeiras simples e oportunidades patrocinadas para mulheres que empreendem.",
    positioning: "Brasil primeiro · Feito com empreendedoras",
    product: "Produto",
    company: "Empresa",
    legal: "Legal",
    missionsDemo: "Missões · demonstração na devnet",
    sources: "Evidências e fontes",
    contact: "Contato",
    language: "English",
    notices: [
      "Nada neste site é oferta de valores mobiliários, crédito ou produto financeiro. A EmpowerFI não opera atividade licenciada de empréstimo ou investimento.",
      "As recompensas das campanhas ainda não estão no ar. O cofre das campanhas é demonstrado na devnet da Solana, com tokens de teste sem valor. Toda recompensa depende das regras de cada campanha.",
    ],
    rights: "Todos os direitos reservados.",
  },

  home: {
    seo: {
      title: "EmpowerFI — Ferramentas financeiras e campanhas patrocinadas para quem empreende",
      description: "Ferramentas financeiras simples e oportunidades patrocinadas para mulheres que empreendem. Organize vendas e gastos, veja seu lucro e participe de campanhas com recompensas.",
    },
    hero: {
      eyebrow: "Para mulheres que empreendem",
      title: "Organize. Participe.",
      accent: "Prospere.",
      body: "Ferramentas financeiras simples e oportunidades patrocinadas para mulheres que empreendem.",
      primary: "Sou empreendedora",
      secondary: "Quero patrocinar",
      shotAlt: "O diário EmpowerFI: vendas, gastos, salário e lucro do mês",
      shotNote: "O diário EmpowerFI · dados ilustrativos",
    },
    tools: {
      eyebrow: "Ferramentas financeiras",
      title: "Conheça seus números.",
      accent: "Faça seu negócio crescer.",
      items: [
        { maturity: "available", title: "Lucro do mês, simples", body: "Vendas, gastos e o que sobra, contando o salário que você precisa. Simples, não é contabilidade." },
        { maturity: "available", title: "Registro do dia", body: "Um minuto por dia para criar o hábito, com uma leitura curta da sua semana." },
        { maturity: "development", title: "Passaporte do negócio", body: "Resumos mensais comprováveis, que você escolhe compartilhar." },
      ],
      shotAlt: "O resumo do dia no diário EmpowerFI: vendas, gastos e lucro",
    },
    campaigns: {
      eyebrow: "Missões EmpowerFI",
      title: "Sua participação pode",
      accent: "gerar oportunidades.",
      body: "Organizações patrocinam campanhas que incentivam bons hábitos financeiros e recompensam quem cumpre.",
      kinds: [
        { maturity: "devnet", title: "Marketing de impacto", body: "O patrocinador apoia o cuidado com as finanças e o crescimento do negócio." },
        { maturity: "development", title: "Marketing de ativação", body: "O patrocinador apoia o engajamento junto com a ativação de um produto ou serviço." },
      ],
      facts: ["30 dias", "100+ empreendedoras", "Preço por participante", "Recompensas condicionais"],
    },
    how: {
      eyebrow: "Como funciona",
      title: "Participe. Complete.",
      accent: "Receba.",
      split: [
        { share: "50%", label: "para a EmpowerFI" },
        { share: "50%", label: "reservados para as recompensas das empreendedoras" },
      ],
      rules: [
        { title: "Marketing de impacto", body: "A recompensa vem depois de cumprir os 30 dias. O que não for resgatado fica com a EmpowerFI, pelas regras propostas." },
        { title: "Marketing de ativação", body: "A recompensa também exige uma ativação verificada, definida pelo patrocinador. O que não for resgatado volta para ele." },
      ],
      caveat: "A recompensa depende das condições de cada campanha. Só se inscrever não garante nada.",
      demo: "Ver a demonstração na devnet",
    },
    tech: {
      eyebrow: "Tecnologia e visão",
      title: "Dados privados.",
      accent: "Regras verificáveis por todos.",
      items: [
        { maturity: "devnet", title: "Agora: recompensas programáveis", body: "Cofres de campanha na Solana deixam as regras de divisão e de pagamento transparentes. Demonstrado na devnet." },
        { maturity: "planned", title: "Depois: reputação financeira programável", body: "Credenciais do negócio comprováveis, probabilidade de pagamento e compartilhamento seletivo, com políticas que as instituições podem verificar." },
      ],
      cta: "Conheça o Protocolo",
    },
    traction: {
      eyebrow: "Tração",
      title: "Construindo com",
      accent: "empreendedoras de verdade.",
      items: [
        { tag: "No ar", title: "Apps no Google Play e na App Store", body: "Publicados no Brasil.", stores: true },
        { tag: "No ar", title: "O diário EmpowerFI na web", body: "Registro do dia, lucro do mês e leitura da semana." },
        { tag: "Devnet", title: "Cofres de campanha na Solana", body: "Construídos e testados; demonstrados na devnet com tokens de teste." },
        { tag: "Sebrae", title: "Construída e refinada com o Sebrae", body: "Ginga Prototipa e PIER.", logo: "sebrae" },
        { tag: "Unicamp", title: "Uma empresa-filha da Unicamp", body: "Registrada na Unicamp Ventures.", logo: "unicamp" },
      ],
      join: "Quero participar",
      partner: "Seja parceiro",
    },
  },

  entrepreneurs: {
    seo: {
      title: "EmpowerFI para empreendedoras — organize o negócio e participe de campanhas",
      description: "Anote vendas e gastos, veja o lucro do mês, crie o hábito com o registro do dia e participe de campanhas patrocinadas com recompensas. Grátis.",
    },
    hero: {
      eyebrow: "Para empreendedoras",
      title: "Seu negócio",
      accent: "merece crescer.",
      body: "Organize suas finanças, participe de oportunidades e acompanhe a evolução do seu negócio.",
      primary: "Começar meu diário",
      stores: "Ou baixe o app:",
    },
    tools: {
      eyebrow: "Para usar hoje",
      title: "Seus números,",
      accent: "em um minuto por dia.",
      items: [
        { maturity: "available", title: "Vendas e gastos", body: "Anote cada venda e cada gasto falando ou digitando: dinheiro, Pix ou cartão, à vista ou parcelado." },
        { maturity: "available", title: "O lucro do seu mês", body: "Diga quanto você precisa para passar o mês. Você vê o que sobra depois dos gastos e do seu salário." },
        { maturity: "available", title: "Registro do dia e lembretes", body: "Um lembrete na hora que você escolher, só nos dias em que o seu negócio abre." },
        { maturity: "available", title: "A leitura da sua semana", body: "Uma leitura curta da semana, com uma ideia para testar. Escrita por IA só se você aceitar." },
      ],
    },
    campaigns: {
      eyebrow: "Campanhas patrocinadas",
      title: "Sua participação pode",
      accent: "gerar oportunidades.",
      steps: [
        { title: "Entre numa campanha aberta", body: "As campanhas abertas aparecem no seu diário." },
        { title: "Cumpra as atividades", body: "Registre o seu dia durante os 30 dias da campanha." },
        { title: "Receba a recompensa", body: "Só se todas as condições da campanha forem cumpridas." },
      ],
      maturity: "devnet" as Maturity,
      caveat: "As recompensas das campanhas ainda não estão no ar. Nenhuma recompensa, renda ou aprovação de crédito é garantida.",
    },
    history: {
      eyebrow: "Com o tempo",
      title: "A história do",
      accent: "seu negócio.",
      body: "Cada dia registrado vira a história do seu negócio. Mais adiante, você vai poder compartilhar resumos comprováveis dela, só quando quiser.",
      maturity: "development" as Maturity,
    },
    privacy: { title: "Seus dados são seus.", body: "Nunca vendemos. Patrocinadores só veem totais de pelo menos cinco empreendedoras.", link: "Política de privacidade" },
    cta: { title: "Comece hoje. É grátis.", primary: "Começar meu diário" },
  },

  sponsors: {
    seo: {
      title: "Patrocine uma campanha — Missões EmpowerFI",
      description: "Alcance e engaje mulheres que empreendem com campanhas de 30 dias mensuráveis e recompensas condicionais, com preço por participante. Campanhas de impacto e de ativação.",
    },
    hero: {
      eyebrow: "Para patrocinadores",
      title: "Transforme engajamento em",
      accent: "impacto mensurável.",
      body: "Campanhas patrocinadas que conectam organizações a mulheres que empreendem, com engajamento medido e recompensas condicionais.",
      primary: "Lançar uma campanha",
    },
    products: {
      eyebrow: "Dois produtos",
      title: "Impacto ou",
      accent: "ativação.",
      columns: ["", "Marketing de impacto", "Marketing de ativação"],
      rows: [
        ["Para quem", "Inclusão financeira, empreendedorismo e impacto social", "Fintechs, meios de pagamento, bancos digitais e protocolos Web3"],
        ["A recompensa desbloqueia depois de", "30 dias de engajamento", "30 dias de engajamento e uma ativação verificada"],
        ["Recompensas não resgatadas", "Ficam com a EmpowerFI", "Voltam ao patrocinador"],
        ["Situação", "Demonstração na devnet", "Em desenvolvimento"],
      ],
    },
    format: {
      eyebrow: "O formato",
      title: "Simples de contratar,",
      accent: "simples de medir.",
      items: [
        { title: "Campanhas de 30 dias", body: "Uma janela clara de engajamento." },
        { title: "Mínimo de 100 participantes", body: "Preço por empreendedora." },
        { title: "Recompensas condicionais", body: "Pagas só quando as condições da campanha são cumpridas." },
        { title: "Relatório de engajamento", body: "Participação e conclusão, em totais a partir de cinco empreendedoras." },
        { title: "Verificação de ativação", body: "Nas campanhas de ativação. Em desenvolvimento." },
        { title: "Regras de pagamento transparentes", body: "Gravadas na blockchain antes de a campanha começar." },
      ],
    },
    vault: {
      eyebrow: "Por dentro",
      title: "Um cofre para",
      accent: "cada campanha.",
      body: "O patrocínio fica num cofre na Solana que pertence à própria campanha. A divisão e a regra de desbloqueio ficam gravadas ali, e qualquer pessoa pode conferir.",
      demo: "Ver a demonstração na devnet",
    },
    contact: {
      eyebrow: "Contato",
      title: "Lance uma",
      accent: "campanha patrocinada.",
      body: "Conte o que você quer alcançar. Respondemos a todas as mensagens.",
    },
  },

  protocol: {
    seo: {
      title: "Protocolo EmpowerFI — reputação financeira programável",
      description: "Reputação financeira programável e privada: dados privados, regras verificáveis por todos. A infraestrutura de longo prazo da EmpowerFI, e o que existe hoje.",
    },
    hero: {
      eyebrow: "Protocolo EmpowerFI",
      title: "Reputação financeira",
      accent: "programável.",
      body: "Dados privados. Regras verificáveis por todos.",
      intro: "Nossa infraestrutura de longo prazo: transformar a atividade do negócio em inteligência financeira comprovável, sem expor o negócio por trás dela.",
    },
    layers: {
      eyebrow: "A arquitetura",
      title: "Cinco camadas,",
      accent: "uma reputação.",
      items: [
        { maturity: "available", title: "Evidência financeira", body: "Registro do dia e controle financeiro hoje. Transações verificadas, histórico de pagamento e contexto econômico depois." },
        { maturity: "planned", title: "Motor de probabilidade de pagamento", body: "Modelos versionados que estimam a probabilidade de pagamento de uma obrigação específica." },
        { maturity: "planned", title: "Reputação ligada à identidade", body: "Credenciais intransferíveis, ligadas à identidade verificada do negócio." },
        { maturity: "development", title: "Compartilhamento seletivo", body: "Ela autoriza o que compartilhar, em vez de expor todo o histórico financeiro." },
        { maturity: "planned", title: "Execução de risco verificável", body: "Instituições definem políticas de elegibilidade em contratos inteligentes, e qualquer pessoa confere que rodaram como escritas." },
      ],
    },
    diagram: {
      eyebrow: "Onde ficam os dados",
      columns: [
        { title: "Fora da blockchain, privado", items: ["Registros financeiros", "Identidade", "Modelos"] },
        { title: "Na Solana, público", items: ["Compromissos e provas", "Execução das políticas", "Cofres de campanha"] },
        { title: "Instituições", items: ["Definem políticas", "Verificam a execução", "Recebem o que ela compartilha"] },
      ],
    },
    limits: {
      eyebrow: "O que não afirmamos",
      title: "Limites",
      accent: "honestos.",
      items: [
        "Dados financeiros sensíveis ficam fora da blockchain.",
        "A blockchain não valida sozinha dados externos.",
        "O desempenho dos modelos precisa de validação no mundo real.",
        "Verificação com conhecimento zero é uma capacidade futura.",
        "Contratos inteligentes conseguem verificar a execução das políticas na blockchain.",
        "Compartilhamento seletivo não elimina obrigações regulatórias.",
      ],
    },
    roadmap: {
      eyebrow: "Roteiro",
      title: "Agora, a seguir,",
      accent: "depois.",
      phases: [
        { when: "Agora", items: ["Diário financeiro na web e nos apps", "Cofres de campanha na devnet da Solana"] },
        { when: "A seguir", items: ["Primeiras campanhas patrocinadas", "Pagamento das recompensas", "Verificação de ativação", "Passaporte do negócio"] },
        { when: "Depois", items: ["Modelos de probabilidade de pagamento", "Credenciais ligadas à identidade", "Políticas de risco verificáveis"] },
      ],
    },
    contact: {
      eyebrow: "Contato",
      title: "Construa",
      accent: "com a gente.",
      body: "Investidores, instituições financeiras, desenvolvedores e parceiros Web3: conte no que vocês estão trabalhando.",
    },
  },

  form: {
    org: "Organização",
    orgPlaceholder: "Sua organização",
    name: "Nome",
    namePlaceholder: "Seu nome",
    email: "E-mail",
    emailPlaceholder: "voce@organizacao.com",
    objective: "Objetivo",
    objectives: {
      impact: "Uma campanha de impacto",
      activation: "Uma campanha de ativação",
      partnership: "Uma parceria ou integração",
      investment: "Investimento",
      other: "Outro assunto",
    },
    message: "Mensagem (opcional)",
    messagePlaceholder: "Público, prazo, o que for importante",
    send: "Enviar",
    sending: "Enviando…",
    orWrite: "ou escreva para",
    sent: { title: "Mensagem enviada", desc: "Respondemos em breve." },
    failed: { title: "Não foi possível enviar", desc: "Tente de novo daqui a pouco." },
    invalid: "Confira os campos",
    errors: { org: "Informe a organização", name: "Informe seu nome", email: "E-mail inválido", long: "Máximo de 1.500 caracteres" },
  },
};

export const SITE: Record<Lang, SiteContent> = { en, pt };
