"use client"

import { Eye, Pencil } from "lucide-react"
import type { PresenceEntry } from "./item-presence-context"

type Props = {
  entries: PresenceEntry[]
  variant?: "compact" | "full"
}

export function EditingBadge({ entries, variant = "compact" }: Props) {
  if (entries.length === 0) return null

  const names = entries.map((e) => e.display_name || "بدون اسم").join("، ")
  const anyTyping = entries.some((e) => e.typing)

  if (variant === "full") {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] tag-mono border animate-pulse"
        style={{
          color: "var(--gold)",
          borderColor: "color-mix(in oklch, var(--gold) 35%, transparent)",
          background: "color-mix(in oklch, var(--gold) 8%, transparent)",
        }}
      >
        {anyTyping ? <Pencil className="size-3" /> : <Eye className="size-3" />}
        <span>{anyTyping ? "بيكتب الآن" : "بيشاهد"} · {names}</span>
      </div>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] tag-mono border animate-pulse"
      style={{
        color: "var(--gold)",
        borderColor: "color-mix(in oklch, var(--gold) 35%, transparent)",
        background: "color-mix(in oklch, var(--gold) 8%, transparent)",
      }}
      title={`${anyTyping ? "بيكتب الآن: " : "بيشاهد: "}${names}`}
    >
      {anyTyping ? <Pencil className="size-2.5" /> : <Eye className="size-2.5" />}
      <span className="max-w-[120px] truncate">{names}</span>
    </span>
  )
}
