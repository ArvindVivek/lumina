// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/Toast.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, Info, X, type LucideIcon } from "lucide-react";
import { snappy } from "@/lib/kl/motion";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * A tiny toast system (KLToast): one short sentence at the bottom of the screen, read out by
 * screen readers, gone after a few seconds. Wrap the app in <ToastProvider> (KLProviders does)
 * and call `const toast = useToast(); toast.show("Saved.")`.
 */

export type ToastTone = "neutral" | "success" | "danger";
type Toast = { id: number; message: string; tone: ToastTone };

/** Long enough to read a short sentence twice; errors stay a little longer. */
const DURATION_MS = { neutral: 4000, success: 4000, danger: 6000 } as const;
/** More than this and the oldest goes, so toasts never cover the screen. */
const MAX_VISIBLE = 3;

const TONE: Record<ToastTone, { icon: LucideIcon; iconClass: string }> = {
  neutral: { icon: Info, iconClass: "text-accent-text" },
  success: { icon: CircleCheck, iconClass: "text-success-text" },
  danger: { icon: CircleAlert, iconClass: "text-danger-text" },
};

type ToastApi = { show: (message: string, options?: { tone?: ToastTone }) => void; dismiss: (id: number) => void };
const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useToast needs a <ToastProvider> (or <KLProviders>) above it.");
  return api;
}

export function ToastProvider({ children, bottomOffset }: { children: ReactNode; bottomOffset?: string }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, options) => {
      const tone = options?.tone ?? "neutral";
      const id = nextId.current++;
      setToasts((all) => [...all, { id, message, tone }].slice(-MAX_VISIBLE));
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION_MS[tone]));
    },
    [dismiss],
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach(clearTimeout);
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={bottomOffset ? { bottom: bottomOffset } : undefined}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={snappy}
              className={cn(
                "pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md bg-surface py-2 pl-4 pr-1.5",
                "shadow-[var(--shadow-lift)] ring-1 ring-line",
              )}
            >
              <Icon icon={TONE[t.tone].icon} size={20} className={TONE[t.tone].iconClass} />
              <p className="min-w-0 flex-1 py-1.5 text-[15px] font-bold text-ink">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <Icon icon={X} size={18} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
