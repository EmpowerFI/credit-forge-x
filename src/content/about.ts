import {
  BarChart3,
  Building2,
  Eye,
  FileQuestion,
  GraduationCap,
  Handshake,
  Heart,
  Landmark,
  Layers,
  Lightbulb,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import advisorFernando from "@/assets/advisor-fernando-blanco.webp";
import advisorRoberta from "@/assets/advisor-roberta-stock.webp";
import { SEBRAE_LOGO_SRC, UNICAMP_SEAL_SRC, UNICAMP_VENTURES_URL } from "@/config/links";

const ROBERTA_LINKEDIN_URL = "https://www.linkedin.com/in/robertastock/";
const ROBERTA_WEBSITE = { href: "https://www.triunna.com.br/", label: "triunna.com.br" };
const FERNANDO_LINKEDIN_URL = "https://www.linkedin.com/in/fernando-blanco/";

// Content for the institutional /about (EN) and /pt/sobre (PT) routes.
//
// The rest of this codebase duplicates each section into Section.tsx +
// SectionEn.tsx. That pattern costs ~20 near-identical files for the ten
// sections here, so /about instead keeps one set of presentational components
// under components/about/ and feeds them from these dictionaries. The
// AboutContent type is what keeps PT and EN from drifting apart: a section
// added to one language fails the build until the other has it too.

export interface AboutContent {
  meta: { title: string; description: string };
  nav: { links: { label: string; href: string }[]; home: string; langSwitch: string };
  hero: {
    badge: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    primaryCta: string;
    secondaryCta: string;
  };
  story: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    paragraphs: string[];
    pullQuote: string;
  };
  problem: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    stats: { value: string; label: string }[];
    /** Attribution for the stats above. */
    statsSource: string;
    items: { icon: LucideIcon; title: string; desc: string }[];
  };
  solution: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    steps: { icon: LucideIcon; title: string; desc: string; status: string; live?: boolean }[];
  };
  missionVision: {
    mission: { eyebrow: string; text: string };
    vision: { eyebrow: string; text: string };
  };
  values: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    items: { icon: LucideIcon; title: string; desc: string }[];
  };
  team: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    founder: {
      name: string;
      role: string;
      paragraphs: string[];
      /** Labelled lists under the bio: where she studied, where she worked. */
      facts: { label: string; items: string[] }[];
      linkedinLabel: string;
      instagramLabel: string;
      photoAlt: string;
    };
    advisory: {
      heading: string;
      /** Why these two: what each side of the board brings to the pilot. */
      note: string;
      linkedinLabel: string;
      advisors: {
        name: string;
        title: string;
        focus: string;
        bio: string;
        tags: string[];
        photo: string;
        photoAlt: string;
        linkedinUrl: string;
        website?: { href: string; label: string };
      }[];
    };
  };
  partners: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    testimonials: {
      quote: string;
      name: string;
      role: string;
      /** Shown when the quote is a translation of what the person said. */
      note?: string;
    }[];
  };
  recognitions: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    items: {
      icon: LucideIcon;
      title: string;
      desc: string;
      href?: string;
      linkLabel?: string;
      /** The app card links to both stores instead of a single one. */
      stores?: boolean;
      /** Third-party mark evidencing institutional backing, from /public. */
      logo?: { src: string; alt: string; label: string; large?: boolean };
    }[];
  };
  faq: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    /** An optional link shown under the answer; the answer text stands on its own for the FAQ JSON-LD. */
    items: { q: string; a: string; link?: { href: string; label: string } }[];
  };
  contact: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    emailLabel: string;
    form: {
      name: string;
      namePlaceholder: string;
      email: string;
      emailPlaceholder: string;
      message: string;
      messagePlaceholder: string;
      submit: string;
      sending: string;
      successTitle: string;
      successDesc: string;
      errorTitle: string;
      errorDesc: string;
      invalidTitle: string;
      validation: { name: string; nameMax: string; email: string; messageMin: string; messageMax: string };
    };
  };
  footer: {
    tagline: string;
    developedBy: string;
    cnpjLabel: string;
    privacy: string;
    terms: string;
    contact: string;
    rights: string;
    backToHome: string;
  };
}

export const aboutPt: AboutContent = {
  meta: {
    title: "Sobre a EmpowerFI — ferramentas financeiras e campanhas patrocinadas para quem empreende",
    description:
      "Conheça a EmpowerFI: ferramentas financeiras simples e campanhas patrocinadas para mulheres que empreendem no Brasil, e a infraestrutura de reputação financeira que estamos construindo. Fundada por Daniele Rodrigues dos Santos em São Paulo.",
  },
  nav: {
    links: [
      { label: "História", href: "#historia" },
      { label: "Problema", href: "#problema" },
      { label: "Solução", href: "#solucao" },
      { label: "Time", href: "#time" },
      { label: "Parceiros", href: "#parceiros" },
      { label: "Mídia", href: "#midia" },
      { label: "Contato", href: "#contato" },
    ],
    home: "Início",
    langSwitch: "EN",
  },
  hero: {
    badge: "Sobre a empresa",
    titleLead: "Ferramentas e oportunidades para ",
    titleAccent: "quem o sistema não enxerga",
    subtitle:
      "A EmpowerFI ajuda mulheres que empreendem a conhecer seus números e a participar de campanhas patrocinadas com recompensas. Ao longo do tempo, essa atividade vira uma reputação financeira que ela controla.",
    primaryCta: "Falar com a gente",
    secondaryCta: "Ver o aplicativo",
  },
  story: {
    eyebrow: "Nossa história",
    titleLead: "Começamos pelo que ",
    titleAccent: "ninguém estava enxergando",
    paragraphs: [
      "A EmpowerFI nasceu de uma constatação simples e incômoda: no Brasil, 9,96 milhões de empresas ativas são lideradas por mulheres, que sustentam suas famílias e movimentam a economia real — e continuam invisíveis para o sistema financeiro. Elas vendem, recebem, reinvestem e pagam suas contas em dia. Mas nada disso vira histórico. E, sem histórico, não existe crédito.",
      "Nossa fundadora passou mais de vinte anos construindo tecnologia e produtos digitais dentro de grandes empresas. Ao olhar de perto para esse mercado, encontrou um problema que não era de esforço nem de mérito: era de infraestrutura. Os modelos de risco dos bancos simplesmente não têm onde buscar dados sobre quem nunca teve conta empresarial, garantia formal ou balanço auditado. A empreendedora não é recusada porque é ruim pagadora — é recusada porque não existe para o modelo.",
      "Por isso começamos pelo que ela usa todo dia, e não pelo crédito. O diário EmpowerFI mostra vendas, gastos e o lucro do mês em um minuto por dia. Cada dia registrado vira o histórico que o banco nunca teve.",
      "Em seguida vêm as Missões: campanhas patrocinadas que recompensam quem cuida do negócio, com as regras gravadas num cofre na Solana. E, no longo prazo, o Protocolo: transformar esse histórico numa reputação financeira privada e comprovável, que ela decide quando compartilhar.",
    ],
    pullQuote:
      "Primeiro, ela conhece os próprios números. Depois, esse cuidado gera oportunidades. Com o tempo, vira uma reputação que ela controla.",
  },
  problem: {
    eyebrow: "O problema",
    titleLead: "O sistema financeiro ainda deixa milhões de ",
    titleAccent: "empreendedoras para trás",
    subtitle:
      "Não é falta de capacidade nem de disciplina. É uma falha estrutural de infraestrutura de dados — e ela se repete todos os dias.",
    stats: [
      { value: "9,96 mi", label: "empresas ativas no Brasil lideradas por mulheres — 39,7% do total" },
      { value: "2,6%", label: "das micro e pequenas empresas de propriedade feminina acessam empréstimos formais, contra 4,6% entre as de propriedade masculina" },
      { value: "US$ 15,8 bi", label: "de gap de financiamento estimado para micro e pequenas empresas de propriedade feminina no Brasil" },
    ],
    statsSource: "Fontes: MEMP / Mapa de Empresas (2026) e IFC/Sicredi (2025). O indicador de 2,6% mede acesso a empréstimos formais no recorte citado — não significa que as demais tiveram crédito negado.",
    items: [
      {
        icon: Landmark,
        title: "Dificuldade de acesso ao crédito",
        desc: "Quando o crédito aparece, vem caro e curto: cheque especial, cartão rotativo, agiota. A mesma empreendedora que paga em dia é empurrada para as linhas mais caras do mercado — porque originar e acompanhar um ticket pequeno custa quase o mesmo que um grande, e é esse custo, não ela, que define o preço.",
      },
      {
        icon: Eye,
        title: "Invisibilidade financeira",
        desc: "Vendas por Pix, maquininha e dinheiro vivo não deixam rastro utilizável. Do ponto de vista do banco, um negócio que funciona há anos e sustenta uma família inteira simplesmente não aparece — e o que não aparece não é analisado.",
      },
      {
        icon: FileQuestion,
        title: "Falta de histórico",
        desc: "Sem CNPJ movimentado, garantia formal ou balanço auditado, o modelo de risco não tem em que se apoiar. O resultado é um ciclo fechado: sem crédito não se constrói histórico, e sem histórico não se consegue crédito.",
      },
      {
        icon: TrendingDown,
        title: "Dificuldade de crescimento",
        desc: "Sem capital de giro, o negócio não compra estoque, não contrata e não atravessa um mês ruim. A empreendedora fica presa na escala da sobrevivência — não porque o negócio não funciona, mas porque falta o combustível para crescer.",
      },
    ],
  },
  solution: {
    eyebrow: "Nossa solução",
    titleLead: "O que existe hoje, ",
    titleAccent: "e o que vem depois",
    subtitle:
      "Começamos pelo que ela usa todo dia. Cada camada só existe porque a anterior funciona.",
    steps: [
      {
        icon: Smartphone,
        title: "Diário financeiro",
        status: "Disponível",
        live: true,
        desc: "Vendas, gastos e o lucro do mês, contando o salário que ela precisa. Um minuto por dia, com lembretes e uma leitura curta da semana.",
      },
      {
        icon: Sparkles,
        title: "Missões EmpowerFI",
        status: "Demonstração na devnet",
        desc: "Campanhas patrocinadas de 30 dias, com preço por empreendedora e recompensas condicionais. O cofre de cada campanha fica na Solana, com as regras gravadas.",
      },
      {
        icon: Layers,
        title: "Protocolo EmpowerFI",
        status: "Planejado",
        desc: "Reputação financeira programável: credenciais comprováveis, compartilhamento seletivo e políticas de risco que as instituições podem verificar. Os dados sensíveis ficam fora da blockchain.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Missão",
      text: "Dar a mulheres que empreendem ferramentas simples para conhecer seus números, e oportunidades que recompensam o cuidado com o negócio.",
    },
    vision: {
      eyebrow: "Visão",
      text: "Transformar a atividade de pequenos negócios em reputação financeira privada e comprovável, que ela controla e que as instituições podem verificar.",
    },
  },
  values: {
    eyebrow: "Nossos valores",
    titleLead: "O que orienta ",
    titleAccent: "cada decisão",
    subtitle: "Seis princípios que definem o que construímos — e, principalmente, o que recusamos construir.",
    items: [
      {
        icon: Users,
        title: "Inclusão",
        desc: "Projetamos para quem o sistema deixou de fora. Se a solução só funciona para quem já tem acesso, ela não resolve o problema que nos trouxe até aqui.",
      },
      {
        icon: Sparkles,
        title: "Tecnologia",
        desc: "Tecnologia como meio, nunca como vitrine. Cada peça precisa reduzir atrito real na vida de quem empreende, ou não entra no produto.",
      },
      {
        icon: Heart,
        title: "Comunidade",
        desc: "Empreendedoras crescem em rede. As campanhas e a comunidade as aproximam de oportunidades, porque o valor aparece quando a rede se fortalece junto.",
      },
      {
        icon: ScrollText,
        title: "Transparência",
        desc: "Sem letra miúda e sem número inflado. Falamos do que já está no ar e do que ainda é plano — e deixamos claro qual é qual.",
      },
      {
        icon: Handshake,
        title: "Impacto",
        desc: "Medimos sucesso por renda gerada e acesso conquistado. Impacto que não se verifica é marketing, não resultado.",
      },
      {
        icon: Lightbulb,
        title: "Inovação",
        desc: "O problema é antigo e as ferramentas convencionais já falharam nele. Construir um caminho novo é requisito, não ousadia.",
      },
    ],
  },
  team: {
    eyebrow: "Time",
    titleLead: "Execução técnica na fundação. ",
    titleAccent: "Mercado e educação financeira no conselho.",
    founder: {
      name: "Daniele Rodrigues dos Santos",
      role: "Fundadora & CEO",
      paragraphs: [
        "Daniele Rodrigues dos Santos é Engenheira da Computação formada pela Unicamp, com MBA em Big Data & Analytics e pós-graduação em Marketing pela FIA Business School. São mais de 20 anos de experiência em tecnologia: delivery, Big Data e machine learning, produto, marketing e infraestrutura.",
        "Construiu sua carreira em grandes empresas de tecnologia, como a Capgemini e a Dell Technologies, e fundou a EmpowerFI para conectar capital produtivo, dados e impacto econômico.",
      ],
      facts: [
        { label: "Formação", items: ["Unicamp", "FIA Business School"] },
        { label: "Trajetória", items: ["Capgemini", "Dell Technologies"] },
      ],
      linkedinLabel: "LinkedIn",
      instagramLabel: "Instagram",
      photoAlt: "Daniele Rodrigues dos Santos, fundadora e CEO da EmpowerFI",
    },
    advisory: {
      heading: "Conselho consultivo",
      note: "O conselho cobre as duas frentes que o piloto exige: acesso a instituições financeiras e governança de um lado, educação e gestão financeira da empreendedora do outro.",
      linkedinLabel: "LinkedIn",
      advisors: [
        {
          name: "Roberta Stock de Oliveira",
          title: "Conselheira",
          focus: "Gestão & educação financeira",
          bio: "Mais de 20 anos no mercado financeiro, de grandes instituições a projetos de impacto social e cultural. No Protagonismo Mulher, une gestão financeira estratégica, grandes eventos e redes de relacionamento, como no Fórum Brasil de Turismo Cultural.",
          tags: ["Educação financeira", "Impacto"],
          photo: advisorRoberta,
          photoAlt: "Roberta Stock de Oliveira, conselheira da EmpowerFI",
          linkedinUrl: ROBERTA_LINKEDIN_URL,
          website: ROBERTA_WEBSITE,
        },
        {
          name: "Fernando Blanco",
          title: "Conselheiro",
          focus: "Mercado financeiro & governança",
          bio: "Quatro décadas em bancos, seguradoras, gestoras e crédito, em posições C-level e conselhos de administração. Senior Partner de Financial Services na Junto Executive Search; fundador e professor da Banking School e docente da Fundação Dom Cabral.",
          tags: ["Banking & crédito", "Governança"],
          photo: advisorFernando,
          photoAlt: "Fernando Blanco, conselheiro da EmpowerFI",
          linkedinUrl: FERNANDO_LINKEDIN_URL,
        },
      ],
    },
  },
  partners: {
    eyebrow: "Parceiros de negócio",
    titleLead: "O que dizem ",
    titleAccent: "nossos parceiros",
    subtitle: "Na palavra de quem constrói com a gente.",
    testimonials: [
      {
        quote:
          "Nossa fintech busca uma solução como a EmpowerFI há anos. Um motor de crédito que realmente entende e se dedica a esse nicho de mercado tão promissor e subatendido.",
        name: "Daniel Branco",
        role: "CEO & Founder da Vister",
      },
    ],
  },
  recognitions: {
    eyebrow: "Reconhecimentos",
    titleLead: "O que já é ",
    titleAccent: "real e verificável",
    subtitle: "Sem projeção e sem número inflado. O que está aqui pode ser conferido hoje.",
    items: [
      {
        icon: Smartphone,
        title: "Aplicativo disponível na Google Play e na App Store",
        desc: "O aplicativo está publicado e em funcionamento no Android e no iPhone. Não é demonstração: dá para baixar e usar hoje.",
        stores: true,
      },
      {
        icon: BarChart3,
        title: "Programas do Sebrae: Ginga Prototipa e PIER",
        desc: "Tese validada em campo junto ao Sebrae. O Ginga Prototipa foi concluído com a construção do protótipo, e a empresa segue agora no PIER, refinando o modelo de negócios com consultoria especializada.",
        logo: { src: SEBRAE_LOGO_SRC, alt: "Sebrae", label: "Apoio institucional" },
      },
      {
        icon: GraduationCap,
        title: "Empresa-filha da Unicamp",
        desc: "A EmpowerFI foi cadastrada como empresa-filha da Unicamp e integra o Unicamp Ventures, a rede que conecta os empreendedores dessas empresas. O selo é o reconhecimento oficial da universidade, regido pela Resolução nº 30/2025.",
        href: UNICAMP_VENTURES_URL,
        linkLabel: "Unicamp Ventures",
        logo: { src: UNICAMP_SEAL_SRC, alt: "Selo Empresa-filha da Unicamp", label: "Reconhecimento institucional", large: true },
      },
      {
        icon: Building2,
        title: "Startup brasileira",
        desc: "Empresa constituída em São Paulo, com operação, time e produto no Brasil. Construímos para o contexto que conhecemos de perto.",
      },
      {
        icon: ShieldCheck,
        title: "Tecnologia própria",
        desc: "Aplicativo, plataforma e modelagem desenvolvidos internamente. A tecnologia é ativo da empresa, não licença de terceiro.",
      },
    ],
  },
  faq: {
    eyebrow: "Perguntas frequentes",
    titleLead: "Direto ao ",
    titleAccent: "ponto",
    items: [
      {
        q: "Quem pode usar?",
        a: "Mulheres que empreendem, de MEIs a negócios informais. Não é preciso ter CNPJ, histórico bancário ou faturamento mínimo para começar.",
      },
      {
        q: "Existe cobrança?",
        a: "Não. Usar o diário é gratuito. Se um dia houver planos pagos, preço e condições serão mostrados antes, e nada será cobrado sem você contratar.",
      },
      {
        q: "O aplicativo já está disponível?",
        a: "Sim. O diário funciona no navegador, e o aplicativo EmpowerFI está na Google Play e na App Store, gratuito nas duas.",
      },
      {
        q: "O que são as Missões?",
        a: "Campanhas patrocinadas de 30 dias. Quem cumpre as condições da campanha recebe uma recompensa. Só se inscrever não garante recompensa.",
      },
      {
        q: "As recompensas já são pagas?",
        a: "Ainda não. O cofre das campanhas está demonstrado na devnet da Solana, com tokens de teste sem valor. Avisaremos quando a primeira campanha com recompensa estiver no ar.",
      },
      {
        q: "Posso investir hoje?",
        a: "Não. A EmpowerFI não aceita investimentos hoje, e nada neste site é oferta de valores mobiliários ou de produto financeiro. Se tiver interesse, fale com a gente.",
        link: { href: "/pt/protocolo", label: "Conheça o Protocolo" },
      },
    ],
  },
  contact: {
    eyebrow: "Contato",
    titleLead: "Fale com ",
    titleAccent: "a EmpowerFI",
    subtitle:
      "Imprensa, parcerias, investimento ou dúvidas sobre o produto: escreva para a gente. Respondemos todas as mensagens.",
    emailLabel: "E-mail",
    form: {
      name: "Nome",
      namePlaceholder: "Seu nome",
      email: "E-mail",
      emailPlaceholder: "seu@email.com",
      message: "Mensagem",
      messagePlaceholder: "Como podemos ajudar?",
      submit: "Enviar mensagem",
      sending: "Enviando...",
      successTitle: "Mensagem enviada!",
      successDesc: "Vamos te responder em breve.",
      errorTitle: "Não foi possível enviar",
      errorDesc: "Tente novamente em alguns instantes.",
      invalidTitle: "Verifique os campos",
      validation: {
        name: "Informe seu nome",
        nameMax: "Máximo de 100 caracteres",
        email: "E-mail inválido",
        messageMin: "Mensagem muito curta",
        messageMax: "Máximo de 2000 caracteres",
      },
    },
  },
  footer: {
    tagline: "Ferramentas financeiras simples e oportunidades patrocinadas para mulheres que empreendem.",
    developedBy: "Produto desenvolvido por",
    cnpjLabel: "CNPJ",
    privacy: "Política de Privacidade",
    terms: "Termos de Uso",
    contact: "Contato",
    rights: "Todos os direitos reservados.",
    backToHome: "Voltar para a página inicial",
  },
};

export const aboutEn: AboutContent = {
  meta: {
    title: "About EmpowerFI — financial tools and sponsored campaigns for women entrepreneurs",
    description:
      "Meet EmpowerFI: simple financial tools and sponsored campaigns for women entrepreneurs in Brazil, and the financial reputation infrastructure we are building. Founded by Daniele Rodrigues dos Santos in São Paulo.",
  },
  nav: {
    links: [
      { label: "Story", href: "#historia" },
      { label: "Problem", href: "#problema" },
      { label: "Solution", href: "#solucao" },
      { label: "Team", href: "#time" },
      { label: "Partners", href: "#parceiros" },
      { label: "Media", href: "#midia" },
      { label: "Contact", href: "#contato" },
    ],
    home: "Home",
    langSwitch: "PT",
  },
  hero: {
    badge: "About the company",
    titleLead: "Tools and opportunities for ",
    titleAccent: "the entrepreneurs the system does not see",
    subtitle:
      "EmpowerFI helps women entrepreneurs know their numbers and join sponsored campaigns with conditional rewards. Over time, that activity becomes a financial reputation she controls.",
    primaryCta: "Get in touch",
    secondaryCta: "See the app",
  },
  story: {
    eyebrow: "Our story",
    titleLead: "We started with what ",
    titleAccent: "no one else was seeing",
    paragraphs: [
      "EmpowerFI began with a simple, uncomfortable observation: in Brazil, 9.96 million active businesses are led by women, who support their families and drive the real economy — and remain invisible to the financial system. They sell, get paid, reinvest and pay their bills on time. None of it becomes history. And without history, there is no credit.",
      "Our founder spent more than twenty years building technology and digital products inside large companies. Looking closely at this market, she found a problem that was not about effort or merit: it was about infrastructure. Banks' risk models simply have nowhere to look for data on someone who never had a business account, formal collateral or audited financials. The entrepreneur is not declined because she is a bad payer — she is declined because she does not exist to the model.",
      "That is why we start with what she uses every day, not with credit. The EmpowerFI diary shows sales, expenses and the month's profit in one minute a day. Every recorded day becomes the history the bank never had.",
      "Next come Missions: sponsored campaigns that reward taking care of the business, with their rules written into a vault on Solana. And, in the long term, the Protocol: turning that history into private, verifiable financial reputation that she chooses when to share.",
    ],
    pullQuote:
      "First, she knows her numbers. Then that care opens opportunities. Over time, it becomes a reputation she controls.",
  },
  problem: {
    eyebrow: "The problem",
    titleLead: "The financial system still leaves millions of ",
    titleAccent: "entrepreneurs behind",
    subtitle:
      "It is not a lack of capability or discipline. It is a structural failure of data infrastructure — and it repeats every single day.",
    stats: [
      { value: "9.96M", label: "active businesses in Brazil led by women — 39.7% of the total" },
      { value: "2.6%", label: "of women-owned micro and small enterprises access formal loans, against 4.6% of men-owned ones" },
      { value: "US$15.8B", label: "estimated financing gap for women-owned micro and small enterprises in Brazil" },
    ],
    statsSource: "Sources: MEMP / Mapa de Empresas (2026) and IFC/Sicredi (2025). The 2.6% figure measures access to formal loans in the cited sample — it does not mean the rest were refused credit.",
    items: [
      {
        icon: Landmark,
        title: "Hard access to credit",
        desc: "When credit does show up, it is expensive and short: overdraft, revolving card, loan sharks. The same entrepreneur who always pays on time is pushed to the priciest lines on the market — because originating and servicing a small ticket costs almost the same as a large one, and it is that cost, not her, that sets the price.",
      },
      {
        icon: Eye,
        title: "Financial invisibility",
        desc: "Sales via instant transfer, card readers and cash leave no usable trace. From the bank's point of view, a business that has worked for years and supports an entire family simply does not appear — and what does not appear is never assessed.",
      },
      {
        icon: FileQuestion,
        title: "No track record",
        desc: "Without an active business registration, formal collateral or audited financials, the risk model has nothing to stand on. The result is a closed loop: no credit means no history, and no history means no credit.",
      },
      {
        icon: TrendingDown,
        title: "No room to grow",
        desc: "Without working capital, the business cannot buy stock, cannot hire and cannot survive a bad month. The entrepreneur stays locked at survival scale — not because the business fails, but because the fuel to grow is missing.",
      },
    ],
  },
  solution: {
    eyebrow: "Our solution",
    titleLead: "What exists today, ",
    titleAccent: "and what comes next",
    subtitle:
      "We start with what she uses every day. Each layer exists only because the one before it works.",
    steps: [
      {
        icon: Smartphone,
        title: "Financial diary",
        status: "Available",
        live: true,
        desc: "Sales, expenses and the month's profit, counting the salary she needs. One minute a day, with reminders and a short reading of her week.",
      },
      {
        icon: Sparkles,
        title: "EmpowerFI Missions",
        status: "Devnet demo",
        desc: "Sponsored 30-day campaigns, priced per entrepreneur, with conditional rewards. Each campaign's vault sits on Solana with its rules written in.",
      },
      {
        icon: Layers,
        title: "EmpowerFI Protocol",
        status: "Planned",
        desc: "Programmable financial reputation: verifiable credentials, selective disclosure and risk policies institutions can verify. Sensitive data stays off-chain.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Mission",
      text: "To give women entrepreneurs simple tools to know their numbers, and opportunities that reward taking care of the business.",
    },
    vision: {
      eyebrow: "Vision",
      text: "To turn small-business activity into private, verifiable financial reputation that she controls and institutions can verify.",
    },
  },
  values: {
    eyebrow: "Our values",
    titleLead: "What guides ",
    titleAccent: "every decision",
    subtitle: "Six principles that define what we build — and, above all, what we refuse to build.",
    items: [
      {
        icon: Users,
        title: "Inclusion",
        desc: "We design for the people the system left out. If a solution only works for those who already have access, it does not solve the problem that brought us here.",
      },
      {
        icon: Sparkles,
        title: "Technology",
        desc: "Technology as a means, never as a showcase. Every piece has to remove real friction from an entrepreneur's day, or it does not ship.",
      },
      {
        icon: Heart,
        title: "Community",
        desc: "Entrepreneurs grow as a network. Campaigns and community bring them closer to opportunities, because the value shows up when the network grows together.",
      },
      {
        icon: ScrollText,
        title: "Transparency",
        desc: "No fine print and no inflated numbers. We talk about what is already live and what is still a plan — and we make clear which is which.",
      },
      {
        icon: Handshake,
        title: "Impact",
        desc: "We measure success by income generated and access won. Impact that cannot be verified is marketing, not results.",
      },
      {
        icon: Lightbulb,
        title: "Innovation",
        desc: "The problem is old and conventional tools have already failed at it. Building a new path is a requirement, not a flourish.",
      },
    ],
  },
  team: {
    eyebrow: "Team",
    titleLead: "Technical execution at the founding. ",
    titleAccent: "Finance and financial education on the advisory board.",
    founder: {
      name: "Daniele Rodrigues dos Santos",
      role: "Founder & CEO",
      paragraphs: [
        "Daniele Rodrigues dos Santos holds a Computer Engineering degree from Unicamp, and an MBA in Big Data & Analytics and a postgraduate degree in Marketing from FIA Business School. She has more than 20 years in technology: delivery, big data and machine learning, product, marketing and infrastructure.",
        "She built her career at major technology companies, including Capgemini and Dell Technologies, and founded EmpowerFI to connect productive capital, data and economic impact.",
      ],
      facts: [
        { label: "Education", items: ["Unicamp", "FIA Business School"] },
        { label: "Career", items: ["Capgemini", "Dell Technologies"] },
      ],
      linkedinLabel: "LinkedIn",
      instagramLabel: "Instagram",
      photoAlt: "Daniele Rodrigues dos Santos, founder and CEO of EmpowerFI",
    },
    advisory: {
      heading: "Advisory board",
      note: "Between them, the advisors cover the two fronts the pilot depends on: access to financial institutions and governance on one side, the entrepreneur's financial education and management on the other.",
      linkedinLabel: "LinkedIn",
      advisors: [
        {
          name: "Roberta Stock de Oliveira",
          title: "Advisor",
          focus: "Financial management & education",
          bio: "More than 20 years in the financial market, from major institutions to social and cultural impact projects. At Protagonismo Mulher she brings together strategic financial management, large-scale events and relationship networks, as at the Fórum Brasil de Turismo Cultural.",
          tags: ["Financial education", "Impact"],
          photo: advisorRoberta,
          photoAlt: "Roberta Stock de Oliveira, EmpowerFI advisor",
          linkedinUrl: ROBERTA_LINKEDIN_URL,
          website: ROBERTA_WEBSITE,
        },
        {
          name: "Fernando Blanco",
          title: "Advisor",
          focus: "Financial markets & governance",
          bio: "Four decades across banks, insurers, asset managers and credit, in C-level roles and on boards of directors. Senior Partner for Financial Services at Junto Executive Search; founder of and professor at Banking School, and faculty member at Fundação Dom Cabral.",
          tags: ["Banking & credit", "Governance"],
          photo: advisorFernando,
          photoAlt: "Fernando Blanco, EmpowerFI advisor",
          linkedinUrl: FERNANDO_LINKEDIN_URL,
        },
      ],
    },
  },
  partners: {
    eyebrow: "Business partners",
    titleLead: "What our ",
    titleAccent: "partners say",
    subtitle: "In the words of the people building with us.",
    testimonials: [
      {
        quote:
          "Our fintech has been looking for a solution like EmpowerFI for years. A credit engine that truly understands, and is dedicated to, this promising and underserved market niche.",
        name: "Daniel Branco",
        role: "CEO & Founder, Vister",
        note: "Translated from Portuguese.",
      },
    ],
  },
  recognitions: {
    eyebrow: "Recognition",
    titleLead: "What is already ",
    titleAccent: "real and verifiable",
    subtitle: "No projections, no inflated numbers. Everything here can be checked today.",
    items: [
      {
        icon: Smartphone,
        title: "App available on Google Play and the App Store",
        desc: "The app is published and running on Android and iPhone. It is not a demo: you can download and use it today.",
        stores: true,
      },
      {
        icon: BarChart3,
        title: "Sebrae programmes: Ginga Prototipa and PIER",
        desc: "Thesis validated in the field with Sebrae. Ginga Prototipa concluded with the prototype built, and the company is now in PIER, refining the business model with specialist consulting.",
        logo: { src: SEBRAE_LOGO_SRC, alt: "Sebrae", label: "Institutional support" },
      },
      {
        icon: GraduationCap,
        title: "An empresa-filha of Unicamp",
        desc: "EmpowerFI is registered as an empresa-filha of Unicamp and joins Unicamp Ventures, the network that connects those companies' founders. The seal is the university's official recognition, governed by Resolution 30/2025.",
        href: UNICAMP_VENTURES_URL,
        linkLabel: "Unicamp Ventures",
        logo: { src: UNICAMP_SEAL_SRC, alt: "Unicamp empresa-filha seal", label: "Institutional recognition", large: true },
      },
      {
        icon: Building2,
        title: "Brazilian startup",
        desc: "A company incorporated in São Paulo, with its operation, team and product in Brazil. We build for the context we know first-hand.",
      },
      {
        icon: ShieldCheck,
        title: "Proprietary technology",
        desc: "App, platform and modelling developed in-house. The technology is a company asset, not a third-party licence.",
      },
    ],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    titleLead: "Straight to ",
    titleAccent: "the point",
    items: [
      {
        q: "Who can use it?",
        a: "Women entrepreneurs, from registered micro-businesses to informal ones. No company registration, banking history or minimum revenue is needed to start.",
      },
      {
        q: "Is there any charge?",
        a: "No. The diary is free. If paid plans ever exist, the price and conditions will be shown up front, and nothing is charged unless you sign up for it.",
      },
      {
        q: "Is the app already available?",
        a: "Yes. The diary works in the browser, and the EmpowerFI app is on Google Play and the App Store, free on both.",
      },
      {
        q: "What are Missions?",
        a: "Sponsored 30-day campaigns. Entrepreneurs who meet a campaign's conditions receive a reward. Signing up alone does not guarantee one.",
      },
      {
        q: "Are rewards paid yet?",
        a: "Not yet. The campaign vault is demonstrated on Solana devnet, with test tokens that have no value. We will announce the first campaign with live rewards.",
      },
      {
        q: "Can I invest today?",
        a: "No. EmpowerFI does not accept investment today, and nothing on this site is an offer of securities or of a financial product. If you are interested, get in touch.",
        link: { href: "/protocol", label: "Explore the Protocol" },
      },
    ],
  },
  contact: {
    eyebrow: "Contact",
    titleLead: "Talk to ",
    titleAccent: "EmpowerFI",
    subtitle:
      "Press, partnerships, investment or questions about the product: write to us. We answer every message.",
    emailLabel: "Email",
    form: {
      name: "Name",
      namePlaceholder: "Your name",
      email: "Email",
      emailPlaceholder: "you@email.com",
      message: "Message",
      messagePlaceholder: "How can we help?",
      submit: "Send message",
      sending: "Sending...",
      successTitle: "Message sent!",
      successDesc: "We'll get back to you shortly.",
      errorTitle: "Could not send",
      errorDesc: "Please try again in a moment.",
      invalidTitle: "Check the fields",
      validation: {
        name: "Enter your name",
        nameMax: "100 characters maximum",
        email: "Invalid email",
        messageMin: "Message is too short",
        messageMax: "2000 characters maximum",
      },
    },
  },
  footer: {
    tagline: "Simple financial tools and sponsored opportunities for women entrepreneurs.",
    developedBy: "Product developed by",
    cnpjLabel: "Company tax ID (CNPJ)",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    contact: "Contact",
    rights: "All rights reserved.",
    backToHome: "Back to home",
  },
};
