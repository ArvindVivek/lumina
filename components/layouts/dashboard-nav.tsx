'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: 'Overview' },
  { href: '/player-analytics', label: 'Player Analytics' },
  { href: '/macro-review', label: 'Macro Review' },
  { href: '/scenario-analysis', label: 'Scenario Analysis' },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2 group">
            <div className="relative">
              <span className="font-bold text-xl bg-gradient-to-r from-primary via-primary/90 to-accent bg-clip-text text-transparent uppercase tracking-wider transition-all group-hover:tracking-widest">
                Lumina
              </span>
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 blur-sm opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
            </div>
          </Link>
        </div>
        <nav className="flex items-center gap-6 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative py-2 px-3 rounded-md transition-all duration-200',
                pathname === item.href
                  ? 'text-foreground font-medium bg-primary/10 before:absolute before:bottom-0 before:left-0 before:right-0 before:h-0.5 before:bg-primary'
                  : 'text-foreground/60 hover:text-foreground hover:bg-muted/50'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
