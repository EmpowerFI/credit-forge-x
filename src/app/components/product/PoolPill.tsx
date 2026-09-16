import { POOL, type PoolId } from "../../lib/capital";
import { tr } from "../../i18n";
import StatusPill from "./StatusPill";

/** An opportunity's funding route, in one pill; or that it waits for a pool. */
export default function PoolPill({ pool, dot = false }: { pool: PoolId | null; dot?: boolean }) {
  if (!pool) return <StatusPill tone="caution" dot={dot}>{tr({ en: "Waiting for capital", pt: "Aguardando capital" })}</StatusPill>;
  return <StatusPill tone={POOL[pool].tone} dot={dot}>{POOL[pool].route}</StatusPill>;
}
