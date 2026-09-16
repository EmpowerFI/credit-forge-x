import { POOL, type PoolId } from "../../lib/capital";
import StatusPill from "./StatusPill";

/** An opportunity's funding route, in one pill; or that it waits for a pool. */
export default function PoolPill({ pool, dot = false }: { pool: PoolId | null; dot?: boolean }) {
  if (!pool) return <StatusPill tone="caution" dot={dot}>Waiting for capital</StatusPill>;
  return <StatusPill tone={POOL[pool].tone} dot={dot}>{POOL[pool].route}</StatusPill>;
}
