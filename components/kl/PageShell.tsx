// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/PageShell.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/kl/cn";
import { ThemeToggle } from "./Theme";

/** The studio site hosts each app's privacy and support pages (KLLinks on iOS). */
export const STUDIO_SITE = "https://kitchenlabs-one.vercel.app";
export const privacyUrl = (slug: string) => `${STUDIO_SITE}/apps/${slug}/privacy`;
export const supportUrl = (slug: string) => `${STUDIO_SITE}/apps/${slug}/support`;

const WIDTHS = { narrow: "max-w-2xl", wide: "max-w-5xl", full: "max-w-[75rem]" } as const;

/**
 * The frame every page sits in: a header with the app's icon and name (a link home), the
 * theme toggle and any actions; the page; and the studio footer ("Made by Kitchen Labs" with
 * privacy and support links, like KLAboutSection). Phone gutter 20px, as on iOS.
 */
export function PageShell({
  appName,
  appSlug,
  icon,
  actions,
  nav,
  homeHref = "/",
  footerNote,
  width = "narrow",
  showThemeToggle = true,
  children,
  className,
}: {
  appName: string;
  /** Brand key, used for the privacy and support links. */
  appSlug: string;
  /** Usually <img src="/icon.svg" alt="" width={32} height={32} />. */
  icon?: ReactNode;
  /** Extra header controls (sign in, settings). Keep each at 44px. */
  actions?: ReactNode;
  /** Section navigation under the header (tabs or links). Dashboards use it with width="full". */
  nav?: ReactNode;
  /** Where the logo links: "/" normally, "/demo" inside a demo. */
  homeHref?: string;
  /** A line above "Made by Kitchen Labs", e.g. a required legal notice (Riot's fan-project text). */
  footerNote?: ReactNode;
  /** narrow (reading), wide (tools), full (dashboards, 1200px). */
  width?: keyof typeof WIDTHS;
  showThemeToggle?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const frame = cn("mx-auto w-full px-5", WIDTHS[width]);
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-3 focus:font-bold focus:text-ink focus:shadow-[var(--shadow-lift)]"
      >
        Skip to content
      </a>
      <header className="pt-[env(safe-area-inset-top)]">
        <div className={cn(frame, "flex h-16 items-center justify-between gap-3")}>
          <Link href={homeHref} className="-ml-1 flex min-h-11 min-w-0 items-center gap-2.5 rounded-sm px-1">
            {icon && <span className="shrink-0 overflow-hidden rounded-[9px]">{icon}</span>}
            <span className="truncate font-display text-title3 font-semibold text-ink">{appName}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {showThemeToggle && <ThemeToggle />}
          </div>
        </div>
        {nav && <div className={cn(frame, "pb-2")}>{nav}</div>}
      </header>

      <main id="main" className={cn(frame, "flex-1 pb-12 pt-2", className)}>
        {children}
      </main>

      <footer className="pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {footerNote && <div className={cn(frame, "pb-3 text-center text-xs text-ink-2")}>{footerNote}</div>}
        <div className={cn(frame, "flex flex-col items-center gap-1 border-t border-line pt-5 text-sm text-ink-2 sm:flex-row sm:justify-between")}>
          <p>
            Made by <span className="font-bold text-ink">Kitchen Labs</span>
          </p>
          <nav aria-label="About this app" className="flex items-center">
            <a href={privacyUrl(appSlug)} className="inline-flex min-h-11 items-center px-3 font-bold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </a>
            <a href={supportUrl(appSlug)} className="inline-flex min-h-11 items-center px-3 font-bold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Support
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
