import Link from "next/link";

// A wrong link gets a themed page with a way home, never the default 404.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-5 text-center">
      <p className="font-display text-number font-semibold text-accent-text">404</p>
      <h1 className="text-title text-ink">We couldn&apos;t find that page</h1>
      <p className="text-ink-2">The link may be old, or the page has moved.</p>
      <Link
        href="/"
        className="flex min-h-12 items-center justify-center rounded-md bg-accent-strong px-6 font-display text-lg font-semibold text-on-accent shadow-[0_4px_0_var(--accent-deep)] active:translate-y-[2px] active:shadow-[0_2px_0_var(--accent-deep)]"
      >
        Go to the start
      </Link>
    </main>
  );
}
