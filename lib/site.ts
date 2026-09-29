// The app's identity in one place. The icon, share card, manifest, robots and sitemap read it.

export const site = {
  /** Shown in the header, the tab title and the share card. */
  name: "Lumina",
  /** Home-screen label: 12 characters or fewer. */
  shortName: "Lumina",
  /** One plain sentence: what it does and for whom. */
  description:
    "VALORANT match analytics and an AI coach for pro play: player, team and round breakdowns from 32 VCT Americas playoff series.",
  /** Production URL, no trailing slash. Makes share-image URLs absolute. */
  url: "https://lumina-ten-amber.vercel.app",
  /** Brand key: privacy and support links live at kitchenlabs-one.vercel.app/apps/<slug>/. */
  slug: "lumina",
  /** A public showcase: robots.ts allows crawling and sitemap.ts lists the pages. */
  isPublic: true,
  /** Must equal --bg in kl-tokens.css (light, dark) so browser chrome never flashes. */
  themeColor: { light: "#F2F4F9", dark: "#0B0F1A" },
  /** Share-card colours (Satori can't read CSS variables): the app's accent and neutrals. */
  card: { bg: "#F2F4F9", ink: "#121829", ink2: "#5A6479", accent: "#BE123C" },
} as const;

/** Required by Riot's "Legal Jibber Jabber" policy for fan projects, word for word. */
export const RIOT_DISCLAIMER =
  "Lumina was created under Riot Games' \"Legal Jibber Jabber\" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.";
