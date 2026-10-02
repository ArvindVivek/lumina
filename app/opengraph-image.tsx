import { ImageResponse } from "next/og";
import { COPYRIGHT } from "@/components/kl/PageShell";
import { site } from "@/lib/site";

// The link-preview card (docs/web/seo-and-icons.md, step 4). Satori renders it: flexbox only,
// every box declares display:flex, inline styles only, colours inlined from lib/site.ts.
export const alt = `${site.name}: ${site.description}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Card({ title, sentence }: { title: string; sentence: string }) {
  const c = site.card;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: 88,
        background: c.bg,
      }}
    >
      <div style={{ display: "flex", width: 120, height: 14, borderRadius: 7, background: c.accent, marginBottom: 44 }} />
      <div style={{ display: "flex", fontSize: 92, fontWeight: 700, color: c.ink, letterSpacing: -1 }}>{title}</div>
      <div style={{ display: "flex", fontSize: 40, color: c.ink2, marginTop: 20, maxWidth: 980, lineHeight: 1.3 }}>
        {sentence}
      </div>
      <div style={{ display: "flex", fontSize: 28, color: c.ink2, marginTop: "auto" }}>{COPYRIGHT}</div>
    </div>
  );
}

export default function OpengraphImage() {
  // A share image must never throw: a preview that 500s is a link nobody clicks. Keep anything
  // that can fail (data fetches, font loads) inside this try.
  try {
    return new ImageResponse(<Card title={site.name} sentence={site.description} />, size);
  } catch (err) {
    console.error("[og] falling back to the plain card", err);
    return new ImageResponse(<Card title="Kitchen Labs" sentence="" />, size);
  }
}
