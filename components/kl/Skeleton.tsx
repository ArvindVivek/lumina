// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Skeleton.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import { cn } from "@/lib/kl/cn";

/**
 * Placeholder shapes while content loads (KLStates `.klSkeleton`). Hidden from screen
 * readers; put `aria-busy` on the region that is loading. The pulse stops under Reduce Motion
 * (the global rule in kl-tokens.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xs bg-[var(--skeleton)]", className)} />;
}

/** A few lines of text, the last one shorter, like a real paragraph. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </div>
  );
}
