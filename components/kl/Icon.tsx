// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Icon.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/kl/cn";

/**
 * Every icon goes through here, so the set stays auditable (model:
 * chiquitos-ukiyo/components/ui/GameIcon.tsx). lucide-react only; no emoji anywhere in the UI.
 * Decorative by default: keep a visible word next to it, or pass `label` when it stands alone.
 */
export function Icon({
  icon: Glyph,
  size = 20,
  strokeWidth = 2.25,
  label,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
  /** Spoken name when the icon carries meaning on its own. */
  label?: string;
  className?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={strokeWidth}
      className={cn("shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}
