// KL Web 1.0.2, from kitchenlabs-kit/web/kl-web/components/Button.tsx. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/kl/cn";
import { Icon } from "./Icon";

/**
 * The studio's signature: a face that sits on a 4px darker edge and presses 2px into it, in
 * 75 ms (overdraft/components/ui/Button.tsx with the colours moved to the accent tokens). Every
 * size clears 44px. Pass `href` to render a link that looks the same.
 *
 * No "use client" on purpose: server pages pass lucide icons (`icon={Plus}`), and a component
 * can't cross into a client component as a prop.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "lg" | "md" | "sm";

/** Face colour, label colour, and the deeper edge it presses into. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-strong text-on-accent shadow-[0_4px_0_var(--accent-deep)] active:shadow-[0_2px_0_var(--accent-deep)]",
  // A hairline too, or a white face vanishes on a white card.
  secondary:
    "bg-[var(--button-secondary)] text-ink ring-1 ring-inset ring-line shadow-[0_4px_0_var(--button-secondary-edge)] active:shadow-[0_2px_0_var(--button-secondary-edge)]",
  danger:
    "bg-danger-strong text-white shadow-[0_4px_0_var(--danger-deep)] active:shadow-[0_2px_0_var(--danger-deep)]",
  // No edge: a text action that still gets a 44px target and a tint you can see on press.
  ghost: "bg-transparent text-accent-text hover:bg-accent-soft active:bg-accent-soft",
};

const SIZES: Record<ButtonSize, string> = {
  lg: "h-14 px-6 text-lg gap-2.5", // 56
  md: "h-12 px-5 text-base gap-2", // 48
  sm: "h-11 px-4 text-[15px] gap-1.5", // 44
};

const ICON_SIZE: Record<ButtonSize, number> = { lg: 22, md: 20, sm: 18 };

export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
}): string {
  return cn(
    "relative inline-flex min-h-11 select-none items-center justify-center whitespace-nowrap rounded-md font-display font-semibold leading-none",
    "transition-[box-shadow,transform,background-color] duration-75 ease-out",
    SIZES[size],
    fullWidth && "w-full",
    // Disabled reads as flat and grey: no edge to press, no colour promise. Never fade the whole
    // button (a 45% fade left labels near 1.4:1 in Undertone); ink-2 on surface-2 stays at 4.5:1+.
    disabled
      ? "cursor-not-allowed bg-surface-2 text-ink-2 shadow-none ring-0"
      : cn(VARIANTS[variant], variant !== "ghost" && "active:translate-y-[2px]", "cursor-pointer"),
    className,
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading icon. */
  icon?: LucideIcon;
  /** Trailing icon (arrows, chevrons). */
  iconRight?: LucideIcon;
  /** Shows a spinner, keeps the label, and ignores presses. */
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
  children?: ReactNode;
};

type AsButton = Common & Omit<ComponentProps<"button">, keyof Common> & { href?: undefined };
type AsLink = Common & Omit<ComponentProps<typeof Link>, keyof Common> & { href: string };
export type ButtonProps = AsButton | AsLink;

function isLink(props: ButtonProps): props is AsLink {
  return props.href !== undefined;
}

/** Separates the Button-only props from the ones passed through to <button> or <Link>. */
function split<P extends Common>(props: P) {
  const { variant = "primary", size = "md", icon, iconRight, loading = false, fullWidth, className, children, ...rest } = props;
  return { own: { variant, size, icon, iconRight, loading, fullWidth, className, children }, rest };
}

function Inner({ own }: { own: ReturnType<typeof split>["own"] }) {
  const { size, icon, iconRight, loading, children } = own;
  return (
    <>
      {loading ? (
        <Icon icon={LoaderCircle} size={ICON_SIZE[size]} className="animate-spin" />
      ) : (
        icon && <Icon icon={icon} size={ICON_SIZE[size]} />
      )}
      {children}
      {iconRight && !loading && <Icon icon={iconRight} size={ICON_SIZE[size]} />}
    </>
  );
}

export function Button(props: ButtonProps) {
  if (isLink(props)) {
    const { own, rest } = split(props);
    return (
      <Link {...rest} aria-busy={own.loading || undefined} className={buttonClasses(own)}>
        <Inner own={own} />
      </Link>
    );
  }

  const { own, rest } = split(props);
  const { disabled, type = "button", onClick, ...buttonRest } = rest;
  return (
    <button
      {...buttonRest}
      // A loading button keeps its look and focus but ignores presses: no click handler, and a
      // submit button stops submitting until it is done.
      type={own.loading && type === "submit" ? "button" : type}
      onClick={own.loading ? undefined : onClick}
      disabled={disabled}
      aria-disabled={own.loading || undefined}
      aria-busy={own.loading || undefined}
      className={buttonClasses({ ...own, disabled })}
    >
      <Inner own={own} />
    </button>
  );
}
