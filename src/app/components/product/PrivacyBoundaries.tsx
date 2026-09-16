import type { ReactNode } from "react";
import { localized, tr } from "../../i18n";
import { DataTag } from "./DataLegend";
import Panel from "./Panel";

const CAN_SEE: string[] = localized([
  { en: "Productive purpose, sector and amount", pt: "Finalidade produtiva, setor e valor" },
  { en: "The verified community", pt: "A comunidade verificada" },
  { en: "Readiness score and band", pt: "Pontuação e faixa de prontidão" },
  { en: "Risk band, confidence and affordability", pt: "Faixa de risco, confiança e capacidade de pagamento" },
  { en: "Eligibility and allocation reason codes", pt: "Elegibilidade e motivos da alocação" },
  { en: "Proofs of each assessment on Solana", pt: "Provas de cada avaliação na Solana" },
]);

const STAYS_PRIVATE: string[] = localized([
  { en: "Her name, CPF and contacts (PII / KYC)", pt: "O nome, o CPF e os contatos dela (PII / KYC)" },
  { en: "Her business name and address", pt: "O nome e o endereço do negócio dela" },
  { en: "Reported revenue, expenses and household spending", pt: "Receita, despesas e gastos da casa informados por ela" },
  { en: "Pix and bank details", pt: "Dados do Pix e bancários" },
  { en: "Raw check-ins and her own words about the need", pt: "Os check-ins completos e o que ela mesma disse sobre a necessidade" },
  { en: "Her consent records", pt: "Os registros de consentimento dela" },
]);

/** What an investor can see of an opportunity, and what stays private: the boundary, stated on the screen. */
export default function PrivacyBoundaries({ children }: { children?: ReactNode }) {
  return (
    <Panel title={tr({ en: "Privacy boundaries", pt: "Limites de privacidade" })}
      description={tr({
        en: "Investors get the decision snapshot and cryptographic evidence — never identity, bank data or the financial history behind it.",
        pt: "Investidores recebem o retrato da decisão e evidências criptográficas — nunca a identidade, os dados bancários ou o histórico financeiro por trás dela.",
      })}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ul className="space-y-2 text-sm">
          <li className="font-medium text-foreground">{tr({ en: "What you can see", pt: "O que você pode ver" })}</li>
          {CAN_SEE.map((t) => <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="derived" /> {t}</li>)}
        </ul>
        <ul className="space-y-2 text-sm">
          <li className="font-medium text-foreground">{tr({ en: "What stays private", pt: "O que fica privado" })}</li>
          {STAYS_PRIVATE.map((t) => <li key={t} className="flex items-center gap-2 text-muted-foreground"><DataTag kind="private" /> {t}</li>)}
        </ul>
      </div>
      {children}
    </Panel>
  );
}
