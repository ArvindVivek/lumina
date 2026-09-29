"use client";

import Link from "next/link";
import { useEffect } from "react";

// Something broke. People see a friendly line and a way out; the real error only goes to the
// console. Built from plain elements (not kit components) so it still renders if the thing that
// broke was a shared component (model: overdraft/app/error.tsx).
// `retry` is the Next 16.3+ name (16.2 called it `unstable_retry`); check
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md.
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <div className="w-full rounded-lg bg-surface px-5 py-6 shadow-[var(--shadow-card)]">
        <h1 className="text-title2 text-ink">Something went wrong on our side</h1>
        <p className="mt-2 text-[15px] text-ink-2">
          Nothing you did caused this. Try again, and if it keeps happening, come back in a few minutes.
        </p>
      </div>
      <button
        type="button"
        onClick={() => retry()}
        className="flex min-h-14 w-full cursor-pointer items-center justify-center rounded-md bg-accent-strong px-5 font-display text-lg font-semibold text-on-accent shadow-[0_4px_0_var(--accent-deep)] active:translate-y-[2px] active:shadow-[0_2px_0_var(--accent-deep)]"
      >
        Try again
      </button>
      <Link href="/" className="flex min-h-12 w-full items-center justify-center rounded-md bg-surface px-5 font-bold text-ink ring-1 ring-line">
        Go to the start
      </Link>
    </main>
  );
}
