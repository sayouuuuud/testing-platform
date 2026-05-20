"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import { ar } from "date-fns/locale"

type Props = {
  iso?: string | null
  className?: string
  prefix?: string
  /** Update interval in ms — default is every 30 s. */
  intervalMs?: number
}

/** Renders something like "منذ ٣ د" / "منذ ساعتين", refreshing every 30 s.
 *  Returns null when there's no valid timestamp. */
export function TimeAgo({ iso, className, prefix = "منذ", intervalMs = 30000 }: Props) {
  const [, force] = useState(0)

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => force((n) => n + 1), intervalMs)
    return () => clearInterval(id)
  }, [iso, intervalMs])

  if (!iso) return null
  let date: Date
  try {
    date = parseISO(iso)
    if (Number.isNaN(date.getTime())) return null
  } catch {
    return null
  }

  let text = ""
  try {
    text = formatDistanceToNow(date, { locale: ar, addSuffix: false })
  } catch {
    text = ""
  }

  if (!text) return null

  return (
    <span className={className} title={date.toLocaleString()}>
      {prefix} {text}
    </span>
  )
}
