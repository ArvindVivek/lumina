// Measures every text/background pair the app uses, straight from the CSS files that ship, so
// a token change that breaks 4.5:1 fails the gate instead of shipping (copied from the KL Web
// starter; Lumina's own pairs are added below the kit's).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/kl/contrast";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string) => readFileSync(`${root}${path}`, "utf8");

/** `--name: #hex;` declarations inside the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)) vars[m[1]] = m[2];
  return vars;
}

const tokens = read("styles/kl-tokens.css");
const theme = read("styles/theme.css");
const app = read("app/globals.css");
const light = { ...block(tokens, ":root"), ...block(theme, ":root"), ...block(app, ":root") };
const dark = { ...light, ...block(tokens, '[data-theme="dark"]'), ...block(theme, '[data-theme="dark"]'), ...block(app, '[data-theme="dark"]') };

const TEXT_PAIRS: [string, string][] = [
  ["ink", "bg"], ["ink", "surface"], ["ink", "surface-2"],
  ["ink-2", "bg"], ["ink-2", "surface"], ["ink-2", "surface-2"], // secondary text, disabled buttons
  ["accent-text", "bg"], ["accent-text", "surface"], ["accent-text", "accent-soft"],
  ["on-accent", "accent-strong"], // primary button label
  ["ink", "button-secondary"], // secondary button label
  ["success-text", "bg"], ["success-text", "surface"], ["success-text", "success-soft"],
  ["warning-text", "bg"], ["warning-text", "surface"], ["warning-text", "warning-soft"],
  ["danger-text", "bg"], ["danger-text", "surface"], ["danger-text", "danger-soft"],
  // Lumina: coach notes and your own chat messages sit on accent-soft; side labels on their tints;
  // table rows and stat boxes sit on surface-2; the round strip puts bg-coloured digits on ink.
  ["ink", "accent-soft"], ["ink-2", "accent-soft"],
  ["attack-text", "attack-soft"], ["attack-text", "surface"],
  ["defense-text", "defense-soft"], ["defense-text", "surface"],
  ["accent-text", "surface-2"], ["success-text", "surface-2"], ["danger-text", "surface-2"],
  ["bg", "ink"], ["on-accent", "accent-strong"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s tokens", (_name, t) => {
  it.each(TEXT_PAIRS)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(t[fg], `--${fg} missing`).toBeDefined();
    expect(t[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it("danger button label (white) reaches 4.5:1 on its face", () => {
    expect(contrast("#FFFFFF", t["danger-strong"])).toBeGreaterThanOrEqual(4.5);
  });

  it("focus ring (accent-text) reaches 3:1 on bg and surface", () => {
    expect(contrast(t["accent-text"], t.bg)).toBeGreaterThanOrEqual(3);
    expect(contrast(t["accent-text"], t.surface)).toBeGreaterThanOrEqual(3);
  });
});

describe("OnArtPill", () => {
  it("keeps white text at 4.5:1 even over pure white art", () => {
    const blended = Math.round(255 * (1 - 0.55)); // 55% black over white
    const hex = `#${blended.toString(16).padStart(2, "0").repeat(3)}`;
    expect(contrast("#FFFFFF", hex)).toBeGreaterThanOrEqual(4.5);
  });
});
