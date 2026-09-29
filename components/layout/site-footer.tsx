import Link from "next/link"
import { privacyUrl, supportUrl } from "@/components/kl"
import { RIOT_DISCLAIMER, site } from "@/lib/site"

/** "Made by Kitchen Labs", the privacy and support links, and Riot's required fan-project notice. */
export function SiteFooter() {
  const link = "inline-flex min-h-11 items-center px-3 font-bold text-ink-2 underline-offset-4 hover:text-ink hover:underline"
  return (
    <footer className="pb-[max(6rem,calc(env(safe-area-inset-bottom)+5rem))]">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col items-center gap-1 border-t border-line pt-5 text-sm text-ink-2 sm:flex-row sm:justify-between">
          <p>
            Made by <span className="font-bold text-ink">Kitchen Labs</span>
          </p>
          <nav aria-label="About this app" className="flex flex-wrap items-center justify-center">
            <Link href="/debug" className={link}>About the data</Link>
            <a href={privacyUrl(site.slug)} className={link}>Privacy</a>
            <a href={supportUrl(site.slug)} className={link}>Support</a>
          </nav>
        </div>
        <p className="mt-3 text-center text-[13px] leading-relaxed text-ink-2 sm:text-left">
          {RIOT_DISCLAIMER} VALORANT is a trademark of Riot Games, Inc. Match data comes from GRID&apos;s
          esports feed. Lumina is a free, non-commercial project and is not affiliated with any team shown.
        </p>
      </div>
    </footer>
  )
}
