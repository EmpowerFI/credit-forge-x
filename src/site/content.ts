// The corporate site's words, in both languages: one structure, so both say
// the same product maturity, the same campaign rules and the same vision.
// Portuguese is written for the woman who runs the business; English for
// sponsors, fintechs, investors and Web3 partners. Neither is a translation.
//
// Maturity is said beside every claim, in one of four words (MATURITY).

export type Lang = "en" | "pt";
export type Maturity = "available" | "devnet" | "development" | "planned";

export const PATHS = {
  en: { home: "/en", entrepreneurs: "/entrepreneurs", sponsors: "/sponsors", protocol: "/protocol", about: "/about", privacy: "/privacy", terms: "/terms" },
  pt: { home: "/", entrepreneurs: "/pt/empreendedoras", sponsors: "/pt/patrocinadores", protocol: "/pt/protocolo", about: "/pt/sobre", privacy: "/privacidade", terms: "/termos" },
} as const;

/** The diary on the web, and the devnet demo of the campaign vault. */
export const DIARY_PATH = "/app/diario";
/**
 * The diary opens little by little (founder, 12/11/2026): the site no longer
 * links to it and offers this waitlist, on the Entrepreneurs page.
 */
export const WAITLIST_ANCHOR = "lista-de-espera";
/** The reserved impact area: each sponsor signs in with the e-mail EmpowerFI authorised and sees its own campaigns. */
export const IMPACT_AREA_PATH = "/impacto";
export const MISSIONS_DEMO_PATH = "/app/missions";
/** The About pages' strategic partnerships section, linked from the home page. */
export const PARTNERSHIPS_ANCHOR = "parcerias-estrategicas";
/** The About pages' awards section, linked from the home page. */
export const AWARDS_ANCHOR = "premios";
/** The two Superteam Earn listings EmpowerFI won. */
export const AWARD_URLS = {
  dev3pack: "https://superteam.fun/earn/listing/dev3pack-solana-build-challenge",
  privacyWeek: "https://superteam.fun/earn/listing/privacy-week-premiacao-dos-vencedores",
} as const;

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
    primary: "Become a Sponsor",
    sponsorArea: "Sponsor area",
    app: "Platform",
    menu: "Menu",
  },
  waitlist: {
    eyebrow: "Waitlist",
    title: "Access opens",
    accent: "little by little.",
    body: "The diary is opening to one group of entrepreneurs at a time. Leave your details and we will let you know when it is your turn.",
    name: "Name",
    email: "E-mail",
    sells: "What you sell",
    sellsPlaceholder: "Cakes and sweets, clothes, beauty services…",
    city: "City",
    state: "State",
    statePlaceholder: "State",
    consent: "I agree to be contacted by EmpowerFI about access to the diary.",
    submit: "Join the waitlist",
    sending: "Sending…",
    sent: { title: "You are on the list.", desc: "We will write to you when it is your turn." },
    already: { title: "You were already on the list.", desc: "We will write to you when it is your turn." },
    failed: { title: "It did not go through.", desc: "Try again in a moment, or write to us." },
    invalid: "Fill in every field and accept to be contacted.",
    link: "Join the waitlist",
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
      "In today's campaigns, EmpowerFI pays each reward directly to the entrepreneur who meets the conditions. Payment through the campaign vault on Solana is still demonstrated on devnet, with test tokens that have no value, until it is ready for mainnet. Rewards always depend on each campaign's eligibility rules.",
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
      title: "Engagement that",
      accent: "drives impact.",
      body: "Organizations sponsor 30-day financial engagement journeys, with conditional rewards for the entrepreneurs who take part.",
      product: "Impact Marketing",
      maturity: "available" as Maturity,
      facts: ["30 days", "100+ entrepreneurs", "Priced per participant", "Conditional rewards"],
    },
    how: {
      eyebrow: "How it works",
      title: "How rewards",
      accent: "work.",
      split: [
        { share: "50%", label: "allocated to EmpowerFI" },
        { share: "50%", label: "reserved for entrepreneur rewards" },
      ],
      rules: [
        { title: "When a reward unlocks", body: "After she completes the campaign's 30-day engagement requirements." },
        { title: "Unclaimed rewards", body: "Under the currently proposed model, they are allocated to EmpowerFI according to the campaign terms." },
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
        { tag: "Live", title: "The EmpowerFI diary on the web", body: "Daily records, the month's profit and a weekly reading.", diary: true },
        { tag: "Devnet", title: "Campaign vaults on Solana", body: "Built and tested; demonstrated on devnet with test tokens." },
        { tag: "Sebrae", title: "Built and refined with Sebrae", body: "Ginga Prototipa and PIER.", logo: "sebrae" },
        { tag: "Unicamp", title: "An empresa-filha of Unicamp", body: "Registered in Unicamp Ventures.", logo: "unicamp" },
      ],
      join: "For Entrepreneurs",
      partner: "Become a Sponsor",
      partnerships: {
        title: "Strategic partnerships",
        body: "We also work with fintechs, payment providers, neobanks and Web3 protocols to connect entrepreneurs with relevant financial products and services. This is ecosystem development, not a sponsorship product.",
        cta: "Explore a Partnership",
      },
      awards: {
        title: "Awards",
        items: [
          { place: "1st place", title: "Dev3pack Solana Build Challenge", by: "Dev3pack, with Superteam Brasil and SheFi Brasil", href: AWARD_URLS.dev3pack },
          { place: "1st place", title: "Privacy Week: privacy with Cloak and Zcash", by: "Superteam Brasil", href: AWARD_URLS.privacyWeek },
        ],
        cta: "See the awards",
      },
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
      primary: "Join the waitlist",
    },
    video: "A short film of the EmpowerFI diary: noting a sale, the month's profit after your salary, and the tip of the week.",
    tools: {
      eyebrow: "What you can use today",
      title: "Your numbers,",
      accent: "in one minute a day.",
      items: [
        { maturity: "available", title: "Sales and expenses", body: "Note each sale and expense by voice or by typing, cash, Pix or card, paid now or in instalments." },
        { maturity: "available", title: "Your month's profit", body: "Enter your monthly salary. You see what is left after expenses and after your salary." },
        { maturity: "available", title: "Daily check-ins and reminders", body: "A reminder at the time you choose, and only on the days your business opens." },
        { maturity: "available", title: "Your week, read", body: "A short reading of your week, with one thing to try. Written by AI only if you agree." },
      ],
    },
    campaigns: {
      eyebrow: "Sponsored campaigns",
      title: "Your participation can",
      accent: "open doors.",
      steps: [
        { title: "Share your impact figures", body: "Choose it in your diary. Then you take part in the sponsored campaigns." },
        { title: "Record the days you open", body: "For the campaign's 30 days, record your sales and expenses on every day your business opens. Days off need nothing." },
        { title: "Receive your reward", body: "Only if every condition of the campaign is met." },
      ],
      maturity: "available" as Maturity,
      caveat: "EmpowerFI pays the rewards directly to you; payment on Solana is still a devnet demo. No reward, income or credit approval is guaranteed.",
    },
    history: {
      eyebrow: "Over time",
      title: "A history of",
      accent: "your business.",
      body: "Each day you record becomes your business's history. Later, you will be able to share verifiable summaries of it, only when you choose.",
      maturity: "development" as Maturity,
    },
    privacy: { title: "Your data is yours.", body: "We never sell it. Sponsors only see totals from at least five entrepreneurs.", link: "Privacy policy" },
    cta: { title: "Free, and opening soon.", primary: "Join the waitlist" },
  },

  sponsors: {
    seo: {
      title: "Sponsor an Impact Marketing campaign — EmpowerFI",
      description: "Support women entrepreneurs through measurable 30-day financial engagement campaigns with conditional rewards, priced per entrepreneur, with transparent allocation rules.",
    },
    hero: {
      eyebrow: "For sponsors",
      title: "Sponsor engagement.",
      accent: "Create lasting impact.",
      body: "Support women entrepreneurs through measurable financial engagement campaigns and conditional rewards.",
      primary: "Sponsor an Impact Campaign",
      signIn: "Already a sponsor? See your campaign",
    },
    format: {
      eyebrow: "The offering",
      title: "Impact Marketing",
      accent: "campaigns.",
      body: "One sponsorship product: a structured engagement campaign that helps women entrepreneurs build financial habits and organize their business.",
      maturity: "available" as Maturity,
      items: [
        { title: "30-day financial engagement", body: "One clear window: she records her sales and expenses on every day her business opens." },
        { title: "Minimum 100 entrepreneurs", body: "Priced per entrepreneur." },
        { title: "Conditional rewards", body: "Half of the sponsorship is reserved for the entrepreneurs who complete the requirements." },
        { title: "Engagement reporting", body: "Participation and completion, in totals from five entrepreneurs up." },
        { title: "Transparent allocation", body: "50% to EmpowerFI, 50% to entrepreneur rewards, written into the campaign." },
        { title: "Clear settlement rules", body: "Unclaimed rewards go to EmpowerFI under the campaign terms, set before it starts." },
      ],
    },
    vault: {
      eyebrow: "Under the hood",
      title: "A vault for",
      accent: "every campaign.",
      body: "Today EmpowerFI pays the rewards directly. Next, the sponsorship will sit in a Solana vault owned by the campaign itself, with the split and the unlock rule written there, readable by anyone. It is demonstrated on devnet until it is ready for mainnet.",
      demo: "See the devnet demo",
    },
    contact: {
      eyebrow: "Contact",
      title: "Sponsor an",
      accent: "impact campaign.",
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
        { when: "Now", items: ["Financial diary on the web", "Sponsored campaigns, rewards paid by EmpowerFI", "Campaign vaults on Solana devnet"] },
        { when: "Next", items: ["Reward settlement on Solana mainnet", "Business passport"] },
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
      partnership: "A strategic partnership",
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
    primary: "Quero patrocinar",
    sponsorArea: "Área do patrocinador",
    app: "Plataforma",
    menu: "Menu",
  },
  waitlist: {
    eyebrow: "Lista de espera",
    title: "O acesso abre",
    accent: "aos poucos.",
    body: "O diário está abrindo para um grupo de empreendedoras por vez. Deixe seus dados e avisamos quando chegar a sua vez.",
    name: "Nome",
    email: "E-mail",
    sells: "O que você vende",
    sellsPlaceholder: "Bolos e doces, roupas, serviços de beleza…",
    city: "Cidade",
    state: "Estado",
    statePlaceholder: "UF",
    consent: "Aceito receber contato da EmpowerFI sobre o acesso ao diário.",
    submit: "Entrar na lista de espera",
    sending: "Enviando…",
    sent: { title: "Você está na lista.", desc: "Vamos escrever para você quando chegar a sua vez." },
    already: { title: "Você já estava na lista.", desc: "Vamos escrever para você quando chegar a sua vez." },
    failed: { title: "Não deu certo.", desc: "Tente de novo daqui a pouco, ou escreva para a gente." },
    invalid: "Preencha todos os campos e aceite receber contato.",
    link: "Entrar na lista de espera",
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
      "Nas campanhas de hoje, a EmpowerFI paga cada recompensa diretamente à empreendedora que cumpre as condições. O pagamento pelo cofre da campanha na Solana segue em demonstração na devnet, com tokens de teste sem valor, até estar pronto para a mainnet. Toda recompensa depende das regras de cada campanha.",
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
      title: "Engajamento que",
      accent: "gera impacto.",
      body: "Organizações patrocinam jornadas de 30 dias de cuidado com as finanças, com recompensas condicionais para quem participa.",
      product: "Marketing de impacto",
      maturity: "available" as Maturity,
      facts: ["30 dias", "100+ empreendedoras", "Preço por participante", "Recompensas condicionais"],
    },
    how: {
      eyebrow: "Como funciona",
      title: "Como funcionam",
      accent: "as recompensas.",
      split: [
        { share: "50%", label: "para a EmpowerFI" },
        { share: "50%", label: "reservados para as recompensas das empreendedoras" },
      ],
      rules: [
        { title: "Quando a recompensa libera", body: "Depois que ela cumpre os 30 dias de engajamento da campanha." },
        { title: "Recompensas não resgatadas", body: "No modelo proposto hoje, ficam com a EmpowerFI, conforme os termos da campanha." },
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
        { tag: "No ar", title: "O diário EmpowerFI na web", body: "Registro do dia, lucro do mês e leitura da semana.", diary: true },
        { tag: "Devnet", title: "Cofres de campanha na Solana", body: "Construídos e testados; demonstrados na devnet com tokens de teste." },
        { tag: "Sebrae", title: "Construída e refinada com o Sebrae", body: "Ginga Prototipa e PIER.", logo: "sebrae" },
        { tag: "Unicamp", title: "Uma empresa-filha da Unicamp", body: "Registrada na Unicamp Ventures.", logo: "unicamp" },
      ],
      join: "Sou empreendedora",
      partner: "Quero patrocinar",
      partnerships: {
        title: "Parcerias estratégicas",
        body: "Também trabalhamos com fintechs, meios de pagamento, bancos digitais e protocolos Web3 para levar às empreendedoras produtos e serviços financeiros que fazem sentido para elas. É desenvolvimento do ecossistema, não um produto de patrocínio.",
        cta: "Propor uma parceria",
      },
      awards: {
        title: "Prêmios",
        items: [
          { place: "1º lugar", title: "Dev3pack Solana Build Challenge", by: "Dev3pack, com Superteam Brasil e SheFi Brasil", href: AWARD_URLS.dev3pack },
          { place: "1º lugar", title: "Privacy Week: privacidade com Cloak e Zcash", by: "Superteam Brasil", href: AWARD_URLS.privacyWeek },
        ],
        cta: "Ver os prêmios",
      },
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
      primary: "Entrar na lista de espera",
    },
    video: "Um filme curto do diário EmpowerFI: anotar uma venda, o lucro do mês depois do seu salário e a dica da semana.",
    tools: {
      eyebrow: "Para usar hoje",
      title: "Seus números,",
      accent: "em um minuto por dia.",
      items: [
        { maturity: "available", title: "Vendas e gastos", body: "Anote cada venda e cada gasto falando ou digitando: dinheiro, Pix ou cartão, à vista ou parcelado." },
        { maturity: "available", title: "O lucro do seu mês", body: "Coloque o seu salário mensal. Você vê o que sobra depois dos gastos e do seu salário." },
        { maturity: "available", title: "Registro do dia e lembretes", body: "Um lembrete na hora que você escolher, só nos dias em que o seu negócio abre." },
        { maturity: "available", title: "A leitura da sua semana", body: "Uma leitura curta da semana, com uma ideia para testar. Escrita por IA só se você aceitar." },
      ],
    },
    campaigns: {
      eyebrow: "Campanhas patrocinadas",
      title: "Sua participação pode",
      accent: "gerar oportunidades.",
      steps: [
        { title: "Autorize os números de impacto", body: "É uma escolha no seu diário. Com ela, você participa das campanhas patrocinadas." },
        { title: "Registre os dias em que abre", body: "Nos 30 dias da campanha, anote vendas e gastos em todos os dias em que o seu negócio abre. No dia de descanso, não precisa registrar." },
        { title: "Receba a recompensa", body: "Só se todas as condições da campanha forem cumpridas." },
      ],
      maturity: "available" as Maturity,
      caveat: "A EmpowerFI paga a recompensa diretamente a você; o pagamento pela Solana ainda é uma demonstração na devnet. Nenhuma recompensa, renda ou aprovação de crédito é garantida.",
    },
    history: {
      eyebrow: "Com o tempo",
      title: "A história do",
      accent: "seu negócio.",
      body: "Cada dia registrado vira a história do seu negócio. Mais adiante, você vai poder compartilhar resumos comprováveis dela, só quando quiser.",
      maturity: "development" as Maturity,
    },
    privacy: { title: "Seus dados são seus.", body: "Nunca vendemos. Patrocinadores só veem totais de pelo menos cinco empreendedoras.", link: "Política de privacidade" },
    cta: { title: "Grátis, e abrindo em breve.", primary: "Entrar na lista de espera" },
  },

  sponsors: {
    seo: {
      title: "Patrocine uma campanha de Marketing de Impacto — EmpowerFI",
      description: "Apoie mulheres que empreendem com campanhas de 30 dias de engajamento financeiro mensurável e recompensas condicionais, com preço por empreendedora e regras de divisão transparentes.",
    },
    hero: {
      eyebrow: "Para patrocinadores",
      title: "Patrocine engajamento.",
      accent: "Crie impacto duradouro.",
      body: "Apoie mulheres que empreendem com campanhas de engajamento financeiro mensurável e recompensas condicionais.",
      primary: "Patrocinar uma campanha",
      signIn: "Já patrocina? Veja sua campanha",
    },
    format: {
      eyebrow: "A oferta",
      title: "Campanhas de",
      accent: "Marketing de Impacto.",
      body: "Um único produto de patrocínio: uma campanha estruturada de engajamento que ajuda mulheres que empreendem a criar hábitos financeiros e organizar o negócio.",
      maturity: "available" as Maturity,
      items: [
        { title: "30 dias de engajamento financeiro", body: "Uma janela clara: ela registra vendas e gastos em todos os dias em que o negócio dela abre." },
        { title: "Mínimo de 100 empreendedoras", body: "Preço por empreendedora." },
        { title: "Recompensas condicionais", body: "Metade do patrocínio fica reservada para quem cumpre as condições." },
        { title: "Relatório de engajamento", body: "Participação e conclusão, em totais a partir de cinco empreendedoras." },
        { title: "Divisão transparente", body: "50% para a EmpowerFI e 50% para as recompensas, gravados na campanha." },
        { title: "Regras claras de pagamento", body: "O que não for resgatado fica com a EmpowerFI, pelos termos definidos antes do início." },
      ],
    },
    vault: {
      eyebrow: "Por dentro",
      title: "Um cofre para",
      accent: "cada campanha.",
      body: "Hoje a EmpowerFI paga as recompensas diretamente. A seguir, o patrocínio vai ficar num cofre na Solana que pertence à própria campanha, com a divisão e a regra de desbloqueio gravadas ali, e qualquer pessoa pode conferir. Ele segue em demonstração na devnet até estar pronto para a mainnet.",
      demo: "Ver a demonstração na devnet",
    },
    contact: {
      eyebrow: "Contato",
      title: "Patrocine uma",
      accent: "campanha de impacto.",
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
        { when: "Agora", items: ["Diário financeiro na web", "Campanhas patrocinadas, recompensas pagas pela EmpowerFI", "Cofres de campanha na devnet da Solana"] },
        { when: "A seguir", items: ["Pagamento das recompensas na mainnet da Solana", "Passaporte do negócio"] },
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
      partnership: "Uma parceria estratégica",
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
