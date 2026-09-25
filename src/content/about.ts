import {
  Banknote,
  BarChart3,
  Building2,
  Eye,
  FileQuestion,
  Gauge,
  GraduationCap,
  Handshake,
  Heart,
  Landmark,
  Layers,
  Lightbulb,
  type LucideIcon,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TrendingDown,
  Users,
  Wrench,
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
    title: "Sobre a EmpowerFI — Crédito produtivo P2P para mulheres empreendedoras no Brasil",
    description:
      "Conheça a EmpowerFI: crédito produtivo P2P para mulheres empreendedoras no Brasil, da prontidão ao capital, com cada etapa comprovada na Solana. Nossa história, o problema que resolvemos, a missão e o time. Fundada por Daniele Rodrigues dos Santos em São Paulo, Brasil.",
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
    titleLead: "Construindo crédito produtivo P2P para ",
    titleAccent: "quem o sistema não enxerga",
    subtitle:
      "A EmpowerFI leva pequenos negócios da prontidão ao capital: comunidades e programas de capacitação preparam as empreendedoras, a EmpowerFI qualifica os pedidos de crédito, e cada etapa fica comprovada na Solana — começando por mulheres empreendedoras no Brasil.",
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
      "Por isso começamos pelo Marketplace, e não pelo crédito. Emprestar dinheiro para quem não tem histórico é aposta; construir o histórico primeiro é engenharia. O Marketplace conecta empreendedoras a novos clientes e umas às outras, gerando renda de verdade hoje e o começo de um registro de atividade econômica. Um check-in mensal de poucos minutos e a formação das comunidades e programas que já acompanham essas mulheres completam o histórico que o banco nunca teve.",
      "A partir dessa base, cada camada reforça a seguinte. Um motor de prontidão mostra a cada empreendedora o que já está pronto e o que ainda falta. Prontidão não é elegibilidade, e elegibilidade não é captação: estar pronta e não pedir crédito é um resultado completo. Quando ela decide pedir, a EmpowerFI qualifica o pedido, e ele vira uma oportunidade que o capital pode financiar — no piloto, com o capital de uma instituição financeira parceira regulada; depois, no modelo P2P, com investidores.",
    ],
    pullQuote:
      "O app é a porta de entrada de algo maior: uma plataforma de crédito produtivo P2P que prepara o negócio, qualifica o pedido, leva cada oportunidade ao capital e acompanha a operação depois do desembolso — com cada etapa comprovada na Solana.",
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
    titleLead: "Cinco camadas que se constroem ",
    titleAccent: "uma sobre a outra",
    subtitle:
      "Cada etapa gera o insumo da próxima. É por isso que a ordem importa — e por isso começamos pelo Marketplace.",
    steps: [
      {
        icon: ShoppingBag,
        title: "Marketplace",
        status: "No ar agora",
        live: true,
        desc: "Conecta microempreendedoras a novos clientes e umas às outras. Gera renda real hoje e, como subproduto, o registro de atividade econômica que alimenta todas as camadas seguintes.",
      },
      {
        icon: Wrench,
        title: "Check-ins e formação",
        status: "Protótipo na devnet",
        desc: "Um check-in mensal de poucos minutos sobre vendas, custos e caixa, somado aos módulos de educação da comunidade que a acompanha. Juntos, viram o histórico que faltava — sem tirar a empreendedora do negócio.",
      },
      {
        icon: Gauge,
        title: "Motor de prontidão",
        status: "Protótipo na devnet",
        desc: "Mostra a cada empreendedora o que já está pronto e o que ainda falta, por escrito. Prontidão não é elegibilidade, e elegibilidade não é captação. Estar pronta e não pedir crédito é um resultado completo.",
      },
      {
        icon: Banknote,
        title: "Crédito produtivo qualificado",
        status: "Piloto em preparação",
        desc: "Quando ela decide pedir, a EmpowerFI qualifica o pedido e acompanha os pagamentos. No piloto, uma instituição financeira parceira regulada fornece o capital e toma a decisão de crédito, sob a licença e a política de crédito dela.",
      },
      {
        icon: Layers,
        title: "Plataforma de capital P2P",
        status: "Nossa estrela-guia · demonstrada na devnet",
        desc: "Dois pools de capital P2P: investidores brasileiros em reais, e investidores internacionais e de impacto em USDC na Solana. Um Motor de Alocação de Capital escolhe o pool de cada oportunidade, e a mesa P2P da EmpowerFI formaliza cada empréstimo captado à taxa do motor e acompanha os pagamentos. Ela recebe e paga em reais, por Pix, seja qual for o pool. O modelo P2P vai operar sob a estrutura regulada aplicável; hoje a EmpowerFI não tem essa licença.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Missão",
      text: "Preparar pequenos negócios para receber capital, e medir o que o capital produz depois — para que o sistema financeiro consiga enxergar quem ele nunca foi construído para alcançar.",
    },
    vision: {
      eyebrow: "Visão",
      text: "Ser a plataforma de crédito produtivo P2P que transforma comunidades em negócios prontos para crédito, negócios prontos em oportunidades qualificadas que o capital pode financiar, e operações financiadas em evidência para alocar capital cada vez melhor.",
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
        desc: "Empreendedoras crescem em rede. O Marketplace as conecta a clientes e umas às outras, porque o valor aparece quando a rede se fortalece junto.",
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
        a: "Mulheres empreendedoras que queiram divulgar seus produtos ou serviços e alcançar novos clientes — de MEIs a negócios informais que ainda não têm CNPJ. Não é preciso ter empresa formalizada, histórico bancário ou faturamento mínimo para começar.",
      },
      {
        q: "Quem pode contratar?",
        a: "Qualquer pessoa pode baixar o aplicativo, navegar pelo Marketplace e contratar produtos e serviços das empreendedoras cadastradas. Contratar não exige ser empreendedora — cada contratação é renda direta para uma delas.",
      },
      {
        q: "Existe cobrança?",
        a: "Baixar o aplicativo e se cadastrar é gratuito, e contratar é sempre gratuito para o cliente. A EmpowerFI também não cobra comissão sobre as vendas fechadas pelo Marketplace: o que a empreendedora vende é integralmente dela. O modelo é freemium — no futuro pretendemos oferecer planos de assinatura com funcionalidades adicionais para quem quiser mais recursos, sempre com preço e condições apresentados de forma clara e mediante aceite. Nada é cobrado sem que você contrate ativamente.",
      },
      {
        q: "Como funciona?",
        a: "A empreendedora cria seu perfil e publica o que oferece; quem procura encontra pelo Marketplace e entra em contato. Cada venda gera renda hoje e, ao mesmo tempo, o registro de atividade econômica que forma seu histórico financeiro — a base do preparo para o crédito produtivo que estamos construindo.",
      },
      {
        q: "O aplicativo já está disponível?",
        a: "Sim. O aplicativo EmpowerFI está publicado e disponível na Google Play, para Android, e na App Store, para iPhone e iPad. É gratuito nas duas.",
      },
      {
        q: "Quem financia os empréstimos?",
        a: "Depende da fase. Hoje, a plataforma de crédito é um protótipo na Solana devnet, com dinheiro simulado. No piloto, as primeiras operações são financiadas com o capital de uma instituição financeira parceira regulada, que decide o crédito sob a licença e a política de crédito dela. Depois que o piloto se validar, vem o modelo P2P: dois pools de capital — investidores brasileiros em reais, e investidores internacionais e de impacto em USDC na Solana — financiam oportunidades qualificadas, sob a estrutura regulada aplicável; hoje a EmpowerFI não tem essa licença. Em qualquer fase, a empreendedora recebe e paga em reais, por Pix.",
      },
      {
        q: "Posso investir hoje?",
        a: "Não. A EmpowerFI não aceita investimentos hoje, e nada neste site é oferta de valores mobiliários ou de produto financeiro. Quem tem interesse no futuro modelo P2P pode entrar na lista de espera para investidores, em /pt/investidores (ou /investors, em inglês): é uma manifestação de interesse, sem compromisso. O protótipo na Solana devnet mostra como o modelo funciona, mas lá investimentos, retornos, câmbio e Pix são simulados, e as transações usam ativos de teste.",
        link: { href: "/pt/investidores", label: "Lista de espera para investidores" },
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
    tagline: "Crédito produtivo P2P para mulheres empreendedoras no Brasil, da prontidão ao capital, com cada etapa comprovada na Solana.",
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
    title: "About EmpowerFI — P2P productive credit for women micro-entrepreneurs in Brazil",
    description:
      "Meet EmpowerFI: P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana. Our story, the problem we solve, our mission and the team. Founded by Daniele Rodrigues dos Santos in São Paulo, Brazil.",
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
    titleLead: "Building P2P productive credit for ",
    titleAccent: "the entrepreneurs the system does not see",
    subtitle:
      "EmpowerFI takes small businesses from readiness to capital: communities and education programmes prepare entrepreneurs, EmpowerFI qualifies their credit requests, and every step is proven on Solana — starting with women entrepreneurs in Brazil.",
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
      "That is why we started with the Marketplace rather than with credit. Lending to someone with no history is a bet; building the history first is engineering. The Marketplace connects entrepreneurs to new customers and to each other, generating real income today and the beginning of a record of economic activity. A monthly check-in of a few minutes, and the education of the communities and programmes that already support these women, complete the track record the bank never had.",
      "From that base, each layer reinforces the next. A readiness engine shows each entrepreneur what is already in place and what is still missing. Readiness is not eligibility, and eligibility is not funding: being ready and not asking is a complete outcome. When she decides to ask, EmpowerFI qualifies the request, and it becomes an opportunity capital can fund — in the pilot, with a regulated financial partner's capital; later, in the P2P model, with investors.",
    ],
    pullQuote:
      "The app is the front door to something larger: a P2P productive-credit platform that prepares the business, qualifies the request, brings each opportunity to capital and follows the operation after disbursement — with every step proven on Solana.",
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
    titleLead: "Five layers that build ",
    titleAccent: "on one another",
    subtitle:
      "Each stage produces the input for the next. That is why the order matters — and why we started with the Marketplace.",
    steps: [
      {
        icon: ShoppingBag,
        title: "Marketplace",
        status: "Live now",
        live: true,
        desc: "Connects micro-entrepreneurs to new customers and to each other. It generates real income today and, as a by-product, the record of economic activity that feeds every layer that follows.",
      },
      {
        icon: Wrench,
        title: "Check-ins and education",
        status: "Prototype on devnet",
        desc: "A monthly check-in of a few minutes on sales, costs and cash, together with the education modules of the community that supports her. Together, they become the track record that was missing — without taking the entrepreneur away from her business.",
      },
      {
        icon: Gauge,
        title: "Readiness engine",
        status: "Prototype on devnet",
        desc: "Shows each entrepreneur what is already in place and what is still missing, in writing. Readiness is not eligibility, and eligibility is not funding. Being ready and not asking is a complete outcome.",
      },
      {
        icon: Banknote,
        title: "Qualified productive credit",
        status: "Pilot in preparation",
        desc: "When she decides to ask, EmpowerFI qualifies the request and follows repayment. In the pilot, a regulated financial partner provides the capital and makes the credit decision, under its licence and its credit policy.",
      },
      {
        icon: Layers,
        title: "P2P capital platform",
        status: "Our North Star · demonstrated on devnet",
        desc: "Two pools of P2P capital: Brazilian investors in reais, and international and impact investors in USDC on Solana. A Capital Allocation Engine chooses the pool for each opportunity, and EmpowerFI's P2P desk formalises each funded loan at the engine's rate and services it. She receives and repays in reais, by Pix, whichever pool funds her. The P2P model will operate under the applicable regulated structure; EmpowerFI holds no such licence today.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Mission",
      text: "To prepare small businesses to receive capital, and to measure what that capital produces — so the financial system can finally see the businesses it was never built to reach.",
    },
    vision: {
      eyebrow: "Vision",
      text: "To become the P2P productive-credit platform that turns communities into credit-ready businesses, credit-ready businesses into qualified opportunities capital can fund, and financed operations into evidence for allocating capital better.",
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
        desc: "Entrepreneurs grow as a network. The Marketplace connects them to customers and to each other, because the value shows up when the network grows together.",
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
        a: "Women entrepreneurs who want to promote their products or services and reach new customers — from registered micro-businesses to informal ones with no company registration yet. You do not need a formal company, a banking history or a minimum revenue to start.",
      },
      {
        q: "Who can hire?",
        a: "Anyone can download the app, browse the Marketplace and hire products and services from the entrepreneurs listed there. You do not need to be an entrepreneur to hire — every booking is direct income for one of them.",
      },
      {
        q: "Is there any charge?",
        a: "Downloading the app and signing up is free, and hiring is always free for customers. EmpowerFI also takes no commission on sales closed through the Marketplace: what an entrepreneur sells is entirely hers. The model is freemium — in the future we intend to offer subscription plans with additional features for those who want more, always with the price and conditions shown up front and subject to your acceptance. Nothing is charged unless you actively sign up for it.",
      },
      {
        q: "How does it work?",
        a: "The entrepreneur creates her profile and publishes what she offers; customers find her through the Marketplace and get in touch. Every sale generates income today and, at the same time, the record of economic activity that forms her financial history — the basis of the preparation for the productive credit we are building.",
      },
      {
        q: "Is the app already available?",
        a: "Yes. The EmpowerFI app is published and available on Google Play, for Android, and on the App Store, for iPhone and iPad. It is free on both.",
      },
      {
        q: "Who funds the loans?",
        a: "It depends on the phase. Today, the credit platform is a prototype on Solana devnet, with simulated money. In the pilot, the first operations are funded with a regulated financial partner's capital, and the partner makes the credit decision under its licence and its credit policy. Once the pilot validates, the P2P model follows: two pools of capital — Brazilian investors in reais, and international and impact investors in USDC on Solana — fund qualified opportunities, under the applicable regulated structure; EmpowerFI holds no such licence today. In every phase, the entrepreneur receives and repays in reais, by Pix.",
      },
      {
        q: "Can I invest today?",
        a: "No. EmpowerFI does not accept investment today, and nothing on this site is an offer of securities or of a financial product. If you are interested in the future P2P model, you can join the investor waitlist at /investors (or /pt/investidores, in Portuguese): it is a non-binding expression of interest. The prototype on Solana devnet shows how the model works, but investments, returns, FX and Pix there are simulated, and transactions use test assets.",
        link: { href: "/investors", label: "Investor waitlist" },
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
    tagline: "P2P productive credit for women micro-entrepreneurs in Brazil, from readiness to capital, with every step proven on Solana.",
    developedBy: "Product developed by",
    cnpjLabel: "Company tax ID (CNPJ)",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    contact: "Contact",
    rights: "All rights reserved.",
    backToHome: "Back to home",
  },
};
