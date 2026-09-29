// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Theme.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Light and dark through next-themes: it resolves "system", writes data-theme on <html> from an
 * inline script before first paint (no flash), and remembers the choice. Needs
 * `suppressHydrationWarning` on <html>. An always-light or always-dark app passes
 * `forcedTheme="light"` / `"dark"` instead of shipping half a theme.
 */
export function ThemeProvider({ children, ...rest }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="data-theme" defaultTheme="system" enableSystem disableTransitionOnChange {...rest}>
      {children}
    </NextThemesProvider>
  );
}

const subscribeNever = () => () => {};

/** False during SSR and hydration, true after: the theme is only known in the browser. */
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

/**
 * One tap switches between light and dark (starting from whatever "system" resolved to).
 * The label says what the tap will do. Renders an inert placeholder of the same size until
 * mounted, so the server HTML and first client render match.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";
  const base = cn(
    "grid size-11 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)]",
    className,
  );

  if (!mounted) return <span aria-hidden="true" className={base} />;
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
      className={cn(base, "cursor-pointer transition-transform duration-75 active:scale-95")}
    >
      <Icon icon={isDark ? Sun : Moon} size={20} />
    </button>
  );
}
