/*
 * Number and date formatting shared by server and client components. Dates are formatted in UTC
 * on purpose: a date rendered in the server's zone and again in the reader's would not match,
 * and React would throw a hydration error (#418).
 */

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return ""
  const a = new Date(start)
  const b = end ? new Date(end) : a
  const month = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
    return `${month(a)} ${a.getUTCDate()}–${b.getUTCDate()}, ${a.getUTCFullYear()}`
  }
  return `${shortDate(start)} – ${shortDate(end)}`
}

/** "best-of-3" → "Best of 3". */
export function formatLabel(format: string | null | undefined): string {
  if (!format) return "Series"
  const m = format.match(/best-of-(\d+)/)
  return m ? `Best of ${m[1]}` : format
}

/** Credits as players say them: 3900 → "3.9k". */
export function credits(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

export function seconds(ms: number | null | undefined): string {
  if (ms == null) return "–"
  return `${Math.round(ms / 1000)}s`
}
