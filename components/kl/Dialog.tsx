// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/Dialog.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Accessible modal built on the native <dialog>: showModal() gives focus trapping, Escape to
 * close, an inert page behind it and focus returned to the opener, all from the browser.
 * Tapping the dim backdrop closes it too. Controlled: keep `open` in state and set it false in
 * `onClose`. The sheet never grows past the screen: long content scrolls in the middle while the
 * title, close button and actions stay in view.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons at the bottom, primary last: stacked on phones it lands nearest the thumb. */
  actions?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape and form[method=dialog] close the element directly; tell the owner.
      // A nested Dialog's close event bubbles up the React tree; only react to our own.
      onClose={(e) => e.target === e.currentTarget && open && onClose()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // the backdrop, not the sheet
      }}
      className={cn(
        "kl-dialog m-auto w-[calc(100%-2rem)] max-w-md overflow-visible rounded-xl bg-transparent p-0 text-ink",
        className,
      )}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col rounded-xl bg-surface p-5 shadow-[var(--shadow-lift)] ring-1 ring-line sm:p-6">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <h2 id={titleId} className="pt-1.5 text-title2 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <Icon icon={X} size={22} />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="mt-1 shrink-0 text-[15px] text-ink-2">
            {description}
          </p>
        )}
        {children && <div className="-mx-1 mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">{children}</div>}
        {actions && <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row sm:justify-end">{actions}</div>}
      </div>
    </dialog>
  );
}
