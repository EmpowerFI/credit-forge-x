import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const serif = loadSerif("normal", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] }).fontFamily;
loadSerif("italic", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] });
const sans = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] }).fontFamily;

const C = { bg: "#f6f4ef", ink: "#0f172a", muted: "#3f4a63", gold: "#d4920a", goldText: "#8f5c00", line: "#d9d4c7", card: "#ffffff" };

type Lang = "pt" | "en";
const COPY = {
  pt: {
    eyebrow: "Diário EmpowerFI",
    purpose1: "Assuma o controle financeiro",
    purpose2: "do seu negócio.",
    easy1: "Sem complicações.",
    easy2: "Sem planilhas difíceis.",
    noteEyebrow: "Vendeu ou gastou?",
    noteTitle: ["Anote em ", "segundos."],
    noteBullets: ["Digitando ou falando", "Pix, dinheiro ou cartão", "À vista ou parcelado"],
    dayEyebrow: "Todo dia",
    dayTitle: ["Veja como foi ", "o seu dia."],
    dayBody: "Vendas, gastos e o lucro do dia, num só lugar.",
    monthEyebrow: "Todo mês",
    monthTitle: ["Seu lucro de verdade, ", "depois do seu salário."],
    monthBody: "Você coloca o seu salário mensal. O diário mostra o que sobra.",
    tipEyebrow: "Toda semana",
    tipTitle: ["Uma dica para ", "o seu negócio."],
    tipBody: "Curta, simples e pensada no que você vende.",
    close: ["Organize. Participe. ", "Prospere."],
    closeSub: "Grátis · Lista de espera aberta",
  },
  en: {
    eyebrow: "The EmpowerFI diary",
    purpose1: "Take control of",
    purpose2: "your business's money.",
    easy1: "No hassle.",
    easy2: "No difficult spreadsheets.",
    noteEyebrow: "Sold or spent something?",
    noteTitle: ["Note it in ", "seconds."],
    noteBullets: ["By typing or by voice", "Pix, cash or card", "Paid now or in instalments"],
    dayEyebrow: "Every day",
    dayTitle: ["See how ", "your day went."],
    dayBody: "Sales, expenses and the day's profit, in one place.",
    monthEyebrow: "Every month",
    monthTitle: ["Your real profit, ", "after your salary."],
    monthBody: "You enter your monthly salary. The diary shows what is left.",
    tipEyebrow: "Every week",
    tipTitle: ["A tip for ", "your business."],
    tipBody: "Short, simple, and made for what you sell.",
    close: ["Organize. Engage. ", "Thrive."],
    closeSub: "Free · Waitlist open",
  },
} satisfies Record<Lang, unknown>;

const T = 15;
const SCENES = [165, 195, 165, 165, 165, 150];
export const DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);

function useEnter(delay: number, distance = 28) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}

const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <div style={{ ...useEnter(delay, 12), fontFamily: sans, fontWeight: 500, fontSize: 28, letterSpacing: "0.24em", textTransform: "uppercase", color: C.goldText }}>{children}</div>
);

const Rule: React.FC<{ delay?: number; width?: number }> = ({ delay = 0, width = 160 }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 20], [0, width], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return <div style={{ height: 3, width: w, background: C.gold, margin: "28px 0" }} />;
};

const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <em style={{ fontStyle: "italic", color: C.goldText }}>{children}</em>;

const Phone: React.FC<{ src: string; delay?: number; width?: number; tilt?: number }> = ({ src, delay = 0, width = 440, tilt = 0 }) => {
  const frame = useCurrentFrame();
  const float = Math.sin((frame - delay) / 40) * 6;
  const e = useEnter(delay, 60);
  return (
    <div style={{ opacity: e.opacity, transform: `${e.transform} translateY(${float}px) rotate(${tilt}deg)`, width, borderRadius: 34, background: C.ink, padding: 12, boxShadow: "0 30px 80px rgba(15,23,42,0.18)" }}>
      <div style={{ borderRadius: 24, overflow: "hidden", background: C.bg }}>
        <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
};

const Bullet: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <div style={{ ...useEnter(delay, 18), display: "flex", alignItems: "center", gap: 22, fontFamily: serif, fontSize: 42, color: C.ink, margin: "14px 0" }}>
    <span style={{ width: 14, height: 14, borderRadius: 7, background: C.gold, flexShrink: 0 }} />
    {children}
  </div>
);

const TwoCol: React.FC<{ left: React.ReactNode; right: React.ReactNode }> = ({ left, right }) => (
  <AbsoluteFill style={{ background: C.bg, color: C.ink, flexDirection: "row", alignItems: "center", padding: "0 140px", gap: 110 }}>
    <div style={{ flex: 1 }}>{left}</div>
    <div style={{ display: "flex", gap: 40, alignItems: "center" }}>{right}</div>
  </AbsoluteFill>
);

/** A spreadsheet grid, crossed out: what the diary spares her. */
const Sheet: React.FC<{ delay: number }> = ({ delay }) => {
  const frame = useCurrentFrame();
  const e = useEnter(delay, 30);
  const cross = interpolate(frame - delay - 30, [0, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const cols = 5, rows = 7, cw = 92, rh = 46;
  return (
    <div style={{ ...e, position: "relative", width: cols * cw, height: rows * rh, background: C.card, border: `2px solid ${C.line}`, borderRadius: 6 }}>
      {Array.from({ length: rows - 1 }, (_, r) => <div key={`r${r}`} style={{ position: "absolute", left: 0, right: 0, top: (r + 1) * rh, height: 1.5, background: C.line }} />)}
      {Array.from({ length: cols - 1 }, (_, c) => <div key={`c${c}`} style={{ position: "absolute", top: 0, bottom: 0, left: (c + 1) * cw, width: 1.5, background: C.line }} />)}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: rh, background: "#ece8de" }} />
      {[0, 1].map((k) => (
        <div key={k} style={{ position: "absolute", left: "50%", top: "50%", width: `${cross * 118}%`, height: 7, background: C.gold, borderRadius: 4,
          transform: `translate(-50%, -50%) rotate(${k ? -34 : 34}deg)` }} />
      ))}
    </div>
  );
};

const Purpose: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <TwoCol
      left={<>
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <Rule delay={6} />
        <div style={{ ...useEnter(10), fontFamily: serif, fontSize: 92, lineHeight: 1.06 }}>{t.purpose1}</div>
        <div style={{ ...useEnter(20), fontFamily: serif, fontSize: 92, lineHeight: 1.06 }}><Gold>{t.purpose2}</Gold></div>
        <div style={{ ...useEnter(52), fontFamily: serif, fontSize: 46, color: C.muted, marginTop: 44 }}>{t.easy1}</div>
        <div style={{ ...useEnter(64), fontFamily: serif, fontSize: 46, color: C.muted, marginTop: 6 }}>{t.easy2}</div>
      </>}
      right={<Sheet delay={50} />}
    />
  );
};

const Note: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <TwoCol
      left={<>
        <Eyebrow>{t.noteEyebrow}</Eyebrow>
        <Rule delay={6} />
        <div style={{ ...useEnter(10), fontFamily: serif, fontSize: 92, lineHeight: 1.06, marginBottom: 34 }}>{t.noteTitle[0]}<Gold>{t.noteTitle[1]}</Gold></div>
        {t.noteBullets.map((b, i) => <Bullet key={b} delay={30 + i * 12}>{b}</Bullet>)}
      </>}
      right={<>
        <Phone src={`2-entry-${lang}.jpg`} delay={14} width={400} tilt={-1.5} />
        <Phone src={`3-review-${lang}.jpg`} delay={60} width={400} tilt={1.5} />
      </>}
    />
  );
};

const Screen: React.FC<{ eyebrow: string; title: string[]; body: string; src: string; width?: number }> = ({ eyebrow, title, body, src, width = 470 }) => (
  <TwoCol
    left={<>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Rule delay={6} />
      <div style={{ ...useEnter(10), fontFamily: serif, fontSize: 88, lineHeight: 1.08 }}>{title[0]}<Gold>{title[1]}</Gold></div>
      <div style={{ ...useEnter(30), fontFamily: serif, fontSize: 44, lineHeight: 1.3, color: C.muted, marginTop: 36, maxWidth: 860 }}>{body}</div>
    </>}
    right={<Phone src={src} delay={16} width={width} tilt={1.2} />}
  />
);

const Day: React.FC<{ lang: Lang }> = ({ lang }) => { const t = COPY[lang]; return <Screen eyebrow={t.dayEyebrow} title={t.dayTitle} body={t.dayBody} src={`1-today-${lang}.jpg`} width={430} />; };
const Month: React.FC<{ lang: Lang }> = ({ lang }) => { const t = COPY[lang]; return <Screen eyebrow={t.monthEyebrow} title={t.monthTitle} body={t.monthBody} src={`4-month-${lang}.jpg`} width={560} />; };
const Tip: React.FC<{ lang: Lang }> = ({ lang }) => { const t = COPY[lang]; return <Screen eyebrow={t.tipEyebrow} title={t.tipTitle} body={t.tipBody} src={`5-reading-${lang}.jpg`} width={560} />; };

const Close: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", color: C.ink, textAlign: "center" }}>
      <Img src={staticFile("empowerfi-mark.png")} style={{ ...useEnter(0, 20), width: 120, height: 120, borderRadius: 8 }} />
      <div style={{ ...useEnter(10), fontFamily: serif, fontSize: 104, marginTop: 40 }}>{t.close[0]}<Gold>{t.close[1]}</Gold></div>
      <Rule delay={24} width={200} />
      <div style={{ ...useEnter(30), fontFamily: sans, fontSize: 30, letterSpacing: "0.2em", textTransform: "uppercase", color: C.goldText }}>{t.closeSub}</div>
    </AbsoluteFill>
  );
};

export const DiaryFilm: React.FC<{ lang: Lang }> = ({ lang }) => {
  const scenes = [Purpose, Note, Day, Month, Tip, Close];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <TransitionSeries>
        {scenes.flatMap((Scene, i) => {
          const parts = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={SCENES[i]} premountFor={30}>
              <Scene lang={lang} />
            </TransitionSeries.Sequence>,
          ];
          if (i < scenes.length - 1) parts.push(<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />);
          return parts;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
