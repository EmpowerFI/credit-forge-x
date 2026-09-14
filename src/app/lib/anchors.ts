import type { ChainAnchor } from "./platform";

/** Keep polling while any proof is still on its way to the chain. */
export const anchorsSettled = (anchors: ChainAnchor[] | undefined) =>
  Boolean(anchors?.length) && anchors!.every((a) => a.status === "confirmed" || a.status === "failed");
