/** App name everywhere (titles, OG, Twitter). */
export const SITE_NAME = "Tongue";

/** Homepage & default `<meta description>` / social card text. */
export const SITE_DESCRIPTION = "Notizie in sintesi, con fonti verificabili";

/** `/chat` route: slightly different wording, same OG image & site name. */
export const CHAT_DESCRIPTION = "Conversazione e notizie con fonti verificabili";

/** `public/logo.png` — keep width/height in sync with actual file for previews. */
export const OG_LOGO_IMAGE = {
  url: "/logo.png",
  width: 1376,
  height: 768,
  alt: SITE_NAME,
} as const;
