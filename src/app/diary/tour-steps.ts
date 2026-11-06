import { createContext, useContext } from "react";

/** Starts the guided tour from anywhere in the diary (Layout provides it). */
export const TourContext = createContext<{ start: () => void }>({ start: () => undefined });

export const useTour = () => useContext(TourContext);

/** One stop of the tour: a page, the element on it, and what to say about it. */
export interface TourStep {
  route: string;
  /** The element's data-tour name. A step whose element is not on the screen is skipped. */
  target: string;
  title: { en: string; pt: string };
  body: { en: string; pt: string };
  /** She may tap the highlighted element during this step (a toggle, a switch). */
  interactive?: boolean;
}

const HOJE = "/app/diario";
const LEMBRETES = "/app/diario/lembretes";

/** The diary's features, in the order she meets them, named as the screens name them. */
export const TOUR: TourStep[] = [
  {
    route: HOJE, target: "add",
    title: { en: "Note a sale or an expense", pt: "Anote uma venda ou um gasto" },
    body: {
      en: "Tap here and note one item at a time: the amount and how it was paid. Received later or in instalments? Tick it on the item. When you are done, tap Review and save the day.",
      pt: "Toque aqui e anote um item por vez: o valor e como foi pago. Recebe depois ou parcelou? Marque no próprio item. No fim, toque em Revisar e registrar o dia.",
    },
  },
  {
    route: HOJE, target: "month", interactive: true,
    title: { en: "Your month: when there is profit", pt: "Seu mês: quando tem lucro" },
    body: {
      en: "Say how much you need to get through the month: it is your salary, and a cost of the business. Profit is what the sales leave after the expenses and your salary. The bar shows how much of those costs the sales already cover; a loss shows in red, with a minus sign.",
      pt: "Diga quanto você precisa para passar o mês: é o seu salário, e é um custo do negócio. Lucro é o que sobra das vendas depois dos gastos e do seu salário. A barra mostra quanto desses custos as vendas já cobrem; prejuízo aparece em vermelho, com sinal de menos.",
    },
  },
  {
    route: HOJE, target: "quiet",
    title: { en: "A day with no activity", pt: "Dia sem movimento" },
    body: {
      en: "Opened and sold nothing, or did not open? One tap records the day.",
      pt: "Abriu e não vendeu, ou não abriu? Um toque registra o dia.",
    },
  },
  {
    route: HOJE, target: "day",
    title: { en: "Today or yesterday", pt: "Hoje ou ontem" },
    body: {
      en: "Forgot to note yesterday? Switch here and record it.",
      pt: "Esqueceu de anotar ontem? Troque aqui e registre.",
    },
  },
  {
    route: HOJE, target: "summary",
    title: { en: "Your day so far", pt: "O resumo do dia" },
    body: {
      en: "Your sales, expenses, your salary for the day and the day's profit add up here. Remembered something? Today and yesterday still take more, and each line can be corrected or removed.",
      pt: "Aqui somam as vendas, os gastos, o seu salário do dia e o lucro do dia. Lembrou de algo? Hoje e ontem ainda aceitam mais, e cada lançamento pode ser corrigido ou removido.",
    },
  },
  {
    route: HOJE, target: "week",
    title: { en: "Your week", pt: "A sua semana" },
    body: {
      en: "Each day you record gets your icon. Tap Change icon to pick yours.",
      pt: "Cada dia registrado ganha o seu ícone. Toque em Trocar ícone para escolher o seu.",
    },
  },
  {
    route: HOJE, target: "tab-history",
    title: { en: "History", pt: "Histórico" },
    body: {
      en: "Your days, your weekly readings and your rewards. After a week with 3 days recorded, a short reading of your business arrives, written by AI from your figures, never with your name.",
      pt: "Os seus dias, as leituras da semana e os prêmios. Depois de uma semana com 3 dias registrados, chega uma leitura curta do seu negócio, escrita por IA a partir dos seus números, nunca com o seu nome.",
    },
  },
  {
    route: LEMBRETES, target: "open-days", interactive: true,
    title: { en: "The days your business opens", pt: "Os dias em que seu negócio abre" },
    body: {
      en: "Tap to mark them, now if you like. A closed day is never a missed one, and no reminder comes on it.",
      pt: "Toque para marcar, se quiser já agora. Dia fechado não é falta, e não chega lembrete nele.",
    },
  },
  {
    route: LEMBRETES, target: "reminder", interactive: true,
    title: { en: "The daily reminder", pt: "O lembrete diário" },
    body: {
      en: "Turn it on and choose the time: one nudge a day, only on days you have not recorded yet.",
      pt: "Ligue e escolha o horário: um aviso por dia, só nos dias em que você ainda não registrou.",
    },
  },
  {
    route: LEMBRETES, target: "your-data",
    title: { en: "Your data, your choices", pt: "Seus dados, suas escolhas" },
    body: {
      en: "Here you choose whether your business counts in the impact figures, and whether the weekly reading is written by AI.",
      pt: "Aqui você escolhe se o seu negócio entra nos números de impacto e se a leitura da semana é escrita por IA.",
    },
  },
  {
    route: LEMBRETES, target: "tour-link",
    title: { en: "That's it!", pt: "Pronto!" },
    body: {
      en: "To see this tour again, tap here whenever you like.",
      pt: "Para ver este tutorial de novo, toque aqui quando quiser.",
    },
  },
];
