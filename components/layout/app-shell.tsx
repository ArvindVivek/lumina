"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"
import {
  Crosshair,
  FlaskConical,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Sparkles,
  Target,
  Trophy,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { Icon, ThemeToggle } from "@/components/kl"
import { cn } from "@/lib/kl/cn"
import { SiteFooter } from "./site-footer"
import { ChatPanel } from "./chat-panel"

const NAV: { title: string; items: { label: string; href: string; icon: LucideIcon }[] }[] = [
  {
    title: "Browse",
    items: [
      { label: "Home", href: "/", icon: LayoutDashboard },
      { label: "Tournaments", href: "/tournaments", icon: Trophy },
      { label: "Teams", href: "/teams", icon: Users },
      { label: "Players", href: "/players", icon: UserRound },
    ],
  },
  {
    title: "Analyze",
    items: [
      { label: "Match report", href: "/analytics", icon: Sparkles },
      { label: "Player insights", href: "/player-analytics", icon: Crosshair },
      { label: "Team review", href: "/macro-review", icon: Target },
      { label: "Scenario lab", href: "/scenario-analysis", icon: FlaskConical },
    ],
  },
]

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  const detail: Record<string, string[]> = { "/tournaments": ["/tournaments", "/series", "/game"] }
  return (detail[href] ?? [href]).some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function Brand() {
  return (
    <Link href="/" className="-ml-1 flex min-h-11 items-center gap-2.5 rounded-sm px-1">
      {/* eslint-disable-next-line @next/next/no-img-element -- a 32px SVG needs no optimizer */}
      <img src="/icon.svg" alt="" width={32} height={32} className="rounded-[9px]" />
      <span className="font-display text-title3 font-semibold text-ink">Lumina</span>
    </Link>
  )
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-6">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs font-extrabold uppercase tracking-[0.08em] text-ink-2">{group.title}</p>
          <ul className="mt-2 space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-sm px-3 text-[15px] font-bold transition-colors duration-75",
                      active ? "bg-accent-soft text-accent-text" : "text-ink hover:bg-surface-2",
                    )}
                  >
                    <Icon icon={item.icon} size={20} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/**
 * The app frame: a sidebar on wide screens and a top bar with a menu on phones, the page, the
 * studio footer, and the "Ask the coach" chat that opens from any page.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // The phone menu remembers which page it was opened on, so following a link closes it.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn === pathname
  const setMenuOpen = (open: boolean) => setMenuOpenOn(open ? pathname : null)
  const [chatOpen, setChatOpen] = useState(false)

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-4 focus:py-3 focus:font-bold focus:text-ink focus:shadow-[var(--shadow-lift)]"
      >
        Skip to content
      </a>

      {/* Wide screens: fixed sidebar. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="flex items-center justify-between">
          <Brand />
          <ThemeToggle />
        </div>
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <NavList pathname={pathname} />
        </div>
        <p className="mt-4 rounded-sm bg-surface-2 px-3 py-2.5 text-[13px] leading-snug text-ink-2">
          Sample data: 32 VCT Americas playoff series, 2024–2025.
        </p>
      </aside>

      {/* Phones and tablets: top bar with a menu. */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <div className="flex h-16 items-center justify-between gap-2 px-4">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="phone-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid size-11 place-items-center rounded-full bg-surface text-ink shadow-[var(--shadow-card)]"
            >
              <Icon icon={menuOpen ? X : Menu} size={20} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="phone-menu" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line px-4 pb-6 pt-4">
            <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
          </div>
        )}
      </header>

      <div className="flex min-h-dvh flex-col lg:min-h-dvh">
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-28 pt-6 sm:px-8 lg:pt-10">
          {children}
        </main>
        <SiteFooter />
      </div>

      {!chatOpen && (
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-accent-strong px-5 font-display text-lg font-semibold text-on-accent shadow-[0_4px_0_var(--accent-deep),var(--shadow-lift)] transition-transform duration-75 active:translate-y-[2px] active:shadow-[0_2px_0_var(--accent-deep)]"
        >
          <Icon icon={MessageCircle} size={22} />
          Ask the coach
        </button>
      )}
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  )
}
