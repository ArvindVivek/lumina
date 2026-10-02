// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/components/Field.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
"use client";

import { createContext, useContext, useId, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * Form fields. <Field> owns the label, hint and error and wires them to the control inside it
 * (id, aria-describedby, aria-invalid), so every input is labelled without extra work:
 *
 *   <Field label="Email" hint="We only use it to sign you in." error={errors.email}>
 *     <Input type="email" name="email" autoComplete="email" />
 *   </Field>
 */

type FieldContext = { id: string; describedBy?: string; invalid: boolean };
const Ctx = createContext<FieldContext | null>(null);

export function Field({
  label,
  hint,
  error,
  optional = false,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  /** Plain-English problem with this field. Shown in red text with an icon, not colour alone. */
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <Ctx.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-[15px] font-bold text-ink">
          {label}
          {optional && <span className="font-normal text-ink-2"> (optional)</span>}
        </label>
        {children}
        {hint && (
          <p id={hintId} className="text-sm text-ink-2">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="flex items-center gap-1.5 text-sm font-bold text-danger-text">
            <Icon icon={CircleAlert} size={16} />
            {error}
          </p>
        )}
      </div>
    </Ctx.Provider>
  );
}

const CONTROL =
  "w-full min-h-12 rounded-sm bg-surface-2 px-4 text-base text-ink ring-1 ring-inset ring-line " +
  "placeholder:text-ink-2 transition-shadow duration-75 " +
  "focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent-text " +
  "aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger-text " +
  "disabled:cursor-not-allowed disabled:opacity-100 disabled:text-ink-2";

function useFieldProps(id?: string, describedBy?: string, invalid?: boolean) {
  const field = useContext(Ctx);
  return {
    id: id ?? field?.id,
    "aria-describedby": [field?.describedBy, describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": invalid ?? field?.invalid ?? undefined,
  };
}

/** Text input, 48px tall, 16px text (so iOS Safari doesn't zoom on focus). */
export function Input({ className, id, "aria-describedby": describedBy, "aria-invalid": invalid, ...rest }: ComponentProps<"input">) {
  const wired = useFieldProps(id, describedBy, invalid === undefined ? undefined : Boolean(invalid));
  return <input {...rest} {...wired} className={cn(CONTROL, className)} />;
}

/** Multi-line input. */
export function Textarea({ className, id, "aria-describedby": describedBy, "aria-invalid": invalid, ...rest }: ComponentProps<"textarea">) {
  const wired = useFieldProps(id, describedBy, invalid === undefined ? undefined : Boolean(invalid));
  return <textarea {...rest} {...wired} className={cn(CONTROL, "min-h-28 py-3 leading-normal", className)} />;
}

/** Native select (the platform picker is the most accessible one on phones), with our chevron. */
export function Select({ className, id, "aria-describedby": describedBy, "aria-invalid": invalid, children, ...rest }: ComponentProps<"select">) {
  const wired = useFieldProps(id, describedBy, invalid === undefined ? undefined : Boolean(invalid));
  return (
    <div className="relative">
      <select {...rest} {...wired} className={cn(CONTROL, "cursor-pointer appearance-none pr-11", className)}>
        {children}
      </select>
      <Icon icon={ChevronDown} size={20} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
    </div>
  );
}
