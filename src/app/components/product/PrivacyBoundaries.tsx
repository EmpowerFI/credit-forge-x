import type { ReactNode } from "react";
import { tr } from "../../i18n";
import Panel from "./Panel";

/** What an investor can see of an opportunity, and what stays private: the boundary, stated on the screen. */
export default function PrivacyBoundaries({ children, folded, numeral }: {
  children?: ReactNode; folded?: boolean; numeral?: string;
}) {
  return (
    <Panel folded={folded} numeral={numeral} title={tr({ en: "Privacy boundaries", pt: "Limites de privacidade" })}
      description={tr({
        en: "Investors get the decision snapshot and cryptographic evidence — never identity, bank data or the financial history behind it.",
        pt: "Investidores recebem o retrato da decisão e evidências criptográficas — nunca a identidade, os dados bancários ou o histórico financeiro por trás dela.",
      })}>
      {children}
    </Panel>
  );
}
