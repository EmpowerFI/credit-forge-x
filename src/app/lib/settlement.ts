import type { Tone } from "../components/product/StatusPill";
import { localized } from "../i18n";

// Settlement: how capital reaches her business and comes back, and which of
// its legs are real on devnet, simulated at a quote, or mocks.

export type Reality = "real" | "zcash" | "sandbox" | "simulated" | "mock" | "indicative";

export const REALITY: Record<Reality, { label: string; tone: Tone }> = localized({
  real: { label: { en: "Real · Solana devnet", pt: "Real · Solana devnet" }, tone: "positive" },
  zcash: { label: { en: "Real · Zcash testnet", pt: "Real · Zcash testnet" }, tone: "positive" },
  sandbox: { label: { en: "Sandbox · MoneyGram", pt: "Sandbox · MoneyGram" }, tone: "info" },
  simulated: { label: { en: "Simulated", pt: "Simulado" }, tone: "caution" },
  mock: { label: { en: "Mock", pt: "Fictício" }, tone: "neutral" },
  indicative: { label: { en: "Indicative", pt: "Indicativo" }, tone: "info" },
});

/** What is real in this demo, leg by leg. */
export const WHAT_IS_REAL: { what: string; reality: Reality; note: string }[] = localized([
  {
    what: { en: "The two P2P pools and their liquidity", pt: "Os dois pools P2P e sua liquidez" },
    reality: "simulated",
    note: {
      en: "Domestic P2P in reais and Global P2P in USDC: capital, returns and policies are assumptions of this prototype.",
      pt: "P2P Doméstico em reais e P2P Global em USDC: capital, retornos e políticas são premissas deste protótipo.",
    },
  },
  {
    what: { en: "Domestic allocations in reais", pt: "Alocações domésticas em reais" },
    reality: "simulated",
    note: {
      en: "No bank transfer or Pix: an allocation recorded and proven on Solana, marked simulated.",
      pt: "Sem transferência bancária nem Pix: uma alocação registrada e provada na Solana, marcada como simulada.",
    },
  },
  {
    what: { en: "Devnet SOL and USDC", pt: "SOL e USDC da devnet" },
    reality: "real",
    note: { en: "Circle's devnet USDC. Test tokens with no value.", pt: "USDC da Circle na devnet. Tokens de teste, sem valor." },
  },
  {
    what: { en: "Wallet signing and deposits into the vault", pt: "Assinatura na carteira e depósitos no cofre" },
    reality: "real",
    note: {
      en: "A token transfer to the program's vault, read back from chain before it is allocated.",
      pt: "Uma transferência de tokens para o cofre do programa, lida de volta na blockchain antes de ser alocada.",
    },
  },
  {
    what: { en: "Paying with shielded ZEC", pt: "Pagamento com ZEC blindado" },
    reality: "zcash",
    note: { en: "A real payment, read with the treasury's viewing key.", pt: "Um pagamento real, lido com a chave de visualização da tesouraria." },
  },
  {
    what: { en: "ZEC → USDC", pt: "ZEC → USDC" },
    reality: "simulated",
    note: {
      en: "NEAR Intents in production, which has no testnet. The operator credits the vault at the quote.",
      pt: "Em produção, NEAR Intents, que não tem testnet. O operador credita o cofre pela cotação.",
    },
  },
  {
    what: { en: "Releases to the off-ramp, payouts to investors", pt: "Liberações para o off-ramp, pagamentos aos investidores" },
    reality: "real",
    note: {
      en: "The program's vault_transfer, signed by the operator. On devnet the operator plays the regulated off-ramp.",
      pt: "O vault_transfer do programa, assinado pelo operador. Na devnet, o operador faz o papel do off-ramp regulado.",
    },
  },
  {
    what: { en: "USDC → reais at the off-ramp", pt: "USDC → reais no off-ramp" },
    reality: "simulated",
    note: {
      en: "Releases convert at the demo quote less the ramp's spread: a loan is larger than a MoneyGram sandbox transfer.",
      pt: "As liberações são convertidas pela cotação de demonstração, menos o spread da rampa: um empréstimo é maior que uma transferência do sandbox da MoneyGram.",
    },
  },
  {
    what: { en: "The ramp's quote in the simulator", pt: "A cotação da rampa no simulador" },
    reality: "sandbox",
    note: {
      en: "MoneyGram Ramps' sandbox prices a USDC cash-out in Brazil, $2 to $200: its fee, its rate, what she would receive. Only the amount goes to MoneyGram.",
      pt: "O sandbox da MoneyGram Ramps cota um saque de USDC em dinheiro no Brasil, de US$ 2 a US$ 200: a taxa, o câmbio e quanto ela receberia. Só o valor vai para a MoneyGram.",
    },
  },
  {
    what: { en: "Pix to her business, and her instalments", pt: "Pix para o negócio dela, e as parcelas dela" },
    reality: "mock",
    note: { en: "End-to-end ids in Pix's format. No Pix is sent.", pt: "IDs end-to-end no formato do Pix, fictícios. Nenhum Pix é enviado." },
  },
  {
    what: { en: "Proofs of every record", pt: "Provas de cada registro" },
    reality: "real",
    note: {
      en: "Commitments on Solana devnet, recomputed in your browser by Verify.",
      pt: "Compromissos criptográficos na Solana devnet, recalculados no seu navegador pelo Verificar.",
    },
  },
  {
    what: { en: "Participants, loans and most positions", pt: "Participantes, empréstimos e a maioria das posições" },
    reality: "simulated",
    note: { en: "Seeded demo data, marked as such.", pt: "Dados de demonstração pré-carregados, marcados como tal." },
  },
  {
    what: { en: "Yields and returns", pt: "Rendimentos e retornos" },
    reality: "indicative",
    note: { en: "At the reference rate and the demo quote. Not a promise.", pt: "Pela taxa de referência e pela cotação de demonstração. Não é uma promessa." },
  },
]);

/** A Pix end-to-end id's shape: 'E', an 8-digit institution code (99999999, no real one), the minute in UTC, 11 characters. */
export function mockPixE2e(at = new Date()): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(11));
  const pad = (n: number) => String(n).padStart(2, "0");
  const minute = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}`;
  return `E99999999${minute}${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/** Reais, in centavos, that a USDC amount becomes at a quote (milli-reais per USDC) less spreads in basis points. */
export function reaisAtRamp(microUsdc: number, fxMilli: number, spreadBps: number): number {
  return Math.floor(((microUsdc / 1e6) * (fxMilli / 1000) * 100 * (10_000 - spreadBps)) / 10_000);
}

export interface SettlementOverview {
  fx_brl_per_usdc_milli: number;
  ramp_bps: number;
  vault: { in_vault_micro_usdc: number; deposits_micro_usdc: number; released_micro_usdc: number; repaid_in_micro_usdc: number; paid_out_micro_usdc: number };
  pix: { payouts: number; payout_cents: number; ins: number; in_cents: number };
  legs: Record<string, number> | null;
  transfers: { id: number; kind: "release" | "payout"; status: "pending" | "confirmed" | "failed"; signature: string | null;
    inflow_micro_usdc: number; outflow_micro_usdc: number; legs: number; at: string }[];
  mine: { paid_out_micro_usdc: number; due_micro_usdc: number; held_micro_usdc: number; payouts: number };
}

export type PayoutStatus = "due" | "held" | "sending" | "done" | "failed";
