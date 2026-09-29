// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/ErrorState.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import { useEffect } from "react";
import { CloudOff, RotateCcw } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

/**
 * Something failed. People see a friendly sentence and a way forward; the real error goes to
 * the console only (docs/standards/quality-bar.md, "Graceful failure"). Pass the caught error
 * as `error` so it is logged; it is never rendered.
 */
export function ErrorState({
  error,
  title = "That didn't load",
  message = "It's not you. Check your connection and try again.",
  onRetry,
  retryLabel = "Try again",
  className,
}: {
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  useEffect(() => {
    if (error !== undefined) console.error("[ErrorState]", error);
  }, [error]);

  return (
    <div role="alert">
      <EmptyState
        icon={CloudOff}
        tone="danger"
        title={title}
        message={message}
        className={className}
        action={
          onRetry && (
            <Button variant="secondary" icon={RotateCcw} onClick={onRetry}>
              {retryLabel}
            </Button>
          )
        }
      />
    </div>
  );
}
