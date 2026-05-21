"use client"

import { useEffect, useState, useTransition } from "react"
import {
  Check,
  ChevronDown,
  Clock,
  FileWarning,
  Loader2,
  MessageSquareText,
  MinusCircle,
  SkipForward,
  User,
  X,
} from "lucide-react"
import type { ItemStatus, TestItem } from "@/lib/types"
import { STATUS_CONFIG, STATUS_ORDER } from "@/lib/status-config"
import {
  updateItemFields,
  updateItemStatus,
} from "@/app/actions"
import { toast } from "sonner"
import {
  useItemPresence,
  usePresenceActions,
} from "@/components/presence/item-presence-context"
import { EditingBadge } from "@/components/presence/editing-badge"
import { TimeAgo } from "@/components/time-ago"

type Props = {
  item: TestItem
  unlocked: boolean
  onLocalUpdate: (itemId: number, patch: Partial<TestItem>) => void
}

const STATUS_ICONS: Record<ItemStatus, typeof Check> = {
  pending: Clock,
  pass: Check,
  fail: X,
  blocked: MinusCircle,
  skip: SkipForward,
}

export function ChecklistItem({ item, unlocked, onLocalUpdate }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [statusPending, startStatusTransition] = useTransition()
  const [savePending, startSaveTransition] = useTransition()

  const [notes, setNotes] = useState(item.notes ?? "")
  const [errorDesc, setErrorDesc] = useState(item.error_description ?? "")
  const [errorCode, setErrorCode] = useState(item.error_code ?? "")

  const presence = useItemPresence(item.id)
  const { setActive } = usePresenceActions()

  const [interacting, setInteracting] = useState(false)

  // Broadcast presence while the user is interacting with this item.
  useEffect(() => {
    if (!interacting || !unlocked) return
    setActive({ kind: "item", id: item.id })
    return () => setActive(null)
  }, [interacting, unlocked, item.id, setActive])

  // Clear interaction when clicking outside this item.
  useEffect(() => {
    if (!interacting) return
    const handler = (e: MouseEvent) => {
      const li = document.getElementById(`item-${item.id}`)
      if (li && !li.contains(e.target as Node)) setInteracting(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [interacting, item.id])

  const cfg = STATUS_CONFIG[item.status]

  const handleStatusChange = (next: ItemStatus) => {
    if (!unlocked) {
      toast.error("سجل دخول الأول عشان تعدل")
      return
    }
    if (next === item.status) return
    const prev = item.status
    const prevUpdated = item.updated_at
    // Optimistic update — bump updated_at immediately so the UI doesn't
    // wait for the realtime echo before refreshing the "Last updated" cell.
    onLocalUpdate(item.id, { status: next, updated_at: new Date().toISOString() })
    startStatusTransition(async () => {
      const res = await updateItemStatus(item.id, next)
      if (!res.ok) {
        onLocalUpdate(item.id, { status: prev, updated_at: prevUpdated })
        toast.error(res.error || "فشل التحديث")
      }
    })
  }

  const handleSaveDetails = () => {
    if (!unlocked) return

    const payload = {
      notes: notes.trim() || null,
      error_description: errorDesc.trim() || null,
      error_code: errorCode.trim() || null,
    }

    const hasChanged =
      payload.notes !== (item.notes ?? null) ||
      payload.error_description !== (item.error_description ?? null) ||
      payload.error_code !== (item.error_code ?? null)

    if (!hasChanged) return

    startSaveTransition(async () => {
      const res = await updateItemFields(item.id, payload)
      if (res.ok) {
        onLocalUpdate(item.id, { ...payload, updated_at: new Date().toISOString() })
      } else {
        toast.error(res.error || "فشل الحفظ التلقائي")
      }
    })
  }

  const StatusIcon = STATUS_ICONS[item.status]

  const hasDetails =
    !!item.notes ||
    !!item.tester_name ||
    !!item.error_description ||
    !!item.error_code

  const hasErrorDetails =
    item.status === "fail" || item.status === "blocked" || !!errorDesc || !!errorCode

  // Row accent — left-edge bar reflecting status
  const accent = cfg.color

  return (
    <li
      id={`item-${item.id}`}
      className="group relative"
      onClick={() => { if (unlocked) setInteracting(true) }}
    >
      {/* Left edge accent bar */}
      <span
        aria-hidden
        className="absolute top-0 right-0 bottom-0 w-[3px]"
        style={{
          background: item.status === "pending" ? "transparent" : accent,
          opacity: item.status === "pending" ? 0 : 0.9,
        }}
      />

      <div
        className={`px-5 lg:px-8 py-4 lg:py-5 transition-colors ${
          expanded ? "bg-muted/50" : "hover:bg-muted/30"
        }`}
        style={
          presence.length > 0
            ? {
                background: "color-mix(in oklch, var(--gold) 10%, var(--background))",
                borderInlineStart: "3px solid var(--gold)",
              }
            : undefined
        }
      >
        <div className="flex items-start gap-4">
          {/* Status icon button — quick toggle pass */}
          <button
            type="button"
            onClick={() =>
              handleStatusChange(item.status === "pass" ? "pending" : "pass")
            }
            disabled={!unlocked || statusPending}
            aria-label="تبديل الحالة السريع"
            className={`shrink-0 size-10 rounded-md flex items-center justify-center transition-all ${
              !unlocked ? "cursor-not-allowed" : "cursor-pointer hover:scale-105"
            }`}
            style={{
              background:
                item.status === "pass"
                  ? "var(--status-pass)"
                  : item.status === "pending"
                  ? "transparent"
                  : cfg.softBg,
              border:
                item.status === "pending"
                  ? "1.5px dashed var(--border-strong)"
                  : item.status === "pass"
                  ? "none"
                  : `1px solid color-mix(in oklch, ${accent} 40%, transparent)`,
              color:
                item.status === "pass"
                  ? "var(--primary-foreground)"
                  : item.status === "pending"
                  ? "var(--muted-foreground)"
                  : accent,
            }}
          >
            <StatusIcon className="size-5" strokeWidth={item.status === "pass" ? 3 : 2} />
          </button>

          <div className="flex-1 min-w-0 space-y-3">
            {/* Code line */}
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                  <span
                    className="font-mono text-[11px] font-semibold num-latin px-1.5 py-0.5 rounded"
                    style={{
                      color: "var(--gold)",
                      background: "color-mix(in oklch, var(--gold) 10%, transparent)",
                    }}
                  >
                    {item.code}
                  </span>

                  {/* Current status badge */}
                  <span
                    className="status-chip"
                    style={{
                      color: cfg.color,
                      background: cfg.softBg,
                      borderColor:
                        "color-mix(in oklch, " + cfg.color + " 30%, transparent)",
                    }}
                  >
                    <span className="status-chip-dot" />
                    {cfg.label}
                  </span>

                  {hasDetails && (
                    <span
                      className="tag-mono flex items-center gap-1"
                      style={{ color: "var(--primary)" }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: "var(--primary)" }}
                      />
                      has notes
                    </span>
                  )}

                  {statusPending && (
                    <Loader2 className="size-3 animate-spin text-muted-foreground" />
                  )}

                  {item.tester_name && (
                    <span
                      className="tag-mono flex items-center gap-1 text-muted-foreground"
                      title="آخر تيستر عدل على البند"
                    >
                      <User className="size-3" />
                      {item.tester_name}
                    </span>
                  )}

                  <EditingBadge entries={presence} />
                </div>

                <p className="text-[15px] lg:text-base text-foreground leading-relaxed">
                  {item.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 size-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-background transition-colors border border-transparent hover:border-border"
                aria-label={expanded ? "إغلاق التفاصيل" : "فتح التفاصيل"}
              >
                <ChevronDown
                  className={`size-4 transition-transform duration-300 ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* Status pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {STATUS_ORDER.map((s) => {
                const active = item.status === s
                const sc = STATUS_CONFIG[s]
                const Icon = STATUS_ICONS[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleStatusChange(s)}
                    disabled={!unlocked || statusPending}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
                      !unlocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                    }`}
                    style={{
                      background: active ? sc.softBg : "transparent",
                      color: active ? sc.color : "var(--muted-foreground)",
                      borderColor: active
                        ? "color-mix(in oklch, " + sc.color + " 35%, transparent)"
                        : "var(--border)",
                    }}
                  >
                    <Icon className="size-3" />
                    <span>{sc.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border bg-background/80">
          <div className="px-5 lg:px-8 py-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="tag-mono text-muted-foreground flex items-center gap-2">
                  <User className="size-3" />
                  Tester
                </label>
                <div className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm flex items-center justify-between gap-2">
                  <span className="text-foreground/80">
                    {item.tester_name || <span className="text-muted-foreground italic">غير محدد</span>}
                  </span>
                  <span className="tag-mono text-[10px] text-muted-foreground">بروفايل</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="tag-mono text-muted-foreground">
                  Last updated
                </label>
                <div className="font-mono text-sm text-foreground/80 bg-card border border-border rounded-md px-4 py-2.5 num-latin flex items-center justify-between gap-2">
                  <span>
                    {new Date(item.updated_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <TimeAgo iso={item.updated_at} className="text-[10px] text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="tag-mono text-muted-foreground flex items-center gap-2">
                <MessageSquareText className="size-3" />
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveDetails}
                disabled={!unlocked}
                rows={3}
                placeholder="أي ملاحظة إضافية..."
                className="w-full bg-card border border-border rounded-md px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50 resize-y leading-relaxed transition-all"
              />
            </div>

            {hasErrorDetails && (
              <div
                className="rounded-md border p-5 space-y-4"
                style={{
                  borderColor:
                    "color-mix(in oklch, var(--status-fail) 35%, transparent)",
                  background: "var(--status-fail-soft)",
                }}
              >
                <div
                  className="flex items-center gap-2 tag-mono"
                  style={{ color: "var(--status-fail)" }}
                >
                  <FileWarning className="size-4" />
                  Error Report
                </div>
                <div className="space-y-2">
                  <label className="tag-mono text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    value={errorDesc}
                    onChange={(e) => setErrorDesc(e.target.value)}
                    onBlur={handleSaveDetails}
                    disabled={!unlocked}
                    rows={2}
                    placeholder="اشرح المشكلة..."
                    className="w-full bg-card border border-border rounded-md px-4 py-3 text-sm focus:outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/15 disabled:opacity-50 leading-relaxed transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="tag-mono text-muted-foreground">
                    Stack trace / Code
                  </label>
                  <textarea
                    value={errorCode}
                    onChange={(e) => setErrorCode(e.target.value)}
                    onBlur={handleSaveDetails}
                    disabled={!unlocked}
                    rows={4}
                    placeholder="Paste console error or code..."
                    dir="ltr"
                    className="w-full bg-card border border-border rounded-md px-4 py-3 text-xs font-mono focus:outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/15 disabled:opacity-50 leading-relaxed transition-all"
                  />
                </div>
              </div>
            )}



            {unlocked ? (
              <div className="flex justify-end pt-1">
                {savePending && (
                  <div className="flex items-center gap-2 text-[10px] tag-mono text-primary animate-pulse">
                    <Loader2 className="size-3 animate-spin" />
                    Saving changes...
                  </div>
                )}
              </div>
            ) : (
              <p className="tag-mono text-muted-foreground text-center py-2">
                Read-only — افتح وضع التعديل من الأعلى للكتابة
              </p>
            )}
          </div>
        </div>
      )}
    </li>
  )
}
