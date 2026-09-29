// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/OnArtPill.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ReactNode } from "react";
import { cn } from "@/lib/kl/cn";

/**
 * Text on top of photos, gradients or art (KLOnArtPill). Worst case, over pure white art, the
 * 55% black backing blends to #737373 and white text still measures 4.7:1. Don't rely on a
 * text shadow instead.
 */
export function OnArtPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-sm font-bold leading-none text-white backdrop-blur-md",
        className,
      )}
    >
      {children}
    </span>
  );
}
