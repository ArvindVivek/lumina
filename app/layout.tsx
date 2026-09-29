import type { Metadata, Viewport } from "next"
import "./globals.css"
import { KLProviders } from "@/components/kl"
import { fontVariables } from "@/lib/kl/fonts"
import { site } from "@/lib/site"

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} · VALORANT match analytics`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: "website", siteName: site.name, locale: "en_US", url: site.url },
  twitter: { card: "summary_large_image" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: site.themeColor.light },
    { media: "(prefers-color-scheme: dark)", color: site.themeColor.dark },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <body className="min-h-dvh">
        <KLProviders>{children}</KLProviders>
      </body>
    </html>
  )
}
