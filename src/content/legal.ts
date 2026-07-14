import { COMPANY_CITY, COMPANY_LEGAL_NAME, COMPANY_STATE } from "@/config/company";
import { CONTACT_EMAIL } from "@/config/links";

// Content for /privacidade, /termos and their English counterparts.
//
// Good-faith drafts describing the data flows this codebase actually implements
// (contact forms -> Supabase Edge Function -> Resend) and the Marketplace as it
// works today. They must be reviewed by counsel — and reconciled with what the
// app really collects — before being treated as final.
//
// The Portuguese versions are the binding instruments: EmpowerFI is a Brazilian
// entity and these documents are governed by Brazilian law. The English ones are
// convenience translations and say so via `prevailingNote`.

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  description: string;
  lastUpdated: string;
  intro: string;
  /** Shown when this version is a translation of the binding Portuguese text. */
  prevailingNote?: string;
  sections: LegalSection[];
}

const LAST_UPDATED_PT = "14 de julho de 2026";
const LAST_UPDATED_EN = "14 July 2026";

export const privacyPt: LegalDoc = {
  title: "Política de Privacidade",
  description:
    "Como a EmpowerFI coleta, usa, compartilha e protege dados pessoais, e como exercer seus direitos sob a LGPD.",
  lastUpdated: LAST_UPDATED_PT,
  intro:
    "Esta política explica quais dados pessoais a EmpowerFI trata, com que finalidade, com quem eventualmente os compartilha e quais são os seus direitos sobre eles.",
  sections: [
    {
      title: "Quem é o controlador dos seus dados",
      paragraphs: [
        `O controlador dos dados pessoais tratados nesta plataforma é ${COMPANY_LEGAL_NAME}, sociedade estabelecida em ${COMPANY_CITY} – ${COMPANY_STATE}, Brasil, responsável pelo desenvolvimento e pela operação do aplicativo e do site EmpowerFI.`,
        `Para qualquer assunto relacionado a privacidade e proteção de dados, incluindo o exercício dos seus direitos como titular, o canal oficial é o e-mail ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "Quais dados coletamos",
      paragraphs: [
        "Coletamos apenas os dados necessários para operar o Marketplace, responder às suas mensagens e melhorar a plataforma. As categorias são:",
      ],
      bullets: [
        "Dados de cadastro e identificação: nome, e-mail e demais informações que você fornece ao criar seu perfil no aplicativo.",
        "Dados de perfil e oferta: descrição dos produtos ou serviços que você divulga no Marketplace, incluindo textos e imagens que você mesma publica.",
        "Dados de contato: nome, e-mail e conteúdo da mensagem enviados pelos formulários do site.",
        "Dados de uso: informações técnicas geradas na navegação, como páginas acessadas, tipo de dispositivo e dados aproximados de acesso, usados de forma agregada para entender e melhorar o produto.",
      ],
    },
    {
      title: "Para que usamos os seus dados",
      bullets: [
        "Operar o Marketplace e permitir que empreendedoras e clientes se encontrem e se comuniquem.",
        "Responder às mensagens enviadas pelos formulários de contato e enviar a confirmação de recebimento.",
        "Enviar comunicações sobre a plataforma quando você tiver consentido em recebê-las.",
        "Prevenir fraude, abuso e uso indevido, e garantir a segurança da plataforma.",
        "Cumprir obrigações legais e regulatórias aplicáveis.",
      ],
    },
    {
      title: "Bases legais do tratamento",
      paragraphs: [
        "Tratamos dados pessoais com fundamento nas hipóteses previstas na Lei Geral de Proteção de Dados (Lei nº 13.709/2018): execução de contrato e procedimentos preliminares, quando o tratamento é necessário para prestar o serviço que você solicitou; consentimento, para comunicações de marketing; legítimo interesse, para segurança, prevenção a fraudes e melhoria do produto; e cumprimento de obrigação legal ou regulatória, quando aplicável.",
      ],
    },
    {
      title: "Com quem compartilhamos",
      paragraphs: [
        "Não vendemos os seus dados pessoais. Compartilhamos informações apenas com prestadores de serviço que sustentam a operação da plataforma, e sempre limitados ao necessário para a finalidade contratada:",
      ],
      bullets: [
        "Provedores de infraestrutura e banco de dados, que hospedam a aplicação e armazenam os dados da plataforma.",
        "Provedor de envio de e-mails transacionais, utilizado para entregar as mensagens dos formulários e as confirmações de recebimento.",
        "Lojas de aplicativos, no que se refere à distribuição do aplicativo, conforme as políticas de privacidade das respectivas plataformas.",
        "Autoridades públicas, quando houver requisição legal ou ordem judicial.",
      ],
    },
    {
      title: "Transferência internacional",
      paragraphs: [
        "Alguns dos prestadores de serviço mencionados acima podem processar dados em servidores localizados fora do Brasil. Nesses casos, adotamos as salvaguardas exigidas pela LGPD para que o seu dado mantenha o mesmo nível de proteção conferido pela legislação brasileira.",
      ],
    },
    {
      title: "Por quanto tempo guardamos",
      paragraphs: [
        "Mantemos os dados pessoais apenas pelo tempo necessário para cumprir as finalidades descritas nesta política. Dados de conta são mantidos enquanto o seu cadastro estiver ativo; mensagens de contato são mantidas pelo período necessário para o atendimento e o registro histórico do relacionamento. Encerrada a finalidade, os dados são eliminados ou anonimizados, ressalvadas as hipóteses de guarda obrigatória previstas em lei.",
      ],
    },
    {
      title: "Os seus direitos como titular",
      paragraphs: [
        "A LGPD garante a você um conjunto de direitos sobre os seus dados pessoais, que pode exercer a qualquer momento:",
      ],
      bullets: [
        "Confirmar a existência de tratamento e acessar os seus dados.",
        "Corrigir dados incompletos, inexatos ou desatualizados.",
        "Solicitar a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei.",
        "Solicitar a portabilidade dos seus dados a outro fornecedor.",
        "Revogar o consentimento e solicitar a eliminação dos dados tratados com essa base.",
        "Obter informação sobre as entidades com as quais compartilhamos os seus dados.",
        "Opor-se a tratamento realizado com fundamento em legítimo interesse.",
      ],
    },
    {
      title: "Comunicações por e-mail",
      paragraphs: [
        `Se você optar por receber comunicações nossas, poderá cancelar o recebimento a qualquer momento pelo link de descadastro presente em cada mensagem ou escrevendo para ${CONTACT_EMAIL}. O cancelamento das comunicações de marketing não afeta os e-mails necessários para a prestação do serviço, como a confirmação de uma mensagem enviada por você.`,
      ],
    },
    {
      title: "Segurança da informação",
      paragraphs: [
        "Adotamos medidas técnicas e administrativas para proteger os dados pessoais contra acesso não autorizado, perda, alteração ou destruição, incluindo tráfego criptografado, controle de acesso e restrição do dado ao estritamente necessário para cada finalidade. Nenhum sistema é completamente imune a incidentes; caso ocorra um incidente de segurança relevante, comunicaremos os titulares afetados e a Autoridade Nacional de Proteção de Dados nos termos da lei.",
      ],
    },
    {
      title: "Crianças e adolescentes",
      paragraphs: [
        "A plataforma não se destina a menores de 18 anos e não coletamos intencionalmente dados de crianças e adolescentes. Caso identifiquemos um cadastro nessa situação, os dados serão eliminados.",
      ],
    },
    {
      title: "Alterações nesta política",
      paragraphs: [
        "Esta política pode ser atualizada para refletir mudanças na plataforma ou na legislação aplicável. A data da última atualização está indicada no topo desta página, e alterações relevantes serão comunicadas pelos canais oficiais.",
      ],
    },
    {
      title: "Como falar com a gente",
      paragraphs: [
        `Dúvidas, solicitações ou reclamações relacionadas a dados pessoais podem ser enviadas para ${CONTACT_EMAIL}. Responderemos no prazo previsto na legislação aplicável.`,
      ],
    },
  ],
};

export const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  description:
    "How EmpowerFI collects, uses, shares and protects personal data, and how to exercise your rights under Brazil's LGPD.",
  lastUpdated: LAST_UPDATED_EN,
  intro:
    "This policy explains which personal data EmpowerFI processes, for what purpose, who it may be shared with, and what rights you have over it.",
  prevailingNote:
    "This is a convenience translation. EmpowerFI is a Brazilian company and the Portuguese version of this policy is the binding one; in case of any divergence, the Portuguese text prevails.",
  sections: [
    {
      title: "Who controls your data",
      paragraphs: [
        `The controller of the personal data processed on this platform is ${COMPANY_LEGAL_NAME}, a company established in ${COMPANY_CITY} – ${COMPANY_STATE}, Brazil, responsible for developing and operating the EmpowerFI app and website.`,
        `For any matter related to privacy and data protection, including exercising your rights as a data subject, the official channel is ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "What data we collect",
      paragraphs: [
        "We collect only the data needed to run the Marketplace, answer your messages and improve the platform. The categories are:",
      ],
      bullets: [
        "Registration and identification data: name, email and other information you provide when creating your profile in the app.",
        "Profile and offer data: the description of the products or services you publish on the Marketplace, including text and images you upload yourself.",
        "Contact data: name, email and message content submitted through the website forms.",
        "Usage data: technical information generated as you browse, such as pages visited, device type and approximate access data, used in aggregate to understand and improve the product.",
      ],
    },
    {
      title: "What we use your data for",
      bullets: [
        "Running the Marketplace and letting entrepreneurs and customers find and contact each other.",
        "Answering messages sent through the contact forms and sending you a confirmation of receipt.",
        "Sending communications about the platform where you have consented to receive them.",
        "Preventing fraud, abuse and misuse, and keeping the platform secure.",
        "Complying with applicable legal and regulatory obligations.",
      ],
    },
    {
      title: "Legal bases for processing",
      paragraphs: [
        "We process personal data on the bases set out in Brazil's General Data Protection Law (Law No. 13.709/2018): performance of a contract and preliminary procedures, where processing is necessary to deliver the service you asked for; consent, for marketing communications; legitimate interest, for security, fraud prevention and product improvement; and compliance with a legal or regulatory obligation, where applicable.",
      ],
    },
    {
      title: "Who we share it with",
      paragraphs: [
        "We do not sell your personal data. We share information only with service providers that support the platform's operation, and always limited to what the contracted purpose requires:",
      ],
      bullets: [
        "Infrastructure and database providers, which host the application and store the platform's data.",
        "A transactional email provider, used to deliver form messages and confirmations of receipt.",
        "App stores, with respect to distributing the app, subject to their own privacy policies.",
        "Public authorities, where there is a legal request or court order.",
      ],
    },
    {
      title: "International transfers",
      paragraphs: [
        "Some of the service providers mentioned above may process data on servers located outside Brazil. In those cases we apply the safeguards required by the LGPD so that your data keeps the same level of protection granted by Brazilian law.",
      ],
    },
    {
      title: "How long we keep it",
      paragraphs: [
        "We keep personal data only for as long as needed to fulfil the purposes described in this policy. Account data is kept while your registration is active; contact messages are kept for as long as needed to handle the request and keep a record of the relationship. Once the purpose ends, data is deleted or anonymised, except where the law requires us to retain it.",
      ],
    },
    {
      title: "Your rights as a data subject",
      paragraphs: [
        "The LGPD grants you a set of rights over your personal data, which you may exercise at any time:",
      ],
      bullets: [
        "Confirm that processing exists and access your data.",
        "Correct incomplete, inaccurate or outdated data.",
        "Request anonymisation, blocking or deletion of unnecessary data or data processed unlawfully.",
        "Request portability of your data to another provider.",
        "Withdraw consent and request deletion of data processed on that basis.",
        "Obtain information about the entities we share your data with.",
        "Object to processing carried out on the basis of legitimate interest.",
      ],
    },
    {
      title: "Email communications",
      paragraphs: [
        `If you opt in to receive communications from us, you can unsubscribe at any time through the link in each message or by writing to ${CONTACT_EMAIL}. Unsubscribing from marketing communications does not affect emails necessary to provide the service, such as the confirmation of a message you sent.`,
      ],
    },
    {
      title: "Information security",
      paragraphs: [
        "We apply technical and administrative measures to protect personal data against unauthorised access, loss, alteration or destruction, including encrypted traffic, access control and limiting data to what each purpose strictly requires. No system is completely immune to incidents; should a material security incident occur, we will notify affected data subjects and Brazil's National Data Protection Authority as required by law.",
      ],
    },
    {
      title: "Children and adolescents",
      paragraphs: [
        "The platform is not intended for people under 18 and we do not knowingly collect data from children or adolescents. If we identify such a registration, the data will be deleted.",
      ],
    },
    {
      title: "Changes to this policy",
      paragraphs: [
        "This policy may be updated to reflect changes to the platform or to applicable law. The date of the latest update is shown at the top of this page, and material changes will be communicated through the official channels.",
      ],
    },
    {
      title: "How to reach us",
      paragraphs: [
        `Questions, requests or complaints about personal data can be sent to ${CONTACT_EMAIL}. We will respond within the period set by applicable law.`,
      ],
    },
  ],
};

export const termsPt: LegalDoc = {
  title: "Termos de Uso",
  description:
    "As regras de uso do aplicativo e do site EmpowerFI: o que a plataforma é, quem pode usar, direitos e responsabilidades de cada parte.",
  lastUpdated: LAST_UPDATED_PT,
  intro:
    "Estes termos explicam o que a EmpowerFI faz, o que você pode esperar da plataforma e quais são as responsabilidades de cada parte.",
  sections: [
    {
      title: "Aceitação destes termos",
      paragraphs: [
        `Estes Termos de Uso regem o acesso e a utilização do aplicativo e do site EmpowerFI, operados por ${COMPANY_LEGAL_NAME}, com sede em ${COMPANY_CITY} – ${COMPANY_STATE}, Brasil. Ao criar um perfil ou utilizar a plataforma, você declara que leu, compreendeu e concorda com estes termos.`,
        "Se você não concordar com qualquer disposição aqui prevista, não utilize a plataforma.",
      ],
    },
    {
      title: "O que a EmpowerFI é",
      paragraphs: [
        "A EmpowerFI é um Marketplace: uma plataforma que conecta mulheres empreendedoras a pessoas interessadas em seus produtos e serviços, dando visibilidade às ofertas e facilitando o contato entre as partes.",
        "A EmpowerFI não é instituição financeira e, nesta etapa, não realiza operações de crédito, não intermedeia pagamentos e não é parte nos negócios celebrados entre empreendedoras e clientes. A relação comercial, incluindo preço, prazo, entrega, pagamento e garantia, é estabelecida diretamente entre as partes envolvidas.",
      ],
    },
    {
      title: "Quem pode usar",
      paragraphs: [
        "A plataforma destina-se a maiores de 18 anos com plena capacidade civil. Empreendedoras podem divulgar produtos e serviços independentemente de possuírem empresa formalizada; clientes podem navegar e contratar livremente as ofertas disponíveis.",
        "Você é responsável pela veracidade das informações fornecidas no cadastro e por mantê-las atualizadas.",
      ],
    },
    {
      title: "Sua conta",
      paragraphs: [
        "O acesso a determinadas funcionalidades exige a criação de uma conta. As credenciais são pessoais e intransferíveis, e você é responsável por mantê-las em sigilo e por toda atividade realizada na sua conta.",
        `Caso identifique uso não autorizado, comunique imediatamente pelo e-mail ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "Conteúdo publicado por você",
      paragraphs: [
        "Você mantém a titularidade sobre os textos, imagens e demais conteúdos que publica. Ao publicá-los, você concede à EmpowerFI uma licença não exclusiva e gratuita para exibi-los na plataforma e em materiais de divulgação do Marketplace, com a finalidade de dar visibilidade à sua oferta.",
        "Você declara que possui os direitos necessários sobre o conteúdo publicado e é responsável por ele, inclusive pela exatidão da descrição dos produtos e serviços oferecidos.",
      ],
    },
    {
      title: "Uso permitido e condutas vedadas",
      paragraphs: ["Ao utilizar a plataforma, você concorda em não:"],
      bullets: [
        "Publicar conteúdo falso, enganoso, ofensivo, discriminatório ou que viole direitos de terceiros.",
        "Oferecer produtos ou serviços ilícitos ou cuja comercialização seja vedada por lei.",
        "Utilizar a plataforma para fraude, spam, assédio ou qualquer prática abusiva.",
        "Coletar dados de outras pessoas usuárias por meios automatizados ou sem autorização.",
        "Interferir no funcionamento da plataforma, tentar obter acesso não autorizado ou contornar medidas de segurança.",
      ],
    },
    {
      title: "Modelo freemium, gratuidade e serviços pagos",
      paragraphs: [
        "O cadastro e o uso das funcionalidades básicas do Marketplace são gratuitos para as empreendedoras, e a contratação é sempre gratuita para os clientes. A EmpowerFI não cobra comissão sobre os negócios realizados por meio da plataforma: o valor acordado entre as partes é integralmente delas.",
        "A plataforma adota o modelo freemium. Poderemos oferecer planos de assinatura com funcionalidades adicionais, cujo preço, escopo e condições serão apresentados de forma clara e prévia. A adesão a qualquer plano pago depende da sua contratação ativa e do seu aceite expresso: nenhum valor é cobrado de você sem isso, e deixar de assinar não implica a perda do acesso gratuito às funcionalidades básicas.",
      ],
    },
    {
      title: "Moderação e encerramento",
      paragraphs: [
        "Podemos remover conteúdo e suspender ou encerrar contas que violem estes termos ou a legislação aplicável, mediante comunicação sempre que possível. Você pode encerrar sua conta a qualquer momento, sem custo, solicitando pelo canal de contato.",
      ],
    },
    {
      title: "Propriedade intelectual da plataforma",
      paragraphs: [
        "A marca EmpowerFI, o aplicativo, o site, seus códigos, layouts e demais elementos são de titularidade da EmpowerFI e protegidos pela legislação de propriedade intelectual. Estes termos não transferem a você qualquer direito sobre esses ativos, além do uso da plataforma conforme aqui previsto.",
      ],
    },
    {
      title: "Limitação de responsabilidade",
      paragraphs: [
        "A EmpowerFI empenha-se em manter a plataforma disponível e segura, mas não garante funcionamento ininterrupto ou livre de falhas, e pode realizar manutenções e alterações no serviço.",
        "Por não ser parte nas negociações realizadas entre empreendedoras e clientes, a EmpowerFI não se responsabiliza pela qualidade, entrega, pagamento ou cumprimento dos negócios firmados entre as partes. Nada nestes termos afasta os direitos assegurados a você pelo Código de Defesa do Consumidor e demais normas de ordem pública.",
      ],
    },
    {
      title: "Privacidade",
      paragraphs: [
        "O tratamento de dados pessoais na plataforma é descrito na Política de Privacidade, que integra estes Termos de Uso.",
      ],
    },
    {
      title: "Alterações destes termos",
      paragraphs: [
        "Estes termos podem ser atualizados a qualquer momento para refletir mudanças na plataforma ou na legislação. A data da última atualização está indicada no topo desta página, e alterações relevantes serão comunicadas pelos canais oficiais. O uso continuado após a atualização caracteriza concordância com a nova versão.",
      ],
    },
    {
      title: "Lei aplicável e foro",
      paragraphs: [
        `Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca de ${COMPANY_CITY} – ${COMPANY_STATE} para dirimir controvérsias decorrentes destes termos, ressalvado, no caso de relações de consumo, o direito de a pessoa consumidora optar pelo foro de seu domicílio.`,
      ],
    },
    {
      title: "Contato",
      paragraphs: [`Dúvidas sobre estes Termos de Uso podem ser enviadas para ${CONTACT_EMAIL}.`],
    },
  ],
};

export const termsEn: LegalDoc = {
  title: "Terms of Use",
  description:
    "The rules for using the EmpowerFI app and website: what the platform is, who can use it, and each party's rights and responsibilities.",
  lastUpdated: LAST_UPDATED_EN,
  intro:
    "These terms explain what EmpowerFI does, what you can expect from the platform and what each party is responsible for.",
  prevailingNote:
    "This is a convenience translation. EmpowerFI is a Brazilian company and the Portuguese version of these terms is the binding one; in case of any divergence, the Portuguese text prevails.",
  sections: [
    {
      title: "Acceptance of these terms",
      paragraphs: [
        `These Terms of Use govern access to and use of the EmpowerFI app and website, operated by ${COMPANY_LEGAL_NAME}, headquartered in ${COMPANY_CITY} – ${COMPANY_STATE}, Brazil. By creating a profile or using the platform, you confirm that you have read, understood and agree to these terms.`,
        "If you do not agree with any provision set out here, do not use the platform.",
      ],
    },
    {
      title: "What EmpowerFI is",
      paragraphs: [
        "EmpowerFI is a Marketplace: a platform that connects women entrepreneurs with people interested in their products and services, giving their offers visibility and making it easier for the parties to get in touch.",
        "EmpowerFI is not a financial institution and, at this stage, does not carry out credit operations, does not process payments and is not a party to the deals made between entrepreneurs and customers. The commercial relationship — including price, deadline, delivery, payment and warranty — is established directly between the parties involved.",
      ],
    },
    {
      title: "Who can use it",
      paragraphs: [
        "The platform is intended for people over 18 with full legal capacity. Entrepreneurs may promote products and services whether or not they have a formally registered company; customers may browse and hire the available offers freely.",
        "You are responsible for the accuracy of the information provided at registration and for keeping it up to date.",
      ],
    },
    {
      title: "Your account",
      paragraphs: [
        "Access to certain features requires creating an account. Credentials are personal and non-transferable, and you are responsible for keeping them confidential and for all activity carried out under your account.",
        `If you identify unauthorised use, report it immediately to ${CONTACT_EMAIL}.`,
      ],
    },
    {
      title: "Content you publish",
      paragraphs: [
        "You retain ownership of the text, images and other content you publish. By publishing it, you grant EmpowerFI a non-exclusive, royalty-free licence to display it on the platform and in Marketplace promotional materials, for the purpose of giving your offer visibility.",
        "You confirm that you hold the necessary rights over the content you publish and are responsible for it, including the accuracy of the description of the products and services offered.",
      ],
    },
    {
      title: "Permitted use and prohibited conduct",
      paragraphs: ["When using the platform, you agree not to:"],
      bullets: [
        "Publish false, misleading, offensive or discriminatory content, or content that infringes third-party rights.",
        "Offer unlawful products or services, or ones whose sale is prohibited by law.",
        "Use the platform for fraud, spam, harassment or any abusive practice.",
        "Collect other users' data by automated means or without authorisation.",
        "Interfere with the platform's operation, attempt unauthorised access or circumvent security measures.",
      ],
    },
    {
      title: "Freemium model, free use and paid services",
      paragraphs: [
        "Signing up and using the Marketplace's basic features is free for entrepreneurs, and hiring is always free for customers. EmpowerFI charges no commission on the deals made through the platform: the amount agreed between the parties is entirely theirs.",
        "The platform follows a freemium model. We may offer subscription plans with additional features, whose price, scope and conditions will be presented clearly and in advance. Joining any paid plan depends on you actively signing up and expressly accepting it: nothing is charged to you otherwise, and choosing not to subscribe does not cost you free access to the basic features.",
      ],
    },
    {
      title: "Moderation and termination",
      paragraphs: [
        "We may remove content and suspend or terminate accounts that breach these terms or applicable law, with notice whenever possible. You may close your account at any time, free of charge, by requesting it through the contact channel.",
      ],
    },
    {
      title: "Platform intellectual property",
      paragraphs: [
        "The EmpowerFI brand, the app, the website, their code, layouts and other elements are owned by EmpowerFI and protected by intellectual property law. These terms do not transfer any right over those assets to you beyond using the platform as set out here.",
      ],
    },
    {
      title: "Limitation of liability",
      paragraphs: [
        "EmpowerFI works to keep the platform available and secure, but does not guarantee uninterrupted or error-free operation, and may carry out maintenance and make changes to the service.",
        "As EmpowerFI is not a party to the negotiations between entrepreneurs and customers, it is not responsible for the quality, delivery, payment or fulfilment of the deals made between them. Nothing in these terms removes the rights granted to you by Brazil's Consumer Protection Code and other mandatory rules of public policy.",
      ],
    },
    {
      title: "Privacy",
      paragraphs: [
        "The processing of personal data on the platform is described in the Privacy Policy, which forms part of these Terms of Use.",
      ],
    },
    {
      title: "Changes to these terms",
      paragraphs: [
        "These terms may be updated at any time to reflect changes to the platform or to the law. The date of the latest update is shown at the top of this page, and material changes will be communicated through the official channels. Continued use after an update constitutes agreement with the new version.",
      ],
    },
    {
      title: "Governing law and jurisdiction",
      paragraphs: [
        `These terms are governed by the laws of the Federative Republic of Brazil. The courts of ${COMPANY_CITY} – ${COMPANY_STATE} are elected to settle disputes arising from these terms, except that, in consumer relationships, the consumer retains the right to choose the courts of their own domicile.`,
      ],
    },
    {
      title: "Contact",
      paragraphs: [`Questions about these Terms of Use can be sent to ${CONTACT_EMAIL}.`],
    },
  ],
};
