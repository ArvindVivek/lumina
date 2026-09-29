// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/lib/contrast.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// WCAG 2.x contrast maths, same as KLHex.contrast on iOS and docs/brand/palettes.md.
// Use it in tests to pin token pairs, and at runtime for colours that come from data
// (pick a label colour per tile, like Anagrid and overdraft/components/ui/contrast.ts).

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Parses #RGB or #RRGGBB. Throws on anything else. */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two opaque colours, 1 to 21. Text needs 4.5, icons and rings 3. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** The label colour (from the candidates) with the best contrast on `background`. */
export function bestLabel(background: string, candidates: string[] = ["#FFFFFF", "#121829"]): string {
  return candidates.reduce((best, c) => (contrast(c, background) > contrast(best, background) ? c : best));
}
