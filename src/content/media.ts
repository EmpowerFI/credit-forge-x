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
}

export const mediaPt: MediaContent = {
  eyebrow: "Na mídia",
  titleLead: "EmpowerFI ",
  titleAccent: "por aí",
  subtitle:
    "Podcasts, TV e imprensa em que a EmpowerFI e sua fundadora falaram sobre acesso a crédito e empreendedorismo feminino.",
  kindLabels: { podcast: "Podcast", tv: "TV", press: "Imprensa" },
  otherLanguageLabel: "Em inglês",
  playLabel: "Assistir: {title}",
};

export const mediaEn: MediaContent = {
  eyebrow: "In the media",
  titleLead: "EmpowerFI ",
  titleAccent: "out in the world",
  subtitle:
    "Podcasts, television and press where EmpowerFI and its founder discussed credit access and women's entrepreneurship.",
  kindLabels: { podcast: "Podcast", tv: "TV", press: "Press" },
  otherLanguageLabel: "In Portuguese",
  playLabel: "Play: {title}",
};

export const mediaItemsPt: MediaItem[] = [
  {
    kind: "podcast",
    outlet: "Protagonismo Mulher",
    title: "Daniele Santos no Protagonismo Mulher",
    desc: "Painel apresentado por Roberta Stock, com a fundadora e CEO da EmpowerFI ao lado de Fernando Blanco e Daniel Branco.",
    youtubeId: "m9YNq-fOdQQ",
    lang: "pt-BR",
  },
];

export const mediaItemsEn: MediaItem[] = [
  {
    kind: "podcast",
    outlet: "Protagonismo Mulher",
    title: "Daniele Santos on Protagonismo Mulher",
    desc: "A panel hosted by Roberta Stock, with EmpowerFI's founder and CEO alongside Fernando Blanco and Daniel Branco.",
    youtubeId: "m9YNq-fOdQQ",
    lang: "pt-BR",
  },
];
