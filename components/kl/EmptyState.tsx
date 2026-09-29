// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/EmptyState.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Nothing here yet (KLEmptyState): an icon in a soft tint, one plain title, one sentence that
 * says what to do, and the action that does it. Never a blank area.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  tone = "accent",
  className,
}: {
  icon: LucideIcon;
  title: string;
  message?: ReactNode;
  /** Usually a <Button>. */
  action?: ReactNode;
  tone?: "accent" | "danger" | "neutral";
  className?: string;
}) {
  const badge = {
    accent: "bg-accent-soft text-accent-text",
    danger: "bg-danger-soft text-danger-text",
    neutral: "bg-surface-2 text-ink-2",
  }[tone];
  return (
    <div className={cn("flex flex-col items-center px-6 py-8 text-center", className)}>
      <div className={cn("grid size-16 place-items-center rounded-full", badge)}>
        <Icon icon={icon} size={30} />
      </div>
      <h3 className="mt-4 text-title2 text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-[15px] text-ink-2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
