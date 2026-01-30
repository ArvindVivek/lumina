import { DashboardNav } from '@/components/layouts/dashboard-nav'
import { Toaster } from '@/components/ui/sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <DashboardNav />
      <main className="flex-1">
        <div className="container max-w-screen-2xl py-6">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  )
}
