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
        en: "Investors get the decision and its proof — never her identity, bank data or financial history.",
        pt: "Investidores recebem a decisão e a prova dela — nunca a identidade, os dados bancários ou o histórico financeiro.",
      })}>
      {children}
    </Panel>
  );
}
