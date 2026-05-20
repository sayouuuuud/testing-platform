"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { adminAssignTester } from "@/app/actions"
import { TimeAgo } from "@/components/time-ago"
import type { ItemStatus, Profile, TestItem } from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/status-config"

type Props = {
  items: TestItem[]
  profiles: Profile[]
}

export function UnassignedClient({ items: initialItems, profiles }: Props) {
  const [items, setItems] = useState<TestItem[]>(initialItems)
  const [picking, setPicking] = useState<Record<number, string>>({})
  const [pending, startTransition] = useTransition()
  const [activeId, setActiveId] = useState<number | null>(null)

  const handleAssign = (item: TestItem) => {
    const testerId = picking[item.id]
    if (!testerId) {
      toast.error("اختار تيستر الأول")
      return
    }
    setActiveId(item.id)
    startTransition(async () => {
      const res = await adminAssignTester(item.id, testerId)
      if (res.ok) {
        toast.success("اتعيّن")
        setItems((prev) => prev.filter((x) => x.id !== item.id))
      } else {
        toast.error(res.error || "فشل")
      }
      setActiveId(null)
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow mb-1" style={{ color: "var(--gold)" }}>
          Cleanup
        </div>
        <h1 className="font-display text-3xl lg:text-5xl text-foreground leading-tight">
          حالات بدون تيستر
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          الحالات اللي معمول عليها تيست لكن مفيش تيستر معلّم عليها — عيّن واحد ليها.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="card-paper p-12 text-center text-muted-foreground">
          مفيش حالات معلّقة — كل التيستات معروفة لمين.
        </div>
      ) : (
        <div className="card-paper divide-y divide-border/70">
          {items.map((item) => {
            const cfg = STATUS_CONFIG[item.status as ItemStatus]
            return (
              <div
                key={item.id}
                className="px-4 py-3 flex items-center gap-3 text-sm flex-wrap"
              >
                <span
                  className="font-mono text-[11px] font-semibold num-latin px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    color: "var(--gold)",
                    background: "color-mix(in oklch, var(--gold) 10%, transparent)",
                  }}
                >
                  {item.code}
                </span>
                <span className="flex-1 min-w-0 truncate">{item.description}</span>
                <span
                  className="status-chip text-[10px] shrink-0"
                  style={{
                    color: cfg.color,
                    background: cfg.softBg,
                    borderColor: "color-mix(in oklch, " + cfg.color + " 30%, transparent)",
                  }}
                >
                  {cfg.label}
                </span>
                <TimeAgo
                  iso={item.updated_at}
                  className="tag-mono text-[10px] text-muted-foreground shrink-0"
                />
                <select
                  value={picking[item.id] ?? ""}
                  onChange={(e) =>
                    setPicking((prev) => ({ ...prev, [item.id]: e.target.value }))
                  }
                  className="bg-card border border-border rounded-md px-2 py-1 text-xs"
                >
                  <option value="">اختار تيستر…</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name || p.email}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAssign(item)}
                  disabled={pending && activeId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60"
                >
                  {pending && activeId === item.id && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  تعيين
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
