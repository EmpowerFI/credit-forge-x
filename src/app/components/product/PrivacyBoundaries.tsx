import type { ReactNode } from "react";
import { DataTag } from "./DataLegend";
import Panel from "./Panel";

const CAN_SEE = [
  "Productive purpose, sector and amount",
  "The verified community",
  "Readiness score and band",
  "Risk band, confidence and affordability",
  "Eligibility and allocation reason codes",
  "Proofs of each assessment on Solana",
];

const STAYS_PRIVATE = [
  "Her name, CPF and contacts (PII / KYC)",
  "Her business name and address",
  "Reported revenue, expenses and household spending",
  "Pix and bank details",
  "Raw check-ins and her own words about the need",
  "Her consent records",
];

/** What an investor can see of an opportunity, and what stays private: the boundary, stated on the screen. */
export default function PrivacyBoundaries({ children }: { children?: ReactNode }) {
  return (
    <Panel title="Privacy boundaries"
      description="Investors get the decision snapshot and cryptographic evidence — never identity, bank data or the financial history behind it.">
      <div className="grid gap-4 sm:grid-cols-2">
        <ul className="space-y-2 text-sm">
          <li className="font-medium text-foreground">What you can see</li>
          {CAN_SEE.map((t) => <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="derived" /> {t}</li>)}
        </ul>
        <ul className="space-y-2 text-sm">
          <li className="font-medium text-foreground">What stays private</li>
          {STAYS_PRIVATE.map((t) => <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="private" /> {t}</li>)}
        </ul>
      </div>
      {children}
    </Panel>
  );
}
