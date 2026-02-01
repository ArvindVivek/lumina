"use client"

import { LayoutDashboard, Trophy, Users, UserCircle, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: Sparkles,
  },
  {
    title: "Tournaments",
    href: "/tournaments",
    icon: Trophy,
  },
  {
    title: "Players",
    href: "/players",
    icon: UserCircle,
  },
  {
    title: "Teams",
    href: "/teams",
    icon: Users,
  },
]

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "sidebar transition-slow overflow-hidden flex flex-col",
        isCollapsed ? "w-[60px]" : "w-[200px]"
      )}
    >
      {/* Logo/Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-valorant-red flex items-center justify-center">
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <span className="font-semibold text-base text-text-primary uppercase tracking-wide">
              Lumina
            </span>
          </div>
        )}

        <button
          onClick={onToggle}
          className="p-2 hover:bg-surface-hover transition-fast rounded"
        >
          {isCollapsed ? (
            <ChevronRight className="h-5 w-5 text-text-tertiary" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-text-tertiary" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded transition-fast relative",
                    isActive
                      ? "bg-valorant-accent/10 text-valorant-accent"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )}
                  title={isCollapsed ? item.title : undefined}
                >
                  {/* Active Indicator */}
                  {isActive && (
                    <div className="absolute left-0 w-1 h-7 bg-valorant-accent rounded-r" />
                  )}

                  <Icon className={cn("h-5 w-5 shrink-0", isActive && "ml-1")} />

                  {!isCollapsed && (
                    <span className="font-medium text-sm uppercase tracking-wide">
                      {item.title}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

    </aside>
  )
}
