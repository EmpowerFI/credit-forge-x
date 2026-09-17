import { createClient } from "@supabase/supabase-js";
import type { Database } from "./platform.types";
import { localized } from "../i18n";

// The hackathon platform's own Supabase project (platform/), separate from the
// website's (src/integrations/supabase). Two projects, two clients, two
// sessions: nothing the website does can touch platform data, or the reverse.
const url = import.meta.env.VITE_PLATFORM_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_PLATFORM_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const platformConfigured = Boolean(url && key);

export const platform = createClient<Database>(url ?? "http://platform.invalid", key ?? "missing", {
  auth: {
    storageKey: "empowerfi-platform-auth",
    persistSession: true,
    autoRefreshToken: true,
  },
});

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

export type Role = Enums["app_role"];
export type Profile = Tables["profiles"]["Row"];
export type Community = Tables["communities"]["Row"];
export type CommunityKind = Enums["community_kind"];
export type CommunityStatus = Enums["community_status"];
export type ChainAnchor = Tables["chain_anchors"]["Row"];
export type AnchorKind = Enums["anchor_kind"];

export const ROLE_LABEL: Record<Role, string> = localized({
  entrepreneur: { en: "Entrepreneur", pt: "Empreendedora" },
  community_leader: { en: "Community leader", pt: "Líder da comunidade" },
  partner: { en: "EmpowerFI P2P desk", pt: "Mesa P2P da EmpowerFI" },
  capital_provider: { en: "Capital provider", pt: "Provedor de capital" },
  auditor: { en: "Auditor", pt: "Auditor" },
  admin: { en: "EmpowerFI admin", pt: "Admin da EmpowerFI" },
  sponsor: { en: "Programme sponsor", pt: "Patrocinador de programa" },
});

export const KIND_LABEL: Record<CommunityKind, string> = localized({
  education_programme: { en: "Education programme", pt: "Programa de formação" },
  association: { en: "Association", pt: "Associação" },
  cooperative: { en: "Cooperative", pt: "Cooperativa" },
  collective: { en: "Collective", pt: "Coletivo" },
  other: { en: "Other", pt: "Outro" },
});

export const BR_STATES = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

export const explorerTx = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
export const explorerAddress = (address: string) =>
  `https://explorer.solana.com/address/${address}?cluster=devnet`;
