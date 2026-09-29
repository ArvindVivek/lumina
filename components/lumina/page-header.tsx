import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Icon } from "@/components/kl"
import { cn } from "@/lib/kl/cn"

/** Page title block: optional back link, eyebrow, title, one-line description, and actions. */
export function PageHeader({ title, description, eyebrow, back, actions, className }: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  back?: { href: string; label: string }
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {back && (
        <Link href={back.href} className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 text-[15px] font-bold text-ink-2 hover:text-ink">
          <Icon icon={ArrowLeft} size={18} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-accent-text">{eyebrow}</p>}
          <h1 className="mt-1 text-large text-ink sm:text-hero">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[17px] text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
