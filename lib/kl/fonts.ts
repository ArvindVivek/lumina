// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/fonts.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// Studio type: Fredoka 600 for headings, numbers and buttons; Nunito for body text.
// Same setup as overdraft/app/layout.tsx. Put `fontVariables` on <html>; tokens.css maps
// --font-fredoka / --font-nunito to the font-display / font-body utilities.
import { Fredoka, Nunito } from "next/font/google";

export const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: "600",
  display: "swap",
});

export const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

/** `<html className={fontVariables}>` */
export const fontVariables = `${fredoka.variable} ${nunito.variable}`;
