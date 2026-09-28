import { localized } from "../i18n";
import type { Tone } from "../components/product/StatusPill";
import type { EvidenceLabel } from "./evidence";
import { platform } from "./platform";

// The Local Productive Capital Rail, as the screens read it (addendum v3 §7.2,
// §8, §12). Every figure below comes out of public.local_economy_dashboard(),
// which derives all of them from local_transactions; nothing here computes a
// metric of its own, because two places computing a multiplier is two
// multipliers.

export type LocalTxType =
  | "capital_injection"
  | "productive_purchase"
  | "merchant_payment"
  | "transfer"
  | "repayment"
  | "redemption";

export interface LocalEconomyListed {
  id: string;
  code: string;
  name: string;
  territory: string;
  uf: string;
  community_id: string | null;
  currency_code: string;
  parity_bps: number;
  parity_reference: string;
  is_simulated: boolean;
  movements: number;
}

export interface LocalMovement {
  id: string;
  transaction_no: number;
  tx_type: LocalTxType;
  amount_units: number;
  occurred_at: string;
  from_owner_type: "treasury" | "entrepreneur" | "merchant";
  to_owner_type: "treasury" | "entrepreneur" | "merchant";
  /** A merchant's name, where that side is a merchant. The other sides are not named. */
  from_name: string | null;
  to_name: string | null;
  note: string | null;
}

export interface LocalEconomyDashboard {
  economy: Omit<LocalEconomyListed, "movements">;
  model_version: string;
  evidence_status: EvidenceLabel;

  injected_units: number;
  injected_brl_cents: number;
  /** Movements between participants inside the territory. Not redemption, not repayment. */
  circulated_units: number;
  circulated_brl_cents: number;
  repaid_units: number;
  redeemed_units: number;
  redeemed_brl_cents: number;
  /** Injected, less what left through a redemption and what returned to the treasury. */
  circulating_units: number;

  movements: number;
  first_movement_at: string | null;
  last_movement_at: string | null;

  /** Local Capital Multiplier: circulation per unit injected. */
  multiplier_bps: number;
  /** What has not been taken off the rail for reais. */
  retention_bps: number;
  /** Turns of the units still in circulation. */
  velocity_bps: number;
  /** The share of the injected capital whose loan was funded from abroad. */
  additionality_bps: number;
  global_injected_units: number;
  loans_landed: number;

  merchants_total: number;
  merchants_eligible: number;
  merchants_paid: number;
  merchants_spent_onward: number;
  businesses_funded: number;
  redemptions: number;

  accounts: number;
  units_held: number;
  /** Every balance in the economy sums to zero. */
  conserved: boolean;
  /** What the accounts hold equals what the movements say is circulating. */
  supply_matches_balances: boolean;

  by_type: { tx_type: LocalTxType; movements: number; units: number }[];
  recent: LocalMovement[];
}

/** What each of the six movements is, in the words the rail uses for it. */
export const LOCAL_TX: Record<LocalTxType, { label: string; what: string; tone: Tone }> = localized({
  capital_injection: {
    label: { en: "Capital arrives", pt: "Capital chega" },
    what: {
      en: "A disbursed loan, as local units at the territory's parity, issued by the treasury.",
      pt: "Um empréstimo desembolsado, em unidades locais à paridade do território, emitido pela tesouraria.",
    },
    tone: "info",
  },
  productive_purchase: {
    label: { en: "She buys her inputs", pt: "Ela compra os insumos" },
    what: {
      en: "The business spends productive capital with a merchant inside the network.",
      pt: "O negócio gasta capital produtivo com um comerciante dentro da rede.",
    },
    tone: "positive",
  },
  merchant_payment: {
    label: { en: "One merchant pays another", pt: "Um comerciante paga outro" },
    what: {
      en: "The second hop, and the reason a multiplier can be more than an accounting identity.",
      pt: "O segundo salto, e a razão pela qual um multiplicador pode ser mais que uma identidade contábil.",
    },
    tone: "positive",
  },
  transfer: {
    label: { en: "She sells into the network", pt: "Ela vende para a rede" },
    what: {
      en: "A merchant pays the business for goods or services, with units it actually holds.",
      pt: "Um comerciante paga o negócio por bens ou serviços, com unidades que de fato tem.",
    },
    tone: "positive",
  },
  repayment: {
    label: { en: "She repays on the rail", pt: "Ela paga a parcela no trilho" },
    what: {
      en: "An instalment in the units she holds. Where she does not hold them, the instalment is paid in reais and nothing is recorded here.",
      pt: "Uma parcela nas unidades que ela tem. Onde ela não as tem, a parcela é paga em reais e nada é registrado aqui.",
    },
    tone: "neutral",
  },
  redemption: {
    label: { en: "A merchant cashes out", pt: "Um comerciante saca" },
    what: {
      en: "Units leave the rail for reais. This is the only way out, and the only thing that reduces retention.",
      pt: "Unidades saem do trilho para reais. É a única saída, e a única coisa que reduz a retenção.",
    },
    tone: "caution",
  },
});

export const economiesKey = ["platform", "local-economies"] as const;
export const dashboardKey = (economyId: string | null) =>
  ["platform", "local-economy-dashboard", economyId ?? "first"] as const;

export async function fetchLocalEconomies(): Promise<LocalEconomyListed[]> {
  const { data, error } = await platform.rpc("local_economies_listed");
  if (error) throw error;
  return (data ?? []) as unknown as LocalEconomyListed[];
}

export async function fetchLocalEconomyDashboard(economyId: string | null): Promise<LocalEconomyDashboard | null> {
  const { data, error } = await platform.rpc(
    "local_economy_dashboard",
    economyId ? { p_economy_id: economyId } : {},
  );
  if (error) throw error;
  return (data ?? null) as unknown as LocalEconomyDashboard | null;
}

// ------------------------------------------------------------------ the words

/** Units, in the economy's own code. Integers throughout, like every other amount here. */
export const units = (n: number, code: string) =>
  `${code} ${(n / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A ratio held in basis points, as the multiple it is. */
export const times = (bps: number) => `${(bps / 10000).toFixed(2)}×`;

/** A share held in basis points. */
export const share = (bps: number) => `${(bps / 100).toFixed(1)}%`;
