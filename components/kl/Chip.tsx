// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Chip.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Selectable pill (KLChip). 36px to look at, 44px to tap: an invisible ::after stretches the
 * hit area. Selected chips use the accent tint and announce themselves with aria-pressed.
 * Without onClick it renders as a plain, non-interactive tag.
 */
export function Chip({
  children,
  icon,
  selected = false,
  onClick,
  className,
  ...rest
}: {
  children: ReactNode;
  icon?: LucideIcon;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
} & Omit<ComponentProps<"button">, "onClick" | "children" | "className">) {
  const look = cn(
    "relative inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold leading-none",
    selected ? "bg-accent-soft text-accent-text ring-1 ring-inset ring-accent/60" : "bg-surface-2 text-ink",
    className,
  );
  const content = (
    <>
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </>
  );

  if (!onClick) return <span className={look}>{content}</span>;
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        look,
        "cursor-pointer transition-[background-color,transform] duration-75 active:scale-[0.97]",
        "after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']",
      )}
    >
      {content}
    </button>
  );
}

export type BadgeTone = "accent" | "success" | "warning" | "danger" | "neutral";

const BADGE_TONES: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  neutral: "bg-surface-2 text-ink-2",
};

/** Small status label ("New", "Beta", "Offline"). Each text colour passes 4.5:1 on its tint. */
export function Badge({ children, tone = "accent", className }: { children: ReactNode; tone?: BadgeTone; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-extrabold uppercase leading-none tracking-[0.06em]",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
