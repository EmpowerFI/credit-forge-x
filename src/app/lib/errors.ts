import { localized, tr } from "../i18n";

// The database RPCs raise stable snake_case keys (see the community-flow
// migration). This is where they become sentences, in both languages.
const MESSAGES: Record<string, string> = localized({
  only_leaders_create_communities: {
    en: "Only community leaders can create a community.",
    pt: "Só líderes de comunidade podem criar uma comunidade.",
  },
  only_admins_verify_communities: {
    en: "Only EmpowerFI admins review communities.",
    pt: "Só os admins da EmpowerFI revisam comunidades.",
  },
  cannot_verify_own_community: {
    en: "You cannot verify a community you lead.",
    pt: "Você não pode verificar uma comunidade que lidera.",
  },
  community_already_reviewed: {
    en: "This community has already been reviewed.",
    pt: "Esta comunidade já foi revisada.",
  },
  community_not_found: { en: "Community not found.", pt: "Comunidade não encontrada." },
  community_not_pending: {
    en: "This community is no longer pending review.",
    pt: "Esta comunidade não está mais aguardando revisão.",
  },
  rejection_needs_a_reason: {
    en: "Say why the community is being rejected.",
    pt: "Diga por que a comunidade está sendo rejeitada.",
  },
  only_the_leader_enrolls: {
    en: "Only the leader of this community can enroll members.",
    pt: "Só a liderança desta comunidade pode inscrever integrantes.",
  },
  community_not_verified: {
    en: "Members can only be enrolled once the community is verified.",
    pt: "Integrantes só podem ser inscritas depois que a comunidade for verificada.",
  },
  entrepreneur_needs_a_name: { en: "Enter the entrepreneur's name.", pt: "Informe o nome da empreendedora." },
  entrepreneur_not_found: { en: "Entrepreneur not found.", pt: "Empreendedora não encontrada." },
  already_a_member: {
    en: "She is already a member of this community.",
    pt: "Ela já é integrante desta comunidade.",
  },
  not_allowed_to_audit: { en: "You do not have access to this proof.", pt: "Você não tem acesso a esta prova." },
  not_allowed_to_see_portfolio: {
    en: "The portfolio is for capital providers, auditors and EmpowerFI.",
    pt: "A carteira é para provedores de capital, auditores e a EmpowerFI.",
  },
  anchor_not_found: {
    en: "There is no proof recorded for this yet.",
    pt: "Ainda não há prova registrada para isto.",
  },
  not_allowed_to_record_progress: {
    en: "Only she, or a leader of her community, can record her progress.",
    pt: "Só ela, ou a liderança da comunidade dela, pode registrar o progresso dela.",
  },
  module_not_found: { en: "Module not found.", pt: "Módulo não encontrado." },
  programme_not_open_to_her: {
    en: "This programme belongs to another community.",
    pt: "Este programa pertence a outra comunidade.",
  },
  not_allowed_to_report: {
    en: "Only she, or a leader of her community, can report her months.",
    pt: "Só ela, ou a liderança da comunidade dela, pode informar os meses dela.",
  },
  not_enrolled: {
    en: "Check-ins start once you belong to a verified community.",
    pt: "Os check-ins começam quando você faz parte de uma comunidade verificada.",
  },
  invalid_period: { en: "That month is not valid.", pt: "Esse mês não é válido." },
  period_in_future: { en: "That month has not happened yet.", pt: "Esse mês ainda não chegou." },
  period_too_old: {
    en: "Only the last twelve months can be reported.",
    pt: "Só dá para informar os últimos doze meses.",
  },
  checkin_exists_for_period: {
    en: "That month has already been reported.",
    pt: "Esse mês já foi informado.",
  },
  not_allowed_to_assess: {
    en: "You cannot request this assessment.",
    pt: "Você não pode pedir esta avaliação.",
  },
  only_the_entrepreneur_declares_intent: {
    en: "Only the entrepreneur herself can ask for credit.",
    pt: "Só a própria empreendedora pode pedir crédito.",
  },
  not_credit_ready: {
    en: "A credit request comes after the business is ready.",
    pt: "O pedido de crédito vem depois que o negócio está pronto.",
  },
  intent_already_active: { en: "You already have an open request.", pt: "Você já tem um pedido aberto." },
  no_active_intent: {
    en: "There is no open request to withdraw.",
    pt: "Não há pedido aberto para retirar.",
  },
  not_in_credit_pipeline: {
    en: "Eligibility is assessed once the business is ready and a request is open.",
    pt: "A elegibilidade é avaliada quando o negócio está pronto e há um pedido aberto.",
  },
  only_admins_refer: {
    en: "Only EmpowerFI admins refer opportunities.",
    pt: "Só os admins da EmpowerFI encaminham oportunidades.",
  },
  opportunity_not_referable: {
    en: "This opportunity cannot be referred now.",
    pt: "Esta oportunidade não pode ser encaminhada agora.",
  },
  no_matching_partner: {
    en: "EmpowerFI's P2P desk does not cover this amount and purpose.",
    pt: "A mesa P2P da EmpowerFI não atende este valor e esta finalidade.",
  },
  not_your_opportunity: {
    en: "This opportunity is not on your desk.",
    pt: "Esta oportunidade não está na sua mesa.",
  },
  opportunity_not_awaiting_decision: {
    en: "This opportunity is no longer before formalisation.",
    pt: "Esta oportunidade não está mais aguardando formalização.",
  },
  approval_above_opportunity: {
    en: "The approved amount cannot exceed the opportunity.",
    pt: "O valor aprovado não pode passar do valor da oportunidade.",
  },
  not_your_loan: { en: "This loan is not yours to manage.", pt: "Este empréstimo não está sob sua gestão." },
  approval_comes_from_the_partner_decision: {
    en: "A loan is formalised once investors have funded it.",
    pt: "O empréstimo é formalizado quando os investidores concluem a captação.",
  },
  approval_is_formalisation: {
    en: "There is no separate approval: formalise the loan once investors have funded it.",
    pt: "Não há aprovação separada: formalize o empréstimo quando os investidores concluírem a captação.",
  },
  not_allowed_to_see_capital: {
    en: "The capital pools are for investors, EmpowerFI's P2P desk, auditors and admins.",
    pt: "Os pools de capital são para investidores, a mesa P2P da EmpowerFI, auditores e admins.",
  },
  domestic_pool_is_simulated: {
    en: "The engine routed this one to Brazilian capital: a domestic desk funds it in reais, and this console allocates in USDC.",
    pt: "O motor roteou esta para o capital brasileiro: uma mesa doméstica financia em reais, e este console aloca em USDC.",
  },
  not_a_domestic_opportunity: {
    en: "This opportunity is funded by the global pool, in USDC.",
    pt: "Esta oportunidade é captada pelo pool global, em USDC.",
  },
  not_allocated: {
    en: "No pool has been allocated to this opportunity yet.",
    pt: "Ainda não há pool alocado para esta oportunidade.",
  },
  invalid_loan_transition: { en: "That status change is not allowed.", pt: "Essa mudança de status não é permitida." },
  instalments_outstanding: { en: "Some instalments are still unpaid.", pt: "Ainda há parcelas sem pagamento." },
  loan_not_repaying: {
    en: "Payments start once the loan is disbursed.",
    pt: "Os pagamentos começam depois que o empréstimo é desembolsado.",
  },
  invalid_instalment: {
    en: "That instalment number is outside the term.",
    pt: "Esse número de parcela está fora do prazo.",
  },
  instalment_already_paid: { en: "That instalment is already recorded.", pt: "Essa parcela já está registrada." },
  not_allowed_to_see_costs: { en: "You cannot see these costs.", pt: "Você não pode ver estes custos." },
  not_allowed_to_measure: {
    en: "Only EmpowerFI measures a loan's outcome.",
    pt: "Só a EmpowerFI mede o resultado de um empréstimo.",
  },
  loan_not_disbursed: {
    en: "An outcome is measured once the loan has reached the business.",
    pt: "O resultado é medido depois que o empréstimo chega ao negócio.",
  },
  not_enough_history: {
    en: "An outcome needs two reported months on each side of the loan.",
    pt: "Para medir o resultado, são precisos dois meses informados antes e depois do empréstimo.",
  },
  no_consent_to_assess: {
    en: "She has not allowed her data to be used for an assessment. Her consent comes first.",
    pt: "Ela não autorizou o uso dos dados dela em uma avaliação. O consentimento dela vem primeiro.",
  },
  no_consent_to_share_with_partner: {
    en: "Asking for credit means EmpowerFI's P2P desk sees the request. Allow that in your consent first.",
    pt: "Pedir crédito significa que a mesa P2P da EmpowerFI vê o pedido. Autorize isso antes no seu consentimento.",
  },
  consent_scope_needs_the_one_before: {
    en: "Each use builds on the one before: nothing is shared that is not assessed.",
    pt: "Cada uso depende do anterior: nada é compartilhado sem ser avaliado.",
  },
  every_scope_needs_an_answer: { en: "Answer each of the four uses.", pt: "Responda a cada um dos quatro usos." },
  not_allowed_to_record_consent: {
    en: "Only she, or a leader of her community, can record her consent.",
    pt: "Só ela, ou a liderança da comunidade dela, pode registrar o consentimento dela.",
  },
  not_an_auditor: {
    en: "The audit console is for auditors and EmpowerFI admins.",
    pt: "O console de auditoria é para auditores e admins da EmpowerFI.",
  },
  not_fully_funded: {
    en: "Investors are still funding this opportunity: disburse once it is funded.",
    pt: "Os investidores ainda estão captando esta oportunidade: desembolse quando ela estiver 100% captada.",
  },
  zcash_not_configured: {
    en: "EmpowerFI's Zcash treasury is not set up yet.",
    pt: "A tesouraria Zcash da EmpowerFI ainda não está configurada.",
  },
  amount_too_small: { en: "The smallest allocation is 1 USDC.", pt: "A menor alocação é de 1 USDC." },
  exceeds_remaining: {
    en: "That is more than is still open to fund, counting payments on their way.",
    pt: "É mais do que ainda falta captar, contando os pagamentos a caminho.",
  },
  opportunity_not_open: {
    en: "This opportunity is no longer raising.",
    pt: "Esta oportunidade não está mais em captação.",
  },
  not_an_investor: { en: "Investing is for capital providers.", pt: "Investir é para provedores de capital." },
  not_your_request: { en: "This payment request is not yours.", pt: "Esta solicitação de pagamento não é sua." },
  not_a_partner: {
    en: "The P2P desk is for EmpowerFI's desk, auditors and admins.",
    pt: "A mesa P2P é para a equipe da mesa da EmpowerFI, auditores e admins.",
  },
  report_not_found: {
    en: "This report is not available: the link is wrong, or it was closed.",
    pt: "Este relatório não está disponível: o link está errado ou foi encerrado.",
  },
  invalid_checks: { en: "Those checks could not be recorded.", pt: "Não foi possível registrar essas verificações." },
  invalid_zcash_address: {
    en: "That is not a shielded Zcash testnet address. Use a unified (utest1…) or Sapling (ztestsapling1…) address: returns stay shielded.",
    pt: "Este não é um endereço blindado da testnet Zcash. Use um endereço unified (utest1…) ou Sapling (ztestsapling1…): os retornos continuam blindados.",
  },
  // Since a wallet position may also be repaid in shielded ZEC, what is left out
  // is a simulated one — it has nothing to send — and any other mode.
  not_a_shielded_position: {
    en: "This position has nothing to send in ZEC: a simulated allocation moves no money.",
    pt: "Esta posição não tem nada a enviar em ZEC: uma alocação simulada não move dinheiro.",
  },
  not_your_position: { en: "This position is not yours.", pt: "Esta posição não é sua." },
  ramp_not_configured: {
    en: "The MoneyGram sandbox is not set up on this environment.",
    pt: "O sandbox da MoneyGram não está configurado neste ambiente.",
  },
  ramp_amount_out_of_range: {
    en: "MoneyGram's sandbox quotes from 2 to 200 USDC.",
    pt: "O sandbox da MoneyGram faz cotações de 2 a 200 USDC.",
  },
  ramp_declined: {
    en: "MoneyGram's sandbox would not quote this amount.",
    pt: "O sandbox da MoneyGram não cotou este valor.",
  },
  ramp_unavailable: {
    en: "MoneyGram's sandbox did not answer. Try again in a moment.",
    pt: "O sandbox da MoneyGram não respondeu. Tente de novo em instantes.",
  },
  reason_required: {
    en: "Say why. Investors and the audit trail will see the reason.",
    pt: "Diga o motivo. Os investidores e a trilha de auditoria vão ver.",
  },
  not_a_capital_operator: {
    en: "Routing capital is for capital providers and EmpowerFI.",
    pt: "Encaminhar capital é para provedores de capital e a EmpowerFI.",
  },
  partner_consent_missing: {
    en: "She has not agreed to a partner being involved, so no third-party route can be recommended for her.",
    pt: "Ela não concordou com o envolvimento de um parceiro, então nenhuma rota de terceiros pode ser recomendada para ela.",
  },
  capital_network_disabled: {
    en: "The capital network is switched off.",
    pt: "A rede de capital está desligada.",
  },
  opportunity_not_found: { en: "Opportunity not found.", pt: "Oportunidade não encontrada." },
});

export function describeError(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  if (Object.prototype.hasOwnProperty.call(MESSAGES, message)) return MESSAGES[message];
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) {
    return tr({
      en: "Cannot reach the platform right now. Check the connection and try again.",
      pt: "Não foi possível acessar a plataforma agora. Verifique a conexão e tente de novo.",
    });
  }
  if (/jwt expired|invalid jwt|refresh token/i.test(message)) {
    return tr({ en: "Your session has expired. Sign in again.", pt: "Sua sessão expirou. Entre de novo." });
  }
  return message;
}
