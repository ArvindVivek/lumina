import { DashboardNav } from '@/components/layouts/dashboard-nav'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from './providers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Providers>
      <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-background/95">
        <DashboardNav />
        <main className="flex-1">
          <div className="container max-w-7xl py-8 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
        <Toaster />
      </div>
    </Providers>
  )
}
