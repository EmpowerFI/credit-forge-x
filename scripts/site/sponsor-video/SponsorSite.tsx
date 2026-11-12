import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadSerif } from "@remotion/google-fonts/SourceSerif4";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

const serif = loadSerif("normal", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] }).fontFamily;
loadSerif("italic", { weights: ["400", "500"], subsets: ["latin", "latin-ext"] });
const sans = loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin", "latin-ext"] }).fontFamily;

const C = { bg: "#f6f4ef", ink: "#0f172a", navy: "#13294b", muted: "#3f4a63", gold: "#d4920a", goldText: "#8f5c00", line: "#d9d4c7", card: "#ffffff",
  sales: "#1d5fa8", expense: "#b85c0e", green: "#1f7a4d" };

type Lang = "pt" | "en";
const FPS = 30;
const T = 15;
const SCENES = [180, 180, 255, 255, 165];
export const DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);

const COPY = {
  pt: {
    s1Title: ["Potencial existe.", "Oportunidades nem sempre chegam."],
    s2Title: ["Do investimento social", "ao impacto real."],
    s3Eyebrow: "Uma jornada de 30 dias",
    s3Title: ["Aprendizado.", "Disciplina.", "Incentivo."],
    s3Steps: ["Registra vendas e gastos nos dias em que abre", "Recebe uma dica por semana para o negócio", "Cumpre a jornada e recebe a recompensa"],
    s4Eyebrow: "Área do patrocinador",
    s4Title: ["Impacto acompanhado.", "Resultados mensuráveis."],
    s4Cards: ["Participação", "Engajamento", "Jornadas concluídas", "Evolução dos negócios"],
    s4Privacy: "Sempre em totais do grupo, a partir de 5 empreendedoras. Nunca nomes.",
    illustrative: "Ilustrativo",
    day: "Dia",
    s5Lines: ["Patrocine uma jornada.", "Impulsione negócios.", "Acompanhe o impacto."],
    s5Cta: "Seja um patrocinador EmpowerFI.",
    sponsor: "Patrocinador",
    s1Body: "Milhões de mulheres empreendem todos os dias. Muitas ainda têm dificuldade para organizar as finanças e mostrar seus resultados.",
    s2Body: "Seu investimento social pode gerar mais do que visibilidade: negócios mais preparados.",
    businesses: ["Confeitaria", "Salão", "Costura", "Mercadinho", "Artesanato", "Marmitas"],
    captions: [
      [0, 5, "Milhões de mulheres empreendem todos os dias."],
      [5, 10, "Mas muitas ainda têm dificuldade para organizar as finanças, mostrar seus resultados e acessar oportunidades."],
      [10, 15, "E se o investimento social da sua empresa pudesse gerar mais do que visibilidade?"],
      [15, 20, "E se ele ajudasse a construir negócios mais preparados?"],
      [20, 27, "A EmpowerFI transforma patrocínios em jornadas de 30 dias de organização financeira."],
      [27, 35, "Elas registram vendas e gastos, recebem uma dica por semana e, ao cumprir a jornada, a recompensa da campanha."],
      [35, 42, "Para o patrocinador: uma iniciativa estruturada, com participação e engajamento acompanhados."],
      [42, 50, "Dados para entender os resultados e demonstrar o impacto, sem expor nenhuma empreendedora."],
      [50, 55, "EmpowerFI. Conectando mulheres, oportunidades e crescimento."],
      [55, 60, "Sua empresa pode fazer parte dessa transformação."],
    ] as [number, number, string][],
  },
  en: {
    s1Title: ["The potential is there.", "Opportunities don't always arrive."],
    s2Title: ["From social investment", "to real impact."],
    s3Eyebrow: "A 30-day journey",
    s3Title: ["Learning.", "Discipline.", "Incentive."],
    s3Steps: ["She records sales and expenses on the days she opens", "A tip for her business every week", "She completes the journey and earns the reward"],
    s4Eyebrow: "The sponsor's area",
    s4Title: ["Impact followed.", "Results you can measure."],
    s4Cards: ["Participation", "Engagement", "Journeys completed", "Business progress"],
    s4Privacy: "Always group totals, from five entrepreneurs up. Never names.",
    illustrative: "Illustrative",
    day: "Day",
    s5Lines: ["Sponsor a journey.", "Boost businesses.", "Follow the impact."],
    s5Cta: "Become an EmpowerFI sponsor.",
    sponsor: "Sponsor",
    s1Body: "Millions of women run a business every day. Many still struggle to organize their finances and show their results.",
    s2Body: "Your social investment can do more than build visibility: better-prepared businesses.",
    businesses: ["Bakery", "Salon", "Sewing", "Corner shop", "Crafts", "Lunch boxes"],
    captions: [
      [0, 5, "Millions of women run a business every day."],
      [5, 10, "But many still struggle to organize their finances, show their results and reach opportunities."],
      [10, 15, "What if your company's social investment could do more than build visibility?"],
      [15, 20, "What if it helped build better-prepared businesses?"],
      [20, 27, "EmpowerFI turns sponsorships into 30-day journeys of financial organization."],
      [27, 35, "They record sales and expenses, get a weekly tip and, when they complete the journey, the campaign's reward."],
      [35, 42, "For the sponsor: a structured initiative, with participation and engagement followed."],
      [42, 50, "Data to understand the results and show the impact, without exposing any entrepreneur."],
      [50, 55, "EmpowerFI. Connecting women, opportunities and growth."],
      [55, 60, "Your company can be part of this change."],
    ] as [number, number, string][],
  },
} satisfies Record<Lang, unknown>;

function useEnter(delay: number, distance = 30) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 22 });
  return { opacity: p, transform: `translateY(${(1 - p) * distance}px)` };
}
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** useEnter as a component, for items of a list. */
const In: React.FC<{ delay: number; distance?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ delay, distance, style, children }) => (
  <div style={{ ...useEnter(delay, distance), ...style }}>{children}</div>
);
const Gold: React.FC<{ children: React.ReactNode }> = ({ children }) => <em style={{ fontStyle: "italic", color: C.goldText }}>{children}</em>;

const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
  <div style={{ ...useEnter(delay, 12), fontFamily: sans, fontWeight: 500, fontSize: 30, letterSpacing: "0.22em", textTransform: "uppercase", color: C.goldText }}>{children}</div>
);
const Rule: React.FC<{ delay?: number; width?: number; center?: boolean }> = ({ delay = 0, width = 150, center }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame - delay, [0, 20], [0, width], { ...clamp, easing: Easing.out(Easing.cubic) });
  return <div style={{ height: 4, width: w, background: C.gold, margin: center ? "30px auto" : "30px 0" }} />;
};

/** Simple line glyphs for the businesses: no faces, no stock people. */
const Glyph: React.FC<{ i: number }> = ({ i }) => {
  const s = { fill: "none", stroke: C.navy, strokeWidth: 3.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const g = [
    <><path d="M14 30h36v20H14z" {...s} /><path d="M18 30c0-8 6-12 14-12s14 4 14 12" {...s} /><path d="M32 12v6" {...s} /></>, // cake
    <><circle cx="22" cy="44" r="7" {...s} /><circle cx="42" cy="44" r="7" {...s} /><path d="M27 39 44 14M37 39 20 14" {...s} /></>, // scissors
    <><path d="M32 12v40" {...s} /><path d="M32 12c10 0 14 6 14 6" {...s} /><circle cx="32" cy="52" r="3" {...s} /><path d="M18 22h28" {...s} /></>, // needle
    <><path d="M12 26h40l-4-12H16z" {...s} /><path d="M16 26v26h32V26" {...s} /><path d="M28 52V40h8v12" {...s} /></>, // shop
    <><path d="M16 50c8-24 24-24 32 0" {...s} /><circle cx="32" cy="20" r="8" {...s} /><path d="M24 50h16" {...s} /></>, // vase
    <><rect x="12" y="24" width="40" height="26" rx="4" {...s} /><path d="M12 34h40M22 24v-6h20v6" {...s} /></>, // lunch box
  ][i % 6];
  return <svg viewBox="0 0 64 64" width="64" height="64">{g}</svg>;
};

const Network: React.FC<{ lang: Lang; grow?: number; startDelay?: number }> = ({ lang, grow = 6, startDelay = 20 }) => {
  const frame = useCurrentFrame();
  const t = COPY[lang];
  const cx = 450, cy = 330, R = 270;
  const nodes = Array.from({ length: grow }, (_, i) => {
    const a = -Math.PI / 2 + (i / grow) * Math.PI * 2;
    return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
  });
  const hub = useEnter(startDelay - 10, 20);
  return (
    <div style={{ position: "relative", width: 900, height: 660 }}>
      <svg width={900} height={660} style={{ position: "absolute", inset: 0 }}>
        {nodes.map((n, i) => {
          const p = interpolate(frame - startDelay - i * 8, [0, 20], [0, 1], clamp);
          return <line key={i} x1={cx} y1={cy} x2={cx + (n.x - cx) * p} y2={cy + (n.y - cy) * p} stroke={C.gold} strokeWidth={3} />;
        })}
      </svg>
      <div style={{ ...hub, position: "absolute", left: cx - 110, top: cy - 110, width: 220, height: 220, borderRadius: 110, background: C.navy, color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: sans, fontWeight: 600, fontSize: 30, gap: 10 }}>
        <svg viewBox="0 0 64 64" width="70" height="70"><path d="M14 54V14h24v40M38 26h12v28M20 22h4M28 22h4M20 32h4M28 32h4M20 42h4M28 42h4M44 34h2M44 44h2M10 54h44" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" /></svg>
        {t.sponsor}
      </div>
      {nodes.map((n, i) => {
        const e = spring({ frame: frame - startDelay - 14 - i * 8, fps: FPS, config: { damping: 14 }, durationInFrames: 26 });
        return (
          <div key={i} style={{ position: "absolute", left: n.x - 80, top: n.y - 80, width: 160, height: 160, transform: `scale(${e})`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 80, background: C.card,
            border: `3px solid ${C.gold}`, boxShadow: "0 12px 30px rgba(15,23,42,0.10)" }}>
            <Glyph i={i} />
            <div style={{ fontFamily: sans, fontSize: 21, fontWeight: 500, color: C.muted }}>{t.businesses[i % 6]}</div>
          </div>
        );
      })}
    </div>
  );
};

const Bars: React.FC<{ delay: number; kind: "bars" | "line" | "ring" | "steps" }> = ({ delay, kind }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  if (kind === "ring") {
    const r = 58, c = 2 * Math.PI * r;
    return (
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke={C.line} strokeWidth="16" />
        <circle cx="75" cy="75" r={r} fill="none" stroke={C.gold} strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${c * 0.7 * p} ${c}`} transform="rotate(-90 75 75)" />
      </svg>
    );
  }
  if (kind === "line") {
    const pts = [[0, 110], [60, 95], [120, 100], [180, 70], [240, 62], [300, 30]];
    const len = Math.round(p * (pts.length - 1));
    return (
      <svg width="320" height="140" viewBox="0 0 320 140">
        <polyline points={pts.slice(0, len + 1).map(([x, y]) => `${x + 10},${y + 10}`).join(" ")} fill="none" stroke={C.green} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const hs = kind === "bars" ? [0.4, 0.55, 0.5, 0.7, 0.65, 0.85, 0.9] : [1, 0.82, 0.66, 0.52];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 140 }}>
      {hs.map((h, i) => (
        <div key={i} style={{ width: kind === "bars" ? 30 : 56, height: 140 * h * p, borderRadius: "6px 6px 0 0", background: kind === "bars" ? C.sales : C.navy, opacity: kind === "bars" ? 1 : 1 - i * 0.15 }} />
      ))}
    </div>
  );
};

const TwoCol: React.FC<{ left: React.ReactNode; right: React.ReactNode; gap?: number }> = ({ left, right, gap = 90 }) => (
  <AbsoluteFill style={{ background: C.bg, color: C.ink, flexDirection: "row", alignItems: "center", padding: "0 130px", gap }}>
    <div style={{ flex: 1 }}>{left}</div>
    <div style={{ display: "flex", alignItems: "center" }}>{right}</div>
  </AbsoluteFill>
);

const Body: React.FC<{ children: React.ReactNode; delay: number }> = ({ children, delay }) => (
  <div style={{ ...useEnter(delay), fontFamily: serif, fontSize: 40, lineHeight: 1.35, color: C.muted, marginTop: 34, maxWidth: 820 }}>{children}</div>
);

// ------------------------------------------------------------ 1 · the problem

const Mess: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    ["R$ 45,00", C.sales, -220, -40, -14], ["R$ 120,00", C.sales, 150, -110, 10], ["− R$ 38,00", C.expense, -160, 110, 8],
    ["R$ 12,50", C.sales, 200, 130, -9], ["− R$ 260,00", C.expense, -20, 230, 16], ["?", C.muted, 230, -250, -6],
    ["R$ 9,90", C.sales, -250, 270, 12], ["− R$ 75,00", C.expense, 40, -260, -12],
  ] as const;
  // From scattered to lined up, as the diary will do.
  const order = interpolate(frame, [100, 150], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  return (
    <div style={{ position: "relative", width: 640, height: 760 }}>
      {items.map(([t, color, x, y, r], i) => {
        const e = interpolate(frame - 10 - i * 5, [0, 16], [0, 1], clamp);
        const drift = Math.sin((frame + i * 20) / 30) * 10 * (1 - order);
        const tx = interpolate(order, [0, 1], [x, 0]);
        const ty = interpolate(order, [0, 1], [y, -300 + i * 86]);
        const rot = interpolate(order, [0, 1], [r, 0]);
        return (
          <div key={i} style={{ position: "absolute", left: "50%", top: "50%", opacity: e,
            transform: `translate(-50%, -50%) translate(${tx}px, ${ty + drift}px) rotate(${rot}deg)`,
            background: C.card, border: `2px solid ${C.line}`, borderRadius: 10, padding: "14px 26px", fontFamily: sans, fontWeight: 600, fontSize: 36,
            color, boxShadow: "0 10px 30px rgba(15,23,42,0.08)", minWidth: 250, textAlign: "center" }}>{t}</div>
        );
      })}
    </div>
  );
};

const Problem: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <TwoCol
      left={<>
        <Eyebrow delay={2}>{lang === "pt" ? "Para patrocinadores" : "For sponsors"}</Eyebrow>
        <Rule delay={6} />
        <div style={{ ...useEnter(8), fontFamily: serif, fontSize: 92, lineHeight: 1.05 }}>{t.s1Title[0]}</div>
        <div style={{ ...useEnter(20), fontFamily: serif, fontSize: 70, lineHeight: 1.1, marginTop: 10 }}><Gold>{t.s1Title[1]}</Gold></div>
        <Body delay={40}>{t.s1Body}</Body>
      </>}
      right={<Mess />}
    />
  );
};

// ------------------------------------------------------------ 2 · the opportunity

const Opportunity: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <TwoCol gap={40}
      left={<>
        <div style={{ ...useEnter(8), fontFamily: serif, fontSize: 88, lineHeight: 1.05 }}>{t.s2Title[0]}</div>
        <div style={{ ...useEnter(20), fontFamily: serif, fontSize: 88, lineHeight: 1.05 }}><Gold>{t.s2Title[1]}</Gold></div>
        <Body delay={40}>{t.s2Body}</Body>
      </>}
      right={<Network lang={lang} startDelay={14} />}
    />
  );
};

// ------------------------------------------------------------ 3 · the journey

const Journey: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  const frame = useCurrentFrame();
  const filled = Math.floor(interpolate(frame, [20, 200], [0, 30], clamp));
  return (
    <TwoCol gap={80}
      left={<>
        <Eyebrow delay={4}>{t.s3Eyebrow}</Eyebrow>
        <Rule delay={8} />
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {t.s3Title.map((w, i) => (
            <In key={w} delay={12 + i * 10} style={{ fontFamily: serif, fontSize: 76, lineHeight: 1.05 }}>{i === 2 ? <Gold>{w}</Gold> : w}</In>
          ))}
        </div>
        {/* Thirty days filling in; days off are part of the journey, so a few stay quiet. */}
        <div style={{ ...useEnter(24), display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10, marginTop: 40, maxWidth: 820 }}>
          {Array.from({ length: 30 }, (_, d) => {
            const off = d % 7 === 6;
            const on = d < filled;
            return (
              <div key={d} style={{ height: 54, borderRadius: 8, border: `2px solid ${on && !off ? C.gold : C.line}`,
                background: on ? (off ? "#ece8de" : "#fff4dc") : C.card, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: sans, fontSize: 20, color: on ? C.ink : C.line }}>{d + 1}</div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40 }}>
          {t.s3Steps.map((s, i) => (
            <In key={s} delay={70 + i * 30} distance={20} style={{ display: "flex", gap: 16, alignItems: "center", fontFamily: serif, fontSize: 34, lineHeight: 1.2 }}>
              <span style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 22, border: `3px solid ${C.gold}`, display: "flex", alignItems: "center",
                justifyContent: "center", fontFamily: sans, fontSize: 22, color: C.goldText }}>{i + 1}</span>
              {s}
            </In>
          ))}
        </div>
      </>}
      right={
        <div style={{ ...useEnter(40, 50), width: 420, borderRadius: 32, background: C.ink, padding: 12, boxShadow: "0 30px 70px rgba(15,23,42,0.18)", transform: "rotate(1.5deg)" }}>
          <div style={{ borderRadius: 22, overflow: "hidden" }}><Img src={staticFile(`2-entry-${lang}.jpg`)} style={{ width: "100%", display: "block" }} /></div>
        </div>
      }
    />
  );
};

// ------------------------------------------------------------ 4 · the sponsor's value

const Value: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  const kinds = ["steps", "bars", "ring", "line"] as const;
  return (
    <TwoCol gap={70}
      left={<>
        <Eyebrow delay={4}>{t.s4Eyebrow}</Eyebrow>
        <Rule delay={8} />
        <div style={{ ...useEnter(10), fontFamily: serif, fontSize: 80, lineHeight: 1.05 }}>{t.s4Title[0]}</div>
        <div style={{ ...useEnter(22), fontFamily: serif, fontSize: 80, lineHeight: 1.05 }}><Gold>{t.s4Title[1]}</Gold></div>
        <div style={{ ...useEnter(110, 16), display: "flex", gap: 16, alignItems: "flex-start", marginTop: 44, fontFamily: serif, fontSize: 38, lineHeight: 1.3, color: C.ink, maxWidth: 700 }}>
          <svg viewBox="0 0 24 24" width="46" height="46" style={{ flexShrink: 0, marginTop: 2 }}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z M8.5 12l2.5 2.5 4.5-5" fill="none" stroke={C.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {t.s4Privacy}
        </div>
      </>}
      right={
        <div style={{ ...useEnter(30, 40), width: 820, background: C.card, border: `2px solid ${C.line}`, borderRadius: 18, padding: 30, boxShadow: "0 30px 70px rgba(15,23,42,0.10)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: sans, fontWeight: 600, fontSize: 26, color: C.ink }}>
              <Img src={staticFile("empowerfi-mark.png")} style={{ width: 38, height: 38, borderRadius: 6 }} /> EmpowerFI · {t.s4Eyebrow}
            </div>
            <span style={{ fontFamily: sans, fontSize: 20, color: C.muted, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: "6px 16px" }}>{t.illustrative}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {t.s4Cards.map((label, i) => (
              <div key={label} style={{ border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 22, height: 240, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 24, color: C.muted }}>{label}</div>
                <div style={{ display: "flex", justifyContent: "center" }}><Bars delay={45 + i * 16} kind={kinds[i]} /></div>
              </div>
            ))}
          </div>
        </div>
      }
    />
  );
};

// ------------------------------------------------------------ 5 · the invitation (no address: she is on the site already)

const Invite: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = COPY[lang];
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.ink, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Img src={staticFile("empowerfi-mark.png")} style={{ ...useEnter(0, 20), width: 110, height: 110, borderRadius: 10 }} />
      <div style={{ marginTop: 36, display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", maxWidth: 1700 }}>
        {t.s5Lines.map((l, i) => (
          <In key={l} delay={12 + i * 12} style={{ fontFamily: serif, fontSize: 74, lineHeight: 1.12 }}>{i === 2 ? <Gold>{l}</Gold> : l}</In>
        ))}
      </div>
      <Rule delay={56} width={200} center />
      <div style={{ ...useEnter(64), fontFamily: sans, fontWeight: 600, fontSize: 42, color: C.ink, background: "#fff4dc", border: `3px solid ${C.gold}`,
        borderRadius: 14, padding: "20px 38px" }}>{t.s5Cta}</div>
    </AbsoluteFill>
  );
};

export const SponsorSite: React.FC<{ lang: Lang }> = ({ lang }) => {
  const scenes = [Problem, Opportunity, Journey, Value, Invite];
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <TransitionSeries>
        {scenes.flatMap((Sc, i) => {
          const parts = [
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={SCENES[i]} premountFor={30}>
              <Sc lang={lang} />
            </TransitionSeries.Sequence>,
          ];
          if (i < scenes.length - 1) parts.push(<TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: T })} />);
          return parts;
        })}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
