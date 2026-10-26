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
export type Step = "adult" | "name" | "city" | "sector" | "since" | "cnpj" | "finance" | null;

export type Formalization = "mei" | "cnpj" | "none";
export type FinanceControl = "notebook" | "spreadsheet" | "app" | "memory" | "none";

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
  /** She declared she is a woman of 18 or over: the programme's gate, as in the app. */
  adult_woman?: true;
  formalization?: Formalization;
  /** How she keeps track of the money today. */
  finance_control?: FinanceControl;
  /** True when she accepted; the scopes are recorded separately. */
  consented?: boolean;
}

/**
 * A question she answers with a tap. Up to three options go as buttons
 * (titles of 20 characters at most); more go as a list behind `list`, the
 * button that opens it (rows of 24 characters at most, ten rows at most).
 * Every option's id is also accepted typed, and so are plain words.
 */
export interface Choice {
  text: string;
  options: { id: string; title: string; description?: string }[];
  list?: string;
}

/** One message: plain text, or a question with options. */
export type Say = string | Choice;

export interface Turn {
  next: Conversation;
  /** What to send, in order. Empty means say nothing at all. */
  say: Say[];
  /** Set on the turn where she becomes enrolled, so the caller can write the row. */
  completed?: boolean;
  /** Set on the turn where she consents, so the caller can record it. */
  consented?: boolean;
  /** Set when the daily form should follow the text: she is enrolled and can use it. */
  offerJournal?: boolean;
}

export const CONSENT_TEXT_VERSION = "whatsapp-2026-11";

// ------------------------------------------------------------------ wording
//
// Kept together so the copy can be read as copy. The legal wording is the
// founder's to confirm; what the code guarantees is that it is shown before
// anything is collected and that the version above is stored with her answer.

const SAY = {
  welcome: [
    "Oi! Aqui é a EmpowerFI 💜",
    "A gente acompanha o seu negócio por aqui: todo dia você registra o que vendeu e o que gastou, e toda semana recebe uma leitura de como foi.",
    "Antes de começar, quatro coisas que você precisa saber:",
    "1. Eu mando um lembrete por dia. Você pode parar quando quiser, é só escrever SAIR.",
    "2. Os seus números são seus. Ninguém vê o que você registra sem você autorizar — nem quem patrocina a sua vaga.",
    "3. A conversa acontece no WhatsApp, e a Meta, dona do WhatsApp, entrega as mensagens entre você e a gente. Ela sabe que você fala com a gente e quando.",
    "4. Você pode registrar pelo formulário, escrevendo ou por áudio. O que você escreve ou fala é lido por serviços de inteligência artificial (OpenAI e Anthropic, nos Estados Unidos) só para montar o registro. O áudio não fica guardado, o texto é apagado em até 24 horas, e nada é registrado antes de você confirmar.",
    "Posso começar? Responda SIM para aceitar.",
  ].join("\n\n"),
  consentRefused: "Tudo bem. Não vou te mandar mais nada. Se mudar de ideia, é só escrever aqui de novo. 💜",
  consentUnclear: "Só para eu ter certeza: responda SIM para aceitar, ou SAIR para não receber mais nada.",
  adult: {
    text: "Este acompanhamento é para mulheres empreendedoras.\n\nVocê se declara mulher e tem 18 anos ou mais?",
    options: [{ id: "onb:adult:yes", title: "Sim" }, { id: "onb:adult:no", title: "Não" }],
  } satisfies Choice,
  adultAgain: {
    text: "Toque em uma das opções: você se declara mulher e tem 18 anos ou mais?",
    options: [{ id: "onb:adult:yes", title: "Sim" }, { id: "onb:adult:no", title: "Não" }],
  } satisfies Choice,
  notEligible:
    "Obrigada por responder. Este acompanhamento é feito para mulheres empreendedoras com 18 anos ou mais, então não vou seguir com o cadastro, e nada do que você respondeu foi guardado. Se tocou errado, é só escrever de novo. 💜",
  askName: "Como você prefere que eu te chame?",
  askNameAgain: "Me diz só o nome, como você prefere ser chamada.",
  askCity: "Em que cidade fica o seu negócio? Escreva a cidade e o estado, assim: Osasco/SP",
  askCityAgain: "Preciso da cidade e da sigla do estado, separadas por uma barra, assim: Osasco/SP",
  askSector:
    "O que você vende ou faz? Pode escrever do seu jeito, por exemplo: bolo por encomenda, salão de beleza, revenda de roupas, marmitas, costura.",
  askSectorAgain: "Me conta em poucas palavras o que você vende ou faz. Por exemplo: marmitas, ou unhas e sobrancelhas.",
  since: {
    text: "Há quanto tempo você trabalha com isso?",
    list: "Escolher",
    options: [
      { id: "onb:since:1", title: "Menos de 6 meses" },
      { id: "onb:since:6", title: "De 6 meses a 1 ano" },
      { id: "onb:since:12", title: "De 1 a 3 anos" },
      { id: "onb:since:36", title: "De 3 a 5 anos" },
      { id: "onb:since:60", title: "Mais de 5 anos" },
      { id: "onb:since:unknown", title: "Não sei" },
    ],
  } satisfies Choice,
  sinceAgain: "Toque em Escolher e marque uma opção. Se preferir escrever, pode ser assim: 3 anos, 8 meses, ou NÃO SEI.",
  cnpj: {
    text: "O seu negócio tem CNPJ?\n\nNão tem problema se não tiver: a maioria começa assim.",
    options: [
      { id: "onb:cnpj:mei", title: "Sim, sou MEI" },
      { id: "onb:cnpj:cnpj", title: "Sim, outro CNPJ" },
      { id: "onb:cnpj:none", title: "Não tenho" },
    ],
  } satisfies Choice,
  cnpjAgain: "Toque em uma das opções: Sim, sou MEI · Sim, outro CNPJ · Não tenho.",
  finance: {
    text: "E hoje, como você controla o dinheiro que entra e sai do negócio?",
    list: "Escolher",
    options: [
      { id: "onb:finance:notebook", title: "Anoto num caderno" },
      { id: "onb:finance:spreadsheet", title: "Uso uma planilha" },
      { id: "onb:finance:app", title: "Uso um aplicativo" },
      { id: "onb:finance:memory", title: "Controlo de cabeça" },
      { id: "onb:finance:none", title: "Ainda não controlo" },
    ],
  } satisfies Choice,
  financeAgain: "Toque em Escolher e marque a opção mais parecida com o seu jeito hoje. 💜",
  done: "Pronto! 🎉 Já está tudo certo.\n\nTodo dia às 9h eu te lembro de registrar as vendas e os gastos do dia anterior. Leva um minuto.\n\nQuer começar agora? É só tocar no botão.",
  help: "Eu sou o acompanhamento da EmpowerFI.\n\nVocê pode me contar o seu dia por escrito ou por áudio, por exemplo: «vendi 250 no Pix e gastei 80 de embalagem no dinheiro». Eu te mostro o que entendi antes de registrar.\n\nEscreva VER para conferir ou corrigir os registros de ontem e de hoje.\n\nEscreva META para ver ou combinar a sua meta da semana.\n\nEscreva AUTORIZAÇÕES para ver com quem você compartilha os seus números.\n\nEscreva AJUDA para ver isto de novo, ou SAIR para parar de receber mensagens.\n\nSe estiver no meio de uma pergunta, é só responder que a gente continua de onde parou.",
  left: "Pronto, parei por aqui. Você não vai receber mais mensagens. Para voltar, é só escrever. 💜",
  alreadyActive: "Para registrar o dia, toque no botão, ou me conte por escrito ou por áudio o que vendeu e o que gastou. Se não teve movimento, escreva SEM MOVIMENTO. Para conferir ou corrigir os registros de ontem e de hoje, escreva VER. 💜",
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
export function question(conv: Conversation): Say | null {
  if (conv.state === "CONSENT") return SAY.welcome;
  if (conv.state !== "PROFILE") return null;
  return ASK[conv.step ?? "adult"];
}

const ASK: Record<Exclude<Step, null>, Say> = {
  adult: SAY.adult,
  name: SAY.askName,
  city: SAY.askCity,
  sector: SAY.askSector,
  since: SAY.since,
  cnpj: SAY.cnpj,
  finance: SAY.finance,
};

/**
 * The first thing the profile still lacks, in the order she is asked; null
 * when nothing is missing. Deciding the next question from the draft rather
 * than from the last step means a conversation begun before a question was
 * added still ends with every answer the enrolment needs.
 */
export function nextStep(d: Draft): Exclude<Step, null> | null {
  if (d.adult_woman !== true) return "adult";
  if (!d.name) return "name";
  if (!d.city || !d.state_uf) return "city";
  if (!d.sector) return "sector";
  if (!("months_operating" in d)) return "since";
  if (!d.formalization) return "cnpj";
  if (!d.finance_control) return "finance";
  return null;
}

/** A tapped option's value, or the same answer typed in words. Undefined when it is neither. */
function chosen<T extends string>(incoming: string, prefix: string, words: Record<string, T>): T | undefined {
  const s = strip(incoming);
  if (s.startsWith(prefix)) {
    const v = s.slice(prefix.length);
    return Object.values(words).includes(v as T) ? v as T : undefined;
  }
  if (s in words) return words[s];
  // A word inside a longer answer counts only when nothing in it says no:
  // "não sou MEI" contains "mei" and means the opposite.
  if (/\bnao\b/.test(s)) return undefined;
  for (const [word, value] of Object.entries(words)) {
    if (word.length >= 3 && new RegExp(`\\b${word}\\b`).test(s)) return value;
  }
  return undefined;
}

const ADULT: Record<string, "yes" | "no"> = { "sim": "yes", "s": "yes", "sou": "yes", "nao": "no", "n": "no" };
const FORMAL: Record<string, Formalization> = {
  "mei": "mei", "outro cnpj": "cnpj", "tenho cnpj": "cnpj", "cnpj": "cnpj", "nao tenho": "none", "nao": "none",
};
const CONTROL: Record<string, FinanceControl> = {
  "caderno": "notebook", "anoto": "notebook", "planilha": "spreadsheet", "excel": "spreadsheet",
  "aplicativo": "app", "app": "app", "cabeca": "memory", "nao controlo": "none", "nada": "none", "nao": "none",
};

/** "onb:since:12", or "3 anos" typed. Undefined when it is neither. */
function tenure(incoming: string): number | null | undefined {
  const s = strip(incoming);
  if (s === "onb:since:unknown") return null;
  const tapped = s.match(/^onb:since:(\d{1,3})$/);
  if (tapped) {
    const n = Number(tapped[1]);
    return n >= 1 && n <= 720 ? n : undefined;
  }
  return parseTenure(incoming);
}

/** Moves to the next missing answer, or finishes. */
function onward(conv: Conversation, draft: Draft): Turn {
  const step = nextStep(draft);
  if (step === null) {
    return {
      next: { state: "ACTIVE", step: null, draft },
      say: [SAY.done],
      completed: true,
      offerJournal: true,
    };
  }
  return { next: { ...conv, state: "PROFILE", step, draft }, say: [ASK[step]] };
}

export function advance(conv: Conversation, incoming: string): Turn {
  const keep = (say: Say[]): Turn => ({ next: conv, say });

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
      return { ...onward(conv, { ...conv.draft, consented: true }), consented: true };
    }

    case "PROFILE": {
      const d = conv.draft;
      switch (conv.step) {
        case "adult": {
          const answer = isYes(incoming) ? "yes" : chosen(incoming, "onb:adult:", ADULT);
          if (answer === undefined) return keep([SAY.adultAgain]);
          // Not eligible: nothing she answered is kept, and writing again starts over.
          if (answer === "no") return { next: FRESH, say: [SAY.notEligible] };
          return onward(conv, { ...d, adult_woman: true });
        }
        case "name": {
          const name = parseName(incoming);
          if (name === null || incoming.trim().toLowerCase().startsWith("onb:")) return keep([SAY.askNameAgain]);
          return onward(conv, { ...d, name });
        }
        case "city": {
          const place = parseCity(incoming);
          if (place === null) return keep([SAY.askCityAgain]);
          return onward(conv, { ...d, city: place.city, state_uf: place.uf });
        }
        case "sector": {
          const sector = incoming.trim().replace(/\s+/g, " ");
          if (sector.length < 2 || sector.length > 60 || !/\p{L}/u.test(sector) || sector.startsWith("onb:")) {
            return keep([SAY.askSectorAgain]);
          }
          return onward(conv, { ...d, sector });
        }
        case "since": {
          const months = tenure(incoming);
          if (months === undefined) return keep([SAY.sinceAgain]);
          return onward(conv, { ...d, months_operating: months });
        }
        case "cnpj": {
          const formalization = chosen(incoming, "onb:cnpj:", FORMAL);
          if (formalization === undefined) return keep([SAY.cnpjAgain]);
          return onward(conv, { ...d, formalization });
        }
        case "finance": {
          const finance_control = chosen(incoming, "onb:finance:", CONTROL);
          if (finance_control === undefined) return keep([SAY.financeAgain]);
          return onward(conv, { ...d, finance_control });
        }
        default:
          // A row with no step is a row nothing can be decided from: ask the
          // first missing answer rather than guess which one it was.
          return onward(conv, d);
      }
    }

    case "ACTIVE":
      return { next: conv, say: [SAY.alreadyActive], offerJournal: true };
  }
}
