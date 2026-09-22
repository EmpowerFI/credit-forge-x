import { address, type Address } from "@solana/kit";
import { findAssociatedTokenPda, TOKEN_2022_PROGRAM_ADDRESS } from "@solana-program/token-2022";
import { localized, tr } from "../i18n";
import { platform } from "./platform";

// A tokenised credit position: the investor's side of a funded loan, as a
// Token-2022 asset she holds in her own wallet.
//
// A Devnet prototype of a future regulated structure. It is not a security,
// it confers no legal right on its own, and transferability is not liquidity:
// the asset can move between wallets the platform has admitted, and there is
// no buyer, no price and no market.
//
// Every figure here is her share. The loan's own numbers travel alongside,
// under `loan`, and the screens must say which is which — a position holding
// twelve per cent of a loan is not worth the loan.

export type PositionState = "pending" | "active" | "paid" | "delinquent" | "closed";
export type PositionLiquidity = "hold" | "transferable";
export type PositionEventKind = "created" | "minted" | "payment" | "transferred" | "closed";

export interface TokenizedPosition {
  id: string;
  asset: string;
  state: PositionState;
  owner_wallet: string | null;
  share_bps: number;
  principal_micro_usdc: number;
  principal_cents: number | null;
  outstanding_cents: number | null;
  loan: {
    principal_cents: number;
    outstanding_cents: number;
    term_months: number;
    instalment_cents: number;
    payments_made: number;
    status: string;
    disbursed_at: string | null;
  } | null;
  risk_band: string | null;
  opportunity_no: number | null;
  mint_address: string | null;
  token_account: string | null;
  mint_signature: string | null;
  minted_at: string | null;
  liquidity: PositionLiquidity;
  is_simulated: boolean;
  created_at: string;
  closed_at: string | null;
}

export interface PositionDetail extends TokenizedPosition {
  evidence: {
    latest_checkin_at: string | null;
    checkins: number;
    readiness_band: string | null;
    readiness_model: string | null;
    data_quality: number | null;
    outcomes_measured: number;
  };
  mandate: { program: string; sponsor: string } | null;
  proof: { kind: string; status: string; signature: string | null; account: string | null; confirmed_at: string | null }[];
  events: {
    kind: PositionEventKind;
    from_wallet: string | null;
    to_wallet: string | null;
    signature: string | null;
    detail: Record<string, unknown>;
    occurred_at: string;
  }[];
}

export interface EligibleWallet {
  wallet: string;
  label: string;
  note: string | null;
}

export const positionsKey = ["platform", "tokenized-positions"] as const;
export const positionKey = (id: string) => ["platform", "tokenized-position", id] as const;
export const eligibleWalletsKey = ["platform", "eligible-wallets"] as const;

export async function fetchTokenizedPositions(): Promise<TokenizedPosition[]> {
  const { data, error } = await platform.rpc("tokenized_positions");
  if (error) throw error;
  return (data ?? []) as unknown as TokenizedPosition[];
}

export async function fetchTokenizedPosition(id: string): Promise<PositionDetail> {
  const { data, error } = await platform.rpc("tokenized_position", { p_position_id: id });
  if (error) throw error;
  return data as unknown as PositionDetail;
}

/** Where a position may be sent: the wallets the platform has admitted. */
export async function fetchEligibleWallets(): Promise<EligibleWallet[]> {
  const { data, error } = await platform.from("eligible_wallets").select("wallet, label, note").eq("active", true).order("label");
  if (error) throw error;
  return (data ?? []) as EligibleWallet[];
}

interface Prepared {
  asset: string;
  mint: string;
  source: string;
  destination: string;
  decimals: number;
  admitted: "now" | "already";
  admission_signature: string | null;
}

async function callTransfer<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await platform.functions.invoke("position-transfer", { body });
  if (error) {
    // The function answers with a reason; surface it rather than "non-2xx".
    const detail = await (error as { context?: Response }).context?.json?.().catch(() => null);
    throw new Error((detail as { error?: string } | null)?.error ?? error.message);
  }
  return data as T;
}

/**
 * Admits the destination before she signs anything: its token account is
 * created and thawed by the platform, which is the only party that can. Until
 * that has happened her transfer would be refused by the token program.
 */
export const prepareTransfer = (positionId: string, toWallet: string) =>
  callTransfer<Prepared>({ action: "prepare", position_id: positionId, to_wallet: toWallet });

/** What the chain says, written down here once it says it. */
export const recordTransfer = (positionId: string, toWallet: string, signature: string) =>
  callTransfer<{ asset: string; owner: string; signature: string }>({
    action: "record", position_id: positionId, to_wallet: toWallet, signature,
  });

/** The token account an owner holds a given position's asset in. */
export async function positionAccountOf(owner: string, mint: string): Promise<Address> {
  const [ata] = await findAssociatedTokenPda({
    owner: address(owner), mint: address(mint), tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  return ata;
}

export const POSITION_STATE: Record<PositionState, string> = localized({
  pending: { en: "Awaiting disbursement", pt: "Aguardando desembolso" },
  active: { en: "Active", pt: "Ativa" },
  paid: { en: "Paid off", pt: "Quitada" },
  delinquent: { en: "Delinquent", pt: "Inadimplente" },
  closed: { en: "Closed", pt: "Encerrada" },
});

/** The state's tone is not a translation; it is the same in every language. */
export const POSITION_TONE: Record<PositionState, "positive" | "alert" | "neutral" | "info"> = {
  pending: "info", active: "positive", paid: "positive", delinquent: "alert", closed: "neutral",
};

/** Never "liquid". Transferable says where it may go, not that anyone wants it. */
export const POSITION_LIQUIDITY: Record<PositionLiquidity, { label: string; says: string }> = localized({
  hold: {
    label: { en: "Hold", pt: "Retida" },
    says: {
      en: "Not transferable yet: the asset has to exist on Devnet and its owner has to be an admitted wallet.",
      pt: "Ainda não transferível: o ativo precisa existir na Devnet e o dono precisa ser uma carteira admitida.",
    },
  },
  transferable: {
    label: { en: "Transferable", pt: "Transferível" },
    says: {
      en: "May be sent to another admitted wallet. That is not liquidity: there is no buyer, no price and no market.",
      pt: "Pode ser enviada a outra carteira admitida. Isso não é liquidez: não há comprador, nem preço, nem mercado.",
    },
  },
});

export const POSITION_EVENT: Record<PositionEventKind, string> = localized({
  created: { en: "Position opened", pt: "Posição aberta" },
  minted: { en: "Asset created on Devnet", pt: "Ativo criado na Devnet" },
  payment: { en: "Instalment received", pt: "Parcela recebida" },
  transferred: { en: "Ownership transferred", pt: "Propriedade transferida" },
  closed: { en: "Position closed", pt: "Posição encerrada" },
});

/**
 * The sentence that must sit wherever this asset is shown. A function, not a
 * constant: a constant would freeze whichever language was current when this
 * module loaded.
 */
export const positionDisclaimer = () => tr({
  en: "A Devnet prototype of a future regulated tokenised-credit structure. The asset confers no legal right on its own, the production legal instrument and any secondary market require validation with Brazilian counsel and the applicable BCB/CVM rules, and transferability is not liquidity.",
  pt: "Protótipo em Devnet de uma futura estrutura regulada de crédito tokenizado. O ativo não confere direito legal por si, o instrumento jurídico de produção e qualquer mercado secundário exigem validação com assessoria jurídica brasileira e as regras aplicáveis do BCB e da CVM, e transferibilidade não é liquidez.",
});

/**
 * §3.2 of the plan, and §8 of the addendum: the four secondary-market metrics
 * are named as roadmap in one line rather than shown as four empty tiles.
 * Four tiles reading "—" have the shape of a marketplace dashboard, and a
 * viewer fills the blanks. A sentence cannot be misread that way.
 */
export const positionRoadmap = () => tr({
  en: "Secondary volume, time to exit, discount or premium, and liquidity available are roadmap metrics. None of them is measured here, so none of them is shown.",
  pt: "Volume secundário, tempo até a saída, deságio ou ágio e liquidez disponível são métricas de roadmap. Nenhuma é medida aqui, então nenhuma é exibida.",
});

/** What this is not. Said plainly, in the place where it could be assumed. */
export const positionNotBuilt = () => tr({
  en: "There is no exchange, order book, auction or pool here, no bid, no depth and no price discovery. EmpowerFI is not a securities marketplace, an exchange, a securitiser or an authorised secondary market, and holding this asset is not legal ownership of a receivable.",
  pt: "Aqui não há bolsa, livro de ofertas, leilão nem pool, não há lance, profundidade ou formação de preço. A EmpowerFI não é mercado de valores mobiliários, bolsa, securitizadora nem mercado secundário autorizado, e deter este ativo não é titularidade legal de um recebível.",
});
