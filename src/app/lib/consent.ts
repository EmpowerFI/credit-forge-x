// The consent an entrepreneur gives, in the words she sees (version
// consent-v2). The database stores which uses she allowed and this version;
// the chain stores a hash of the record. Changing the wording means a new
// version here and in docs/PRIVACY.md, and the database's consent_text_version().
// The Portuguese wording is a translation of the same version, with the same
// meaning: the version recorded does not depend on the language she reads.

import { localized, tr } from "../i18n";

export const CONSENT_TEXT_VERSION = "consent-v2";

export const SCOPES = ["assessment", "partner", "investors", "impact"] as const;
export type Scope = (typeof SCOPES)[number];
export type Choices = Record<Scope, boolean>;

export interface ScopeText {
  title: string;
  /** Her data this use reads. */
  uses: string;
  /** Who sees what comes of it. */
  who: string;
  /** What never leaves, whatever she chooses. */
  never: string;
  /** What happens without it. */
  without: string;
  /** The scope it builds on: no sharing of what is not assessed. */
  needs?: Scope;
}

export const SCOPE_TEXT: Record<Scope, ScopeText> = localized({
  assessment: {
    title: { en: "Assess my business", pt: "Avaliar meu negócio" },
    uses: {
      en: "My monthly check-ins, my education progress and my community's verification.",
      pt: "Meus check-ins mensais, meu progresso nos módulos de educação e a verificação da minha comunidade.",
    },
    who: {
      en: "Me, my community's leader, and EmpowerFI's auditors.",
      pt: "Eu, o líder da minha comunidade e os auditores da EmpowerFI.",
    },
    never: {
      en: "My figures never go on chain: only a hash of each record does.",
      pt: "Meus números nunca vão para a blockchain: só um hash de cada registro vai.",
    },
    without: {
      en: "I can keep reporting and learning, but nothing is assessed and I cannot ask for credit.",
      pt: "Posso continuar informando meus números e aprendendo, mas nada é avaliado e não posso pedir crédito.",
    },
  },
  partner: {
    title: { en: "Share my request with EmpowerFI's P2P desk", pt: "Compartilhar meu pedido com a mesa P2P da EmpowerFI" },
    uses: {
      en: "My request, EmpowerFI's assessment of it, and my indicators, with sales and result rounded to R$ 100.",
      pt: "Meu pedido, a avaliação da EmpowerFI sobre ele e meus indicadores, com vendas e resultado arredondados para R$ 100.",
    },
    who: {
      en: "EmpowerFI's P2P desk, which formalises and services loans funded by P2P investors.",
      pt: "A mesa P2P da EmpowerFI, que formaliza os empréstimos financiados por investidores P2P e acompanha seus pagamentos.",
    },
    never: {
      en: "The desk sees a code, not my name, my business's name or my monthly figures.",
      pt: "A mesa vê um código, não meu nome, o nome do meu negócio nem meus números mensais.",
    },
    without: {
      en: "I cannot ask for credit here, because the desk has to see the request to formalise a loan.",
      pt: "Não posso pedir crédito aqui, porque a mesa precisa ver o pedido para formalizar um empréstimo.",
    },
    needs: "assessment",
  },
  investors: {
    title: { en: "Show my request to investors, without my name", pt: "Mostrar meu pedido a investidores, sem meu nome" },
    uses: {
      en: "Purpose, sector, amount, term, my community, and the grades of the assessment.",
      pt: "Finalidade, setor, valor, prazo, minha comunidade e as notas da avaliação.",
    },
    who: { en: "Investors in EmpowerFI's console.", pt: "Investidores no console da EmpowerFI." },
    never: {
      en: "My name, my words, my figures and my bank details. On chain, no investment points to me.",
      pt: "Meu nome, minhas palavras, meus números e meus dados bancários. Na blockchain, nenhum investimento aponta para mim.",
    },
    without: {
      en: "My request cannot be funded: in this P2P model, investors fund every loan. If I withdraw this later, investors are refunded, unless the loan has already been paid out.",
      pt: "Meu pedido não pode ser captado: neste modelo P2P, os investidores financiam todos os empréstimos. Se eu retirar esta autorização depois, os investidores são reembolsados, a menos que o empréstimo já tenha sido desembolsado.",
    },
    needs: "partner",
  },
  impact: {
    title: { en: "Count my business in impact figures", pt: "Incluir meu negócio nos números de impacto" },
    uses: {
      en: "Whether my sales changed after a loan, and how the capital was used.",
      pt: "Se minhas vendas mudaram depois de um empréstimo e como o capital foi usado.",
    },
    who: {
      en: "Only as totals, in my community's and EmpowerFI's reports.",
      pt: "Só como totais, nos relatórios da minha comunidade e da EmpowerFI.",
    },
    never: {
      en: "My figures on their own. A total never names anyone.",
      pt: "Meus números isolados. Um total nunca identifica ninguém.",
    },
    without: {
      en: "My outcome is left out of the totals. Nothing else changes.",
      pt: "Meu resultado fica fora dos totais. Nada mais muda.",
    },
  },
});

/** Turning a use off turns off what builds on it; turning one on turns on what it needs. */
export function setScope(choices: Choices, scope: Scope, on: boolean): Choices {
  const next = { ...choices, [scope]: on };
  if (!on) {
    for (const s of SCOPES) if (SCOPE_TEXT[s].needs === scope) Object.assign(next, setScope(next, s, false));
  } else {
    const needs = SCOPE_TEXT[scope].needs;
    if (needs && !next[needs]) Object.assign(next, setScope(next, needs, true));
  }
  return next;
}

export const NONE: Choices = { assessment: false, partner: false, investors: false, impact: false };
export const ALL: Choices = { assessment: true, partner: true, investors: true, impact: true };

export interface ConsentRecord {
  id: string;
  consent_no: number;
  text_version: string;
  assessment: boolean;
  partner: boolean;
  investors: boolean;
  impact: boolean;
  channel: "app" | "community";
  at: string;
  proof: { kind: string; entity_id: string; status: string; signature: string | null; reconcile: string | null } | null;
}

export const choicesOf = (r: Pick<ConsentRecord, Scope> | null | undefined): Choices =>
  r ? { assessment: r.assessment, partner: r.partner, investors: r.investors, impact: r.impact } : NONE;

export const sameChoices = (a: Choices, b: Choices) => SCOPES.every((s) => a[s] === b[s]);

/** What saving would change, in her words. */
export function consequences(from: Choices | null, to: Choices): string[] {
  const out: string[] = [];
  const was = from ?? NONE;
  if (was.assessment && !to.assessment) {
    out.push(tr({
      en: "New assessments stop. The ones already made stay on record, with their proofs.",
      pt: "Novas avaliações param. As que já foram feitas continuam registradas, com suas provas.",
    }));
  }
  if (was.partner && !to.partner) {
    out.push(tr({
      en: "New requests are not sent to EmpowerFI's P2P desk. Loans already formalised keep their obligations.",
      pt: "Novos pedidos não são enviados à mesa P2P da EmpowerFI. Empréstimos já formalizados mantêm suas obrigações.",
    }));
  }
  if (was.investors && !to.investors) {
    out.push(tr({
      en: "An open request leaves the investor market, and anyone who funded it is refunded, unless the loan has already been paid out.",
      pt: "Um pedido em aberto sai do mercado de investidores, e quem investiu nele é reembolsado, a menos que o empréstimo já tenha sido desembolsado.",
    }));
  }
  if (!was.investors && to.investors) {
    out.push(tr({
      en: "An open request, never funded, is shown to investors without your name.",
      pt: "Um pedido em aberto, ainda sem captação, é mostrado a investidores sem o seu nome.",
    }));
  }
  if (was.impact !== to.impact) {
    out.push(to.impact
      ? tr({ en: "Your outcome will count in impact totals.", pt: "Seu resultado vai contar nos totais de impacto." })
      : tr({ en: "Your outcome leaves the impact totals.", pt: "Seu resultado sai dos totais de impacto." }));
  }
  return out;
}

export const CHANNEL_LABEL: Record<ConsentRecord["channel"], string> = localized({
  app: { en: "given in the app", pt: "dado no app" },
  community: { en: "recorded by the community from the signed form", pt: "registrado pela comunidade a partir do formulário assinado" },
});
