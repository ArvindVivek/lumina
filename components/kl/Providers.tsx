// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/Providers.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import type { ComponentProps, ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "./Theme";
import { ToastProvider } from "./Toast";

/** Every motion animation follows the person's Reduce Motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/**
 * Everything the kit needs, in one wrapper for app/layout.tsx:
 * theme (data-theme, no flash) → reduced motion → toasts.
 */
export function KLProviders({
  children,
  forcedTheme,
  defaultTheme,
  toastOffset,
}: {
  children: ReactNode;
  /** "light" or "dark" for an app that has only one look (Overdraft, Cosmiq). */
  forcedTheme?: ComponentProps<typeof ThemeProvider>["forcedTheme"];
  /** First-visit theme when the app prefers one ("dark" for a canvas tool); still switchable. Default "system". */
  defaultTheme?: "light" | "dark" | "system";
  /** Lift toasts above a pinned bottom bar, e.g. "5rem" (Flux's transport). */
  toastOffset?: string;
}) {
  return (
    <ThemeProvider forcedTheme={forcedTheme} {...(defaultTheme ? { defaultTheme } : {})}>
      <MotionProvider>
        <ToastProvider bottomOffset={toastOffset}>{children}</ToastProvider>
      </MotionProvider>
    </ThemeProvider>
  );
}
