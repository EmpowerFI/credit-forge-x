// Press and media appearances, shown on /about (EN) and /pt/sobre (PT).
//
// Kept in its own module rather than inside about.ts because this list grows on
// its own cadence — a new podcast, a TV slot, a newspaper piece — and adding one
// should not mean editing the institutional copy around it.
//
// To add an appearance: add an entry to BOTH mediaPt.items and mediaEn.items.
// The list renders newest first, in the order written here.

export type MediaKind = "podcast" | "tv" | "press";

export interface MediaItem {
  kind: MediaKind;
  /** Programme, channel or publication, e.g. "Protagonismo Mulher". */
  outlet: string;
  title: string;
  desc: string;
  /** YouTube video id — renders the player. Omit for a link-only entry. */
  youtubeId?: string;
  /** External link, for a piece with no embed (a newspaper article, say). */
  href?: string;
  linkLabel?: string;
  /**
   * Language of the piece. Shown as a chip only when it differs from the page,
   * so an English-speaking reader knows before clicking play.
   */
  lang: "pt-BR" | "en";
  /** Display date, already formatted for its language. Omit if unknown. */
  date?: string;
  /**
   * Episode announced but not yet aired. Shows the date as a premiere instead
   * of listing it as something that already happened. Flip to false — or drop
   * the field — once it is live.
   */
  upcoming?: boolean;
}

export interface MediaContent {
  eyebrow: string;
  titleLead: string;
  titleAccent: string;
  subtitle: string;
  kindLabels: Record<MediaKind, string>;
  /** Chip text for a piece not in the page's language. */
  otherLanguageLabel: string;
  /** Accessible name for the play button, "{title}" substituted in. */
  playLabel: string;
  /** Prefix for an unaired piece, e.g. "Estreia" -> "Estreia 10/09/2026". */
  upcomingLabel: string;
}

export const mediaPt: MediaContent = {
  eyebrow: "Na mídia",
  titleLead: "EmpowerFI ",
  titleAccent: "por aí",
  subtitle:
    "Podcasts, TV e imprensa em que a EmpowerFI e sua fundadora falam sobre acesso a crédito e empreendedorismo feminino.",
  kindLabels: { podcast: "Podcast", tv: "TV", press: "Imprensa" },
  otherLanguageLabel: "Em inglês",
  playLabel: "Assistir: {title}",
  upcomingLabel: "Estreia",
};

export const mediaEn: MediaContent = {
  eyebrow: "In the media",
  titleLead: "EmpowerFI ",
  titleAccent: "out in the world",
  subtitle:
    "Podcasts, television and press where EmpowerFI and its founder discuss credit access and women's entrepreneurship.",
  kindLabels: { podcast: "Podcast", tv: "TV", press: "Press" },
  otherLanguageLabel: "In Portuguese",
  playLabel: "Play: {title}",
  upcomingLabel: "Premieres",
};

export const mediaItemsPt: MediaItem[] = [
  {
    kind: "podcast",
    outlet: "Protagonismo Mulher",
    title: "EmpowerFI: crédito, educação financeira e oportunidades para mulheres",
    desc: "Painel apresentado por Roberta Stock sobre empreendedorismo feminino, acesso a crédito e educação financeira, com Fernando Blanco e Daniel Branco. A conversa gira em torno do ponto que sustenta a EmpowerFI: ter acesso ao dinheiro importa, mas é a capacidade de decidir que transforma recurso em crescimento sustentável.",
    youtubeId: "m9YNq-fOdQQ",
    lang: "pt-BR",
    date: "10/09/2026",
    upcoming: true,
  },
];

export const mediaItemsEn: MediaItem[] = [
  {
    kind: "podcast",
    outlet: "Protagonismo Mulher",
    title: "EmpowerFI: credit, financial education and opportunity for women",
    desc: "A panel hosted by Roberta Stock on women's entrepreneurship, credit access and financial education, with Fernando Blanco and Daniel Branco. It turns on the point EmpowerFI is built around: access to money matters, but it is the capacity to decide that turns a resource into sustainable growth.",
    youtubeId: "m9YNq-fOdQQ",
    lang: "pt-BR",
    date: "10 September 2026",
    upcoming: true,
  },
];
