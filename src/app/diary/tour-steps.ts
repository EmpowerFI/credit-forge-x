import { createContext, useContext } from "react";

/** Starts the tutorial from anywhere in the diary (Layout provides it). */
export const TourContext = createContext<{ start: () => void }>({ start: () => undefined });

export const useTour = () => useContext(TourContext);

/** One slide of the tutorial: a picture of the real screen, a title, one sentence. */
export interface TourStep {
  image: { en: string; pt: string };
  /** What the picture shows, for a screen reader. */
  alt: { en: string; pt: string };
  title: { en: string; pt: string };
  body: { en: string; pt: string };
}

// The pictures are screenshots of the diary itself, retaken whenever its
// screens change (scripts/diary/tour-shots.mjs).
const pic = (name: string) => ({ en: `/app/diario-tour/${name}-en.jpg`, pt: `/app/diario-tour/${name}-pt.jpg` });

/** The diary, slide by slide, in the order she uses it. */
export const TOUR: TourStep[] = [
  {
    image: pic("1-today"),
    alt: { en: "The Today screen", pt: "A tela Hoje" },
    title: { en: "Note your day", pt: "Anote o seu dia" },
    body: {
      en: "Tap I sold or spent. No activity? One tap records the day.",
      pt: "Toque em Vendi ou gastei. Sem movimento? Um toque registra o dia.",
    },
  },
  {
    image: pic("2-entry"),
    alt: { en: "The form for a sale or an expense", pt: "O formulário de venda ou gasto" },
    title: { en: "One item at a time", pt: "Um item por vez" },
    body: {
      en: "The amount and how it was paid. Paid later or in instalments? Tick it on the item.",
      pt: "Valor e forma de pagamento. Recebe depois ou parcelou? Marque no item.",
    },
  },
  {
    image: pic("3-review"),
    alt: { en: "The list of the day, before saving", pt: "A lista do dia, antes de registrar" },
    title: { en: "Review and save", pt: "Revise e registre" },
    body: {
      en: "Check the list, then tap Confirm and save.",
      pt: "Confira a lista e toque em Confirmar e registrar.",
    },
  },
  {
    image: pic("4-month"),
    alt: { en: "The Your month card", pt: "O card Seu mês" },
    title: { en: "Your month", pt: "Seu mês" },
    body: {
      en: "Sales in blue, expenses in orange. Profit is what is left after the expenses and your salary.",
      pt: "Vendas em azul, gastos em laranja. Lucro é o que sobra depois dos gastos e do seu salário.",
    },
  },
  {
    image: pic("5-reading"),
    alt: { en: "A weekly reading", pt: "Uma leitura da semana" },
    title: { en: "Your week, read", pt: "A leitura da semana" },
    body: {
      en: "Record 3 days in a week and, from Sunday, a reading of your business is waiting when you open the diary.",
      pt: "Registre 3 dias na semana e, a partir de domingo, a leitura do seu negócio aparece quando você abrir o diário.",
    },
  },
  {
    image: pic("6-reminders"),
    alt: { en: "The Reminders screen", pt: "A tela Lembretes" },
    title: { en: "Reminders", pt: "Lembretes" },
    body: {
      en: "Mark the days you open and the time of the reminder. The tutorial is here too.",
      pt: "Marque os dias em que abre e o horário do aviso. O tutorial também fica aqui.",
    },
  },
];
