import { AppShell } from '@/components/layout/app-shell'
import { ScreenDataProvider } from '@/lib/context/screen-data-context'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ScreenDataProvider>
      <AppShell>
        {children}
      </AppShell>
    </ScreenDataProvider>
  )
}
