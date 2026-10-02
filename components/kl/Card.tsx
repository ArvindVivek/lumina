// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/Card.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/kl/cn";

/**
 * The surface card: 20px corners and the one card shadow (a hairline in dark mode), like
 * KLCard on iOS. `tone="inset"` is a flat grey well for grouped rows inside a card;
 * `tone="accent"` is the soft accent tint for the one thing on screen that is "yours".
 */

const PADDING = { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" } as const;
const TONES = {
  surface: "bg-surface shadow-[var(--shadow-card)]",
  inset: "bg-surface-2",
  accent: "bg-accent-soft",
} as const;

type CardProps<T extends ElementType> = {
  as?: T;
  padding?: keyof typeof PADDING;
  tone?: keyof typeof TONES;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<T>, "as" | "className" | "children">;

export function Card<T extends ElementType = "div">({
  as,
  padding = "md",
  tone = "surface",
  className,
  children,
  ...rest
}: CardProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag {...rest} className={cn("rounded-lg", TONES[tone], PADDING[padding], className)}>
      {children}
    </Tag>
  );
}

/** Section title row with an optional trailing action (KLSectionHeader). */
export function SectionHeader({
  title,
  description,
  action,
  as: Heading = "h2",
  id,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: "h2" | "h3";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading id={id} className="text-title3 text-ink sm:text-title2">
          {title}
        </Heading>
        {description && <p className="mt-0.5 text-[15px] text-ink-2">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
