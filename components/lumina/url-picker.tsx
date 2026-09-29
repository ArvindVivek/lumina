"use client"

import { useRouter } from "next/navigation"
import { Field, Select } from "@/components/kl"
import { cn } from "@/lib/kl/cn"

/**
 * A labelled select that navigates when it changes (the page reads the choice from the URL, so
 * every view can be linked and shared).
 */
export function UrlPicker({ label, param, value, options, basePath, keep = {}, placeholder, className }: {
  label: string
  param: string
  value?: string
  options: { value: string; label: string }[]
  basePath: string
  /** Other query params to carry over. */
  keep?: Record<string, string | undefined>
  placeholder?: string
  className?: string
}) {
  const router = useRouter()
  return (
    <Field label={label} className={cn("w-full sm:w-72", className)}>
      <Select
        value={value ?? ""}
        onChange={(e) => {
          const params = new URLSearchParams()
          for (const [k, v] of Object.entries(keep)) if (v) params.set(k, v)
          if (e.target.value) params.set(param, e.target.value)
          const qs = params.toString()
          router.push(qs ? `${basePath}?${qs}` : basePath)
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </Field>
  )
}
