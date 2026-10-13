// The entry conversation: one question at a time, and it never loses its place.
//
// A woman writes to the number and leaves with an account, a consent on
// record and a profile. She may answer over four days, from the bus, with the
// app closed in between -- so the conversation is a row, not a session, and
// every reply is decided from that row alone. Nothing here reads a clock, a
// database or a network: given the state and what she just typed, it returns
// the next state and what to say. That is what makes "resumes exactly at the
// last valid question" a property you can test rather than hope for.
//
// The rule that produces it: an answer that is not understood NEVER advances
// the step. She is asked again, told what shape the answer takes, and the row
// is unchanged -- so a reply three days later lands on the same question.
//
// Two commands work anywhere, because a woman who wants out must not have to
// find the right screen: "sair" stops everything, "ajuda" explains without
// moving. Neither is ever treated as an answer.

export type State = "NEW" | "CONSENT" | "PROFILE" | "ACTIVE" | "OPTED_OUT";

/** Where inside PROFILE she is. Null outside it. */
export type Step = "name" | "city" | "sector" | "since" | null;

export interface Conversation {
  state: State;
  step: Step;
  /** What she has answered so far. Only written when an answer is understood. */
  draft: Draft;
}

export interface Draft {
  name?: string;
  city?: string;
  state_uf?: string;
  sector?: string;
  /** Months in business. Null when she said she does not know. */
  months_operating?: number | null;
  /** True when she accepted; the scopes are recorded separately. */
  consented?: boolean;
}

export interface Turn {
  next: Conversation;
  /** What to send, in order. Empty means say nothing at all. */
  say: string[];
  /** Set on the turn where she becomes enrolled, so the caller can write the row. */
  completed?: boolean;
  /** Set on the turn where she consents, so the caller can record it. */
  consented?: boolean;
}

export const CONSENT_TEXT_VERSION = "whatsapp-2026-10";

// ------------------------------------------------------------------ wording
//
// Kept together so the copy can be read as copy. The legal wording is the
// founder's to confirm; what the code guarantees is that it is shown before
// anything is collected and that the version above is stored with her answer.

const SAY = {
  welcome: [
    "Oi! Aqui é a EmpowerFI 💜",
    "A gente acompanha o seu negócio por aqui: duas vezes por mês eu pergunto quanto entrou e quanto saiu, e te devolvo uma leitura do seu mês.",
    "Antes de começar, três coisas que você precisa saber:",
    "1. São duas mensagens por mês. Você pode parar quando quiser, é só escrever SAIR.",
    "2. Os seus números são seus. Ninguém vê o valor que você reporta sem você autorizar — nem quem patrocina a sua vaga.",
    "3. A conversa acontece no WhatsApp, então o WhatsApp sabe que você fala com a gente e quando. Ele não vê os seus números.",
    "Posso começar? Responda SIM para aceitar.",
  ].join("\n\n"),
  consentRefused: "Tudo bem. Não vou te mandar mais nada. Se mudar de ideia, é só escrever aqui de novo. 💜",
  consentUnclear: "Só para eu ter certeza: responda SIM para aceitar, ou SAIR para não receber mais nada.",
  askName: "Como você prefere que eu te chame?",
  askNameAgain: "Me diz só o nome, como você prefere ser chamada.",
  askCity: "Em que cidade você trabalha? Escreva cidade e estado, assim: Campinas/SP",
  askCityAgain: "Preciso da cidade e do estado, assim: Campinas/SP",
  askSector: "O que você vende ou faz? Pode escrever do seu jeito.",
  askSectorAgain: "Me conta em poucas palavras o que você vende ou faz.",
  askSince: "Há quanto tempo você trabalha com isso? Pode responder 3 anos, 8 meses, ou NÃO SEI.",
  askSinceAgain: "Pode ser 3 anos, 8 meses, ou NÃO SEI.",
  done: "Pronto! 🎉 Já está tudo certo.\n\nDaqui a pouco eu te mando a primeira pergunta sobre a sua quinzena. Leva menos de dois minutos.",
  help: "Eu sou o acompanhamento da EmpowerFI.\n\nEscreva AJUDA para ver isto de novo, ou SAIR para parar de receber mensagens.\n\nSe estiver no meio de uma pergunta, é só responder que a gente continua de onde parou.",
  left: "Pronto, parei por aqui. Você não vai receber mais mensagens. Para voltar, é só escrever. 💜",
  alreadyActive: "Você já está cadastrada 💜 Escreva AJUDA se precisar de alguma coisa.",
} as const;

// ------------------------------------------------------------------ parsing

const strip = (s: string) =>
  s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const isYes = (s: string) => ["sim", "s", "aceito", "quero", "ok", "pode", "claro", "bora"].includes(strip(s));
const isLeave = (s: string) => ["sair", "parar", "cancelar", "nao quero mais", "stop"].includes(strip(s));
const isHelp = (s: string) => ["ajuda", "help", "?", "socorro"].includes(strip(s));
const isDontKnow = (s: string) => ["nao sei", "nao sei nao", "sei nao", "nenhuma ideia", "nao lembro"].includes(strip(s));

const UF = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR",
  "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

/** "Campinas/SP", "Campinas - SP", "campinas sp". Null when it is not a place and a state. */
export function parseCity(raw: string): { city: string; uf: string } | null {
  const m = raw.trim().match(/^(.{2,60}?)\s*(?:[,/-]|\s)\s*([A-Za-z]{2})\.?$/);
  if (!m) return null;
  const uf = m[2].toUpperCase();
  if (!UF.has(uf)) return null;
  const city = m[1].trim().replace(/\s+/g, " ");
  if (city.length < 2) return null;
  return { city, uf };
}

/**
 * How long she has been at it, in months.
 *
 * Undefined means the answer was not understood and the question is asked
 * again; null means she said she does not know, which is an answer and moves
 * her on. Those are different things and the caller must not merge them.
 */
export function parseTenure(raw: string): number | null | undefined {
  if (isDontKnow(raw)) return null;
  const s = strip(raw);
  const years = s.match(/(\d{1,2})\s*(anos?|a)\b/);
  const months = s.match(/(\d{1,3})\s*(meses|mes|m)\b/);
  if (years || months) {
    const n = (years ? Number(years[1]) * 12 : 0) + (months ? Number(months[1]) : 0);
    return n > 0 && n <= 720 ? n : undefined;
  }
  // A bare number is read as years, which is how people answer this out loud.
  const bare = s.match(/^(\d{1,2})$/);
  if (bare) {
    const n = Number(bare[1]);
    return n > 0 && n <= 60 ? n * 12 : undefined;
  }
  return undefined;
}

/** A name, not a command and not a sentence. */
export function parseName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return null;
  if (!/\p{L}/u.test(name)) return null;
  if (isYes(name) || isLeave(name) || isHelp(name)) return null;
  return name;
}

// ------------------------------------------------------------------ the machine

export const FRESH: Conversation = { state: "NEW", step: null, draft: {} };

/** The question she is on, which is also what a resumed conversation repeats. */
export function question(conv: Conversation): string | null {
  if (conv.state === "CONSENT") return SAY.welcome;
  if (conv.state !== "PROFILE") return null;
  return { name: SAY.askName, city: SAY.askCity, sector: SAY.askSector, since: SAY.askSince }[conv.step ?? "name"];
}

export function advance(conv: Conversation, incoming: string): Turn {
  const keep = (say: string[]): Turn => ({ next: conv, say });

  if (conv.state === "OPTED_OUT") {
    // She comes back by writing anything at all, and starts from the top:
    // the consent she withdrew is not quietly reinstated.
    return advance(FRESH, incoming);
  }
  if (isLeave(incoming)) {
    return { next: { state: "OPTED_OUT", step: null, draft: conv.draft }, say: [SAY.left] };
  }
  if (isHelp(incoming)) {
    const again = question(conv);
    return keep(again ? [SAY.help, again] : [SAY.help]);
  }

  switch (conv.state) {
    case "NEW":
      return { next: { ...conv, state: "CONSENT", step: null }, say: [SAY.welcome] };

    case "CONSENT": {
      if (!isYes(incoming)) return keep([SAY.consentUnclear]);
      return {
        next: { state: "PROFILE", step: "name", draft: { ...conv.draft, consented: true } },
        say: [SAY.askName],
        consented: true,
      };
    }

    case "PROFILE": {
      switch (conv.step) {
        case "name": {
          const name = parseName(incoming);
          if (name === null) return keep([SAY.askNameAgain]);
          return { next: { ...conv, step: "city", draft: { ...conv.draft, name } }, say: [SAY.askCity] };
        }
        case "city": {
          const place = parseCity(incoming);
          if (place === null) return keep([SAY.askCityAgain]);
          return {
            next: { ...conv, step: "sector", draft: { ...conv.draft, city: place.city, state_uf: place.uf } },
            say: [SAY.askSector],
          };
        }
        case "sector": {
          const sector = incoming.trim().replace(/\s+/g, " ");
          if (sector.length < 2 || sector.length > 60 || !/\p{L}/u.test(sector)) return keep([SAY.askSectorAgain]);
          return { next: { ...conv, step: "since", draft: { ...conv.draft, sector } }, say: [SAY.askSince] };
        }
        case "since": {
          const months = parseTenure(incoming);
          if (months === undefined) return keep([SAY.askSinceAgain]);
          return {
            next: { state: "ACTIVE", step: null, draft: { ...conv.draft, months_operating: months } },
            say: [SAY.done],
            completed: true,
          };
        }
        default:
          // A row with no step is a row nothing can be decided from; start the
          // profile over rather than guess which answer is missing.
          return { next: { ...conv, step: "name" }, say: [SAY.askName] };
      }
    }

    case "ACTIVE":
      return keep([SAY.alreadyActive]);
  }
}
