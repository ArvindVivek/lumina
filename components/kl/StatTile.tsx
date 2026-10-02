// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/StatTile.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Big number + caption (KLStatTile). The number is Fredoka with tabular digits so it doesn't
 * jitter as it changes. Show the real result ("$12 left", "3 stops"), never a bare code.
 */
export function StatTile({
  value,
  label,
  icon,
  detail,
  className,
}: {
  value: ReactNode;
  label: string;
  icon?: LucideIcon;
  /** Optional one-line context under the label ("up 2 from last week"). */
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5 rounded-lg bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5", className)}>
      {icon && <Icon icon={icon} size={20} className="text-accent-text" />}
      <div className="tabular truncate font-display text-number font-semibold text-ink">{value}</div>
      <div className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-2">{label}</div>
      {detail && <div className="text-sm text-ink-2">{detail}</div>}
    </div>
  );
}
