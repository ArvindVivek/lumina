"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { ArrowUp, Info, MessageCircle, X } from "lucide-react"
import { Icon } from "@/components/kl"
import { cn } from "@/lib/kl/cn"

interface Stat {
  label: string
  value: string
}

interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  stats?: Stat[]
  source?: "ai" | "fallback"
  followUp?: string | null
}

const STARTERS = ["What stands out on this page?", "Who wins the most opening duels?", "How does Cloud9 play pistol rounds?"]

/** Which match, team or player the reader is looking at, from the URL. */
function pageFromUrl(pathname: string) {
  const search = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const seg = pathname.split("/").filter(Boolean)
  const page: Record<string, string | undefined> = { page: seg[0] ?? "dashboard" }
  if (seg[0] === "series") page.seriesId = seg[1]
  if (seg[0] === "game") page.gameId = seg[1]
  if (seg[0] === "tournaments") page.tournamentId = seg[1]
  if (seg[0] === "player-analytics") page.playerId = search.get("player") ?? undefined
  if (seg[0] === "macro-review") page.teamId = search.get("team") ?? undefined
  if (seg[0] === "analytics") {
    page.seriesId = search.get("series") ?? undefined
    page.teamId = search.get("team") ?? undefined
  }
  return page
}

/**
 * The AI coach. Each question goes to /api/chat with the page being viewed; the server adds the
 * numbers. When the AI can't answer (no credits, busy), the reply is the numbers themselves.
 */
export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const nextId = useRef(1)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, busy])

  async function send(text: string) {
    const question = text.trim()
    if (!question || busy) return
    const history = [...messages, { id: nextId.current++, role: "user" as const, content: question }]
    setMessages(history)
    setInput("")
    setBusy(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.slice(-9).map((m) => ({ role: m.role, content: m.content })),
          page: pageFromUrl(pathname),
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.answer) {
        const message = body?.error?.message ?? "The coach couldn't answer that. Please try again in a minute."
        setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: message }])
      } else {
        setMessages((m) => [
          ...m,
          { id: nextId.current++, role: "assistant", content: body.answer, stats: body.stats, source: body.source, followUp: body.follow_up },
        ])
      }
    } catch (err) {
      console.error("[chat] request failed", err)
      setMessages((m) => [...m, { id: nextId.current++, role: "assistant", content: "We couldn't reach the coach. Check your connection and try again." }])
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void send(input)
  }

  if (!open) return null

  return (
    <section
      aria-label="Ask the coach"
      className="fixed inset-0 z-50 flex flex-col bg-bg sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] sm:border-l sm:border-line sm:shadow-[var(--shadow-lift)]"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent-text">
            <Icon icon={MessageCircle} size={18} />
          </span>
          <div>
            <h2 className="text-title3 text-ink">Ask the coach</h2>
            <p className="text-[13px] text-ink-2">Answers use the match data on this page.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the coach"
          className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink"
        >
          <Icon icon={X} size={20} />
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-[15px] text-ink-2">
              Ask about the match, team or player you&apos;re looking at, or name anyone in the sample. Each answer quotes the numbers it uses.
            </p>
            <div className="flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="min-h-11 rounded-md bg-surface px-4 py-2.5 text-left text-[15px] font-bold text-ink shadow-[var(--shadow-card)] hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-10 rounded-md rounded-br-xs bg-accent-soft px-4 py-3 text-[15px] text-ink">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className="mr-6 space-y-3 rounded-md rounded-bl-xs bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
              {m.source === "fallback" && (
                <p className="flex items-center gap-1.5 text-[13px] font-bold text-warning-text">
                  <Icon icon={Info} size={15} />
                  AI unavailable: showing the numbers
                </p>
              )}
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{m.content}</p>
              {m.stats && m.stats.length > 0 && (
                <dl className="grid grid-cols-2 gap-2">
                  {m.stats.map((s) => (
                    <div key={s.label} className="rounded-sm bg-surface-2 px-3 py-2">
                      <dt className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-ink-2">{s.label}</dt>
                      <dd className="tabular font-display text-title3 text-ink">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {m.followUp && (
                <button
                  type="button"
                  onClick={() => void send(m.followUp!)}
                  className="min-h-11 rounded-sm px-2 text-left text-[15px] font-bold text-accent-text hover:bg-accent-soft"
                >
                  {m.followUp}
                </button>
              )}
            </div>
          ),
        )}
        {busy && <p className="text-[15px] text-ink-2">The coach is reading the numbers…</p>}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <label htmlFor="coach-question" className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="coach-question"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send(input)
              }
            }}
            rows={1}
            maxLength={500}
            placeholder="Ask about a player, team or match"
            className="min-h-12 flex-1 resize-none rounded-sm bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-ink-2"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send question"
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-full",
              busy || !input.trim() ? "bg-surface-2 text-ink-2" : "bg-accent-strong text-on-accent",
            )}
          >
            <Icon icon={ArrowUp} size={22} />
          </button>
        </div>
      </form>
    </section>
  )
}
