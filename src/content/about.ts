import {
  Banknote,
  BarChart3,
  Building2,
  Eye,
  FileQuestion,
  Gauge,
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
import { PLAY_STORE_URL } from "@/config/links";

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
  founder: {
    eyebrow: string;
    name: string;
    role: string;
    paragraphs: string[];
    linkedinLabel: string;
    instagramLabel: string;
    photoAlt: string;
  };
  recognitions: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    subtitle: string;
    items: { icon: LucideIcon; title: string; desc: string; href?: string; linkLabel?: string }[];
  };
  faq: {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    items: { q: string; a: string }[];
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
    title: "Sobre a EmpowerFI — Infraestrutura financeira para mulheres empreendedoras",
    description:
      "Conheça a EmpowerFI: nossa missão, nossa história, o problema que resolvemos e a empresa por trás da plataforma. Fundada por Daniele Rodrigues dos Santos em São Paulo, Brasil.",
  },
  nav: {
    links: [
      { label: "História", href: "#historia" },
      { label: "Problema", href: "#problema" },
      { label: "Solução", href: "#solucao" },
      { label: "Fundadora", href: "#fundadora" },
      { label: "Contato", href: "#contato" },
    ],
    home: "Início",
    langSwitch: "EN",
  },
  hero: {
    badge: "Sobre a empresa",
    titleLead: "Construindo infraestrutura financeira para ",
    titleAccent: "mulheres empreendedoras",
    subtitle:
      "A EmpowerFI nasceu para tornar mulheres empreendedoras mais visíveis, gerar novas oportunidades de negócio e construir acesso a serviços financeiros mais justos.",
    primaryCta: "Falar com a gente",
    secondaryCta: "Ver o aplicativo",
  },
  story: {
    eyebrow: "Nossa história",
    titleLead: "Começamos pelo que ",
    titleAccent: "ninguém estava enxergando",
    paragraphs: [
      "A EmpowerFI nasceu de uma constatação simples e incômoda: no Brasil, mais de 7 milhões de mulheres empreendedoras sustentam suas famílias e movimentam a economia real — e continuam invisíveis para o sistema financeiro. Elas vendem, recebem, reinvestem e pagam suas contas em dia. Mas nada disso vira histórico. E, sem histórico, não existe crédito.",
      "Nossa fundadora passou mais de vinte anos construindo tecnologia e produtos digitais dentro de grandes empresas. Ao olhar de perto para esse mercado, encontrou um problema que não era de esforço nem de mérito: era de infraestrutura. Os modelos de risco dos bancos simplesmente não têm onde buscar dados sobre quem nunca teve conta empresarial, garantia formal ou balanço auditado. A empreendedora não é recusada porque é ruim pagadora — é recusada porque não existe para o modelo.",
      "Por isso começamos pelo Marketplace, e não pelo crédito. Emprestar dinheiro para quem não tem histórico é aposta; construir o histórico primeiro é engenharia. O Marketplace conecta empreendedoras a novos clientes e umas às outras, gerando duas coisas ao mesmo tempo: renda de verdade hoje e o registro de atividade econômica que, amanhã, sustenta um score justo. O dado nasce como subproduto da venda, sem formulário, sem curso e sem atrito.",
      "A partir dessa base, cada camada reforça a seguinte: ferramentas de gestão organizam o negócio, o score alternativo traduz o comportamento em confiança mensurável, e o crédito passa a ser consequência de um histórico real — não de uma garantia que ela nunca teve como oferecer.",
    ],
    pullQuote:
      "O Marketplace é apenas o primeiro passo de uma visão muito maior: criar infraestrutura financeira para milhões de mulheres empreendedoras.",
  },
  problem: {
    eyebrow: "O problema",
    titleLead: "O sistema financeiro ainda deixa milhões de ",
    titleAccent: "empreendedoras para trás",
    subtitle:
      "Não é falta de capacidade nem de disciplina. É uma falha estrutural de infraestrutura de dados — e ela se repete todos os dias.",
    stats: [
      { value: "~7,4 mi", label: "de mulheres MEI ativas no Brasil — sub-bancarizadas pelo sistema financeiro" },
      { value: "68%", label: "delas já tiveram um pedido de crédito negado ou só parcialmente atendido" },
      { value: "7,1%", label: "de inadimplência entre as mulheres, contra 7,6% entre os homens — elas pagam melhor e ainda assim pagam mais caro" },
    ],
    statsSource: "Fonte: Sebrae e Banco Central, 2024.",
    items: [
      {
        icon: Landmark,
        title: "Dificuldade de acesso ao crédito",
        desc: "Quando o crédito aparece, vem caro e curto: cheque especial, cartão rotativo, agiota. A mesma empreendedora que paga em dia é empurrada para as linhas mais caras do mercado — e, embora as mulheres inadimplam menos que os homens (7,1% contra 7,6%), são elas que pagam os juros mais altos.",
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
        title: "Ferramentas de gestão",
        status: "Próximo passo",
        desc: "Controle de vendas, recebimentos e clientes no mesmo lugar em que ela já trabalha. Organizar o negócio deixa de ser planilha e vira parte natural do dia a dia.",
      },
      {
        icon: Gauge,
        title: "Score alternativo",
        status: "Em sequência",
        desc: "Traduz comportamento real — vendas, recorrência, poupança, reputação — em confiança mensurável. Sem cursos, sem formulários: o histórico se forma sozinho, conforme ela empreende.",
      },
      {
        icon: Banknote,
        title: "Crédito",
        status: "Em sequência",
        desc: "Com histórico próprio, o crédito deixa de depender de garantia e passa a refletir o negócio como ele é. Taxa justa, lastreada em dado — não em presunção de risco.",
      },
      {
        icon: Layers,
        title: "Infraestrutura financeira",
        status: "Visão de longo prazo",
        desc: "A base que sustenta tudo isso vira plataforma: score, originação e capital disponíveis para escalar o acesso a serviços financeiros justos para milhões de empreendedoras.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Missão",
      text: "Capacitar mulheres empreendedoras através de tecnologia, geração de renda e inclusão financeira.",
    },
    vision: {
      eyebrow: "Visão",
      text: "Construir a principal infraestrutura financeira para mulheres empreendedoras na América Latina.",
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
  founder: {
    eyebrow: "Fundadora",
    name: "Daniele Rodrigues dos Santos",
    role: "Fundadora & CEO",
    paragraphs: [
      "Daniele Rodrigues dos Santos é Engenheira da Computação formada pela Unicamp, com mais de 20 anos de experiência em tecnologia, desenvolvimento de software e liderança de produtos digitais.",
      "Após construir uma carreira em grandes empresas de tecnologia, fundou a EmpowerFI para desenvolver infraestrutura financeira voltada às mulheres empreendedoras.",
    ],
    linkedinLabel: "LinkedIn",
    instagramLabel: "Instagram",
    photoAlt: "Daniele Rodrigues dos Santos, fundadora e CEO da EmpowerFI",
  },
  recognitions: {
    eyebrow: "Reconhecimentos",
    titleLead: "O que já é ",
    titleAccent: "real e verificável",
    subtitle: "Sem projeção e sem número inflado. O que está aqui pode ser conferido hoje.",
    items: [
      {
        icon: Smartphone,
        title: "Aplicativo disponível na Google Play",
        desc: "O Marketplace está publicado e em funcionamento. Não é mockup nem protótipo: dá para baixar e usar hoje.",
        href: PLAY_STORE_URL,
        linkLabel: "Ver no Google Play",
      },
      {
        icon: BarChart3,
        title: "Programa Ginga Prototipa (Sebrae)",
        desc: "Tese validada em campo junto ao Sebrae e participação no Ginga Prototipa — uma das principais referências de inovação e prototipagem do país.",
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
        a: "A empreendedora cria seu perfil e publica o que oferece; quem procura encontra pelo Marketplace e entra em contato. Cada venda gera renda hoje e, ao mesmo tempo, o registro de atividade econômica que forma seu histórico financeiro — a base do score alternativo e do acesso a crédito que estamos construindo.",
      },
      {
        q: "O aplicativo já está disponível?",
        a: "Sim. O aplicativo EmpowerFI está publicado e disponível na Google Play para Android. A versão para iOS está em desenvolvimento.",
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
    tagline: "Infraestrutura financeira para mulheres empreendedoras — começando pelo Brasil.",
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
    title: "About EmpowerFI — Credit infrastructure for underserved entrepreneurs",
    description:
      "Meet EmpowerFI: our mission, our story, the problem we solve and the company behind the credit infrastructure connecting global capital to microbusinesses. Founded by Daniele Rodrigues dos Santos in São Paulo, Brazil.",
  },
  nav: {
    links: [
      { label: "Story", href: "#historia" },
      { label: "Problem", href: "#problema" },
      { label: "Solution", href: "#solucao" },
      { label: "Founder", href: "#fundadora" },
      { label: "Contact", href: "#contato" },
    ],
    home: "Home",
    langSwitch: "PT",
  },
  hero: {
    badge: "About the company",
    titleLead: "Building credit infrastructure for ",
    titleAccent: "the next generation of entrepreneurs",
    subtitle:
      "EmpowerFI connects global capital with underserved microbusinesses in emerging markets — starting with women entrepreneurs in Brazil.",
    primaryCta: "Get in touch",
    secondaryCta: "See the app",
  },
  story: {
    eyebrow: "Our story",
    titleLead: "We started with what ",
    titleAccent: "no one else was seeing",
    paragraphs: [
      "EmpowerFI began with a simple, uncomfortable observation: in Brazil, more than 7 million women entrepreneurs support their families and drive the real economy — and remain invisible to the financial system. They sell, get paid, reinvest and pay their bills on time. None of it becomes history. And without history, there is no credit.",
      "Our founder spent more than twenty years building technology and digital products inside large companies. Looking closely at this market, she found a problem that was not about effort or merit: it was about infrastructure. Banks' risk models simply have nowhere to look for data on someone who never had a business account, formal collateral or audited financials. The entrepreneur is not declined because she is a bad payer — she is declined because she does not exist to the model.",
      "That is why we started with the Marketplace rather than with credit. Lending to someone with no history is a bet; building the history first is engineering. The Marketplace connects entrepreneurs to new customers and to each other, generating two things at once: real income today, and the record of economic activity that tomorrow supports a fair score. The data is a by-product of the sale — no forms, no courses, no friction.",
      "From that base, each layer reinforces the next: management tools organise the business, the alternative score turns behaviour into measurable trust, and credit becomes the consequence of a real track record — not of collateral she never had to offer.",
    ],
    pullQuote:
      "The app is only the first step of a much larger vision: credit infrastructure that turns global liquidity into productive capital for millions of small businesses.",
  },
  problem: {
    eyebrow: "The problem",
    titleLead: "The financial system still leaves millions of ",
    titleAccent: "entrepreneurs behind",
    subtitle:
      "It is not a lack of capability or discipline. It is a structural failure of data infrastructure — and it repeats every single day.",
    stats: [
      { value: "~7.4M", label: "active women-led micro-businesses in Brazil — underbanked by the financial system" },
      { value: "68%", label: "of them have had a credit request denied or only partially granted" },
      { value: "7.1%", label: "default rate among women, against 7.6% among men — they pay better and still pay more" },
    ],
    statsSource: "Source: Sebrae and Banco Central (Brazil's central bank), 2024.",
    items: [
      {
        icon: Landmark,
        title: "Hard access to credit",
        desc: "When credit does show up, it is expensive and short: overdraft, revolving card, loan sharks. The same entrepreneur who always pays on time is pushed to the priciest lines on the market — and although women default less than men (7.1% against 7.6%), it is women who pay the higher interest.",
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
        title: "Management tools",
        status: "Next step",
        desc: "Sales, payments and customers in the same place she already works. Running the business stops being a spreadsheet and becomes a natural part of the day.",
      },
      {
        icon: Gauge,
        title: "Alternative score",
        status: "Then",
        desc: "Turns real behaviour — sales, recurrence, savings, reputation — into measurable trust. No courses, no forms: the track record builds itself as she works.",
      },
      {
        icon: Banknote,
        title: "Credit",
        status: "Then",
        desc: "With a track record of her own, credit no longer depends on collateral and starts reflecting the business as it really is. A fair rate, backed by data rather than presumed risk.",
      },
      {
        icon: Layers,
        title: "Credit infrastructure",
        status: "Long-term vision",
        desc: "The base underneath it all becomes infrastructure: credit intelligence, origination, servicing and impact measurement — with global capital reaching the business over a stablecoin rail that makes small tickets viable.",
      },
    ],
  },
  missionVision: {
    mission: {
      eyebrow: "Mission",
      text: "To turn global liquidity into productive capital for the small businesses the financial system was never built to reach.",
    },
    vision: {
      eyebrow: "Vision",
      text: "To become the credit infrastructure connecting global capital to microbusinesses across emerging markets — starting in Brazil.",
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
  founder: {
    eyebrow: "Founder",
    name: "Daniele Rodrigues dos Santos",
    role: "Founder & CEO",
    paragraphs: [
      "Daniele Rodrigues dos Santos holds a Computer Engineering degree from Unicamp and has more than 20 years of experience in technology, software development and digital product leadership.",
      "After building a career at major technology companies, she founded EmpowerFI to develop financial infrastructure for women entrepreneurs.",
    ],
    linkedinLabel: "LinkedIn",
    instagramLabel: "Instagram",
    photoAlt: "Daniele Rodrigues dos Santos, founder and CEO of EmpowerFI",
  },
  recognitions: {
    eyebrow: "Recognition",
    titleLead: "What is already ",
    titleAccent: "real and verifiable",
    subtitle: "No projections, no inflated numbers. Everything here can be checked today.",
    items: [
      {
        icon: Smartphone,
        title: "App available on Google Play",
        desc: "The Marketplace is published and running. Not a mockup, not a prototype: you can download and use it today.",
        href: PLAY_STORE_URL,
        linkLabel: "View on Google Play",
      },
      {
        icon: BarChart3,
        title: "Ginga Prototipa programme (Sebrae)",
        desc: "Thesis validated in the field with Sebrae and participation in Ginga Prototipa — one of Brazil's leading innovation and prototyping programmes.",
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
        a: "The entrepreneur creates her profile and publishes what she offers; customers find her through the Marketplace and get in touch. Every sale generates income today and, at the same time, the record of economic activity that forms her financial history — the basis of the alternative score and the credit access we are building.",
      },
      {
        q: "Is the app already available?",
        a: "Yes. The EmpowerFI app is published and available on Google Play for Android. The iOS version is in development.",
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
    tagline: "Credit infrastructure for the next generation of entrepreneurs — starting in Brazil.",
    developedBy: "Product developed by",
    cnpjLabel: "Company tax ID (CNPJ)",
    privacy: "Privacy Policy",
    terms: "Terms of Use",
    contact: "Contact",
    rights: "All rights reserved.",
    backToHome: "Back to home",
  },
};
