import { useState, type ReactNode } from "react";
import { Bell, ClipboardCheck, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tr } from "../i18n";
import { OpenDays } from "./BusinessWeek";
import { type DiaryProfile, markTourSeen, type ProgressIcon, progressIconSrc } from "./diary";


/** One of EmpowerFI's icons, large, as a step's picture. */
const Art = ({ code }: { code: ProgressIcon }) => (
  <img src={progressIconSrc(code)} alt="" aria-hidden="true" width={112} height={112} className="mx-auto h-28 w-28 object-contain" />
);

/** A feature named the way the screen names it, with the icon she will see there. */
function Point({ icon: Icon, children }: { icon: typeof Plus; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
        <Icon size={16} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </li>
  );
}

interface Step {
  art: ReactNode;
  title: string;
  body: ReactNode;
}

function steps(profile: DiaryProfile): Step[] {
  return [
    {
      art: <Art code="growth" />,
      title: tr({ en: "Welcome to EmpowerFI Diary", pt: "Boas-vindas ao EmpowerFI Diário" }),
      body: (
        <p>
          {tr({
            en: "Note what your business sells and spends, in under a minute a day. Week by week, you see how it is really doing.",
            pt: "Anote o que o seu negócio vende e gasta, em menos de um minuto por dia. Semana a semana, você vê como ele está de verdade.",
          })}
        </p>
      ),
    },
    {
      art: <Art code="money_bag" />,
      title: tr({ en: "Noting your day", pt: "Anotar o seu dia" }),
      body: (
        <ul className="space-y-3 text-left">
          <Point icon={Plus}>
            {tr({ en: "Tap ", pt: "Toque em " })}<strong>{tr({ en: "I sold or spent", pt: "Vendi ou gastei" })}</strong>
            {tr({ en: " and note one item at a time: the amount and how it was paid.", pt: " e anote um item por vez: o valor e como foi pago." })}
          </Point>
          <Point icon={ClipboardCheck}>
            {tr({ en: "Then ", pt: "Depois, " })}<strong>{tr({ en: "Review and save the day", pt: "Revisar e registrar o dia" })}</strong>
            {tr({ en: ". Received later or in instalments? Tick it on the item.", pt: ". Recebe depois ou parcelou? Marque no próprio item." })}
          </Point>
          <Point icon={Pencil}>
            {tr({
              en: "Remembered something? Today and yesterday can still take more, and each line can be corrected or removed.",
              pt: "Lembrou de algo? Hoje e ontem ainda aceitam mais, e cada lançamento pode ser corrigido ou removido.",
            })}
          </Point>
        </ul>
      ),
    },
    {
      art: <Art code="calendar" />,
      title: tr({ en: "Your week", pt: "A sua semana" }),
      body: (
        <div className="space-y-3 text-left">
          <p>
            {tr({
              en: "Each day you record gets your icon. Tell us the days your business opens: a closed day is never a missed one, and no reminder comes on it.",
              pt: "Cada dia registrado ganha o seu ícone. Diga em que dias seu negócio abre: dia fechado não é falta, e não chega lembrete nele.",
            })}
          </p>
          <OpenDays profile={profile} />
        </div>
      ),
    },
    {
      art: <Art code="dashboard" />,
      title: tr({ en: "Your week, read", pt: "A leitura da semana" }),
      body: (
        <p>
          {tr({
            en: "After a week with 3 days recorded, the diary writes you a short reading of your business: sales, costs, the result and one small step for the next week. It is written by AI from your figures, never with your name; you can turn the AI off under Reminders.",
            pt: "Depois de uma semana com 3 dias registrados, o diário escreve uma leitura curta do seu negócio: vendas, custos, resultado e um passo pequeno para a semana seguinte. Ela é escrita por IA a partir dos seus números, nunca com o seu nome; dá para desligar a IA em Lembretes.",
          })}
        </p>
      ),
    },
    {
      art: <Art code="folder" />,
      title: tr({ en: "Reminders and the rest", pt: "Lembretes e o resto" }),
      body: (
        <ul className="space-y-3 text-left">
          <Point icon={Bell}>
            {tr({
              en: "Under Reminders: one nudge a day at the time you choose, and the diary as an icon on your home screen.",
              pt: "Em Lembretes: um aviso por dia no horário que você escolher, e o diário como ícone na tela de início.",
            })}
          </Point>
          <Point icon={ClipboardCheck}>
            {tr({
              en: "Under History: your days, your weekly readings and any rewards you earn.",
              pt: "Em Histórico: os seus dias, as leituras da semana e os prêmios que você ganhar.",
            })}
          </Point>
        </ul>
      ),
    },
  ];
}

/**
 * The first-time tour: five short steps, one feature each, with the words
 * the screens use. The third lets her set the days her business opens, the
 * base of her week. Skippable at every step; seen once per phone; Lembretes
 * opens it again.
 */
export function Tour({ profile, userId, onClose }: { profile: DiaryProfile; userId: string; onClose: () => void }) {
  const list = steps(profile);
  const [i, setI] = useState(0);
  const step = list[i];
  const last = i === list.length - 1;
  const close = () => {
    markTourSeen(userId);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="diary max-h-[92dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-[1.25rem] p-6">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {tr({ en: `Step ${i + 1} of ${list.length}`, pt: `Passo ${i + 1} de ${list.length}` })}
        </p>
        {step.art}
        <DialogTitle className="text-center font-heading text-2xl font-semibold">{step.title}</DialogTitle>
        <DialogDescription asChild>
          <div className="text-base leading-relaxed text-foreground">{step.body}</div>
        </DialogDescription>

        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {list.map((_, n) => (
            <span key={n} className={`h-2 rounded-full transition-all motion-reduce:transition-none ${n === i ? "w-6 bg-primary" : "w-2 bg-border"}`} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {i === 0 ? (
            <Button variant="ghost" className="h-12 text-base" onClick={close}>{tr({ en: "Skip", pt: "Pular" })}</Button>
          ) : (
            <Button variant="outline" className="h-12 text-base" onClick={() => setI(i - 1)}>{tr({ en: "Back", pt: "Voltar" })}</Button>
          )}
          <Button className="h-12 text-base" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? tr({ en: "Start", pt: "Começar" }) : tr({ en: "Next", pt: "Próximo" })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
