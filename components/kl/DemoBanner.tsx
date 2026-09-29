// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/DemoBanner.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { DEMO_NOTICE, isDemo } from "@/lib/kl/demo";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * The "this is sample data" notice every page shows in demo mode (docs/web/demo-mode.md).
 * Renders nothing outside demo mode, so it can sit in the root layout permanently.
 * warning-text on warning-soft measures 5.1:1 (light) and 7.2:1 (dark).
 */
export function DemoBanner({
  className,
  force = false,
  notice = DEMO_NOTICE,
  action,
}: {
  className?: string;
  force?: boolean;
  /** The app's own sentence, e.g. "Demo — sample paper data. Nothing here is live." */
  notice?: string;
  /** An exit control, e.g. <a href="/demo/exit">Leave the demo</a> (keep it 44px tall). */
  action?: ReactNode;
}) {
  if (!isDemo && !force) return null;
  return (
    <div
      role="note"
      className={cn(
        "flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-center text-sm font-bold text-warning-text",
        className,
      )}
    >
      <Icon icon={FlaskConical} size={16} />
      {notice}
      {action}
    </div>
  );
}
