"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  AlertOctagon,
  Bug,
  Calendar,
  Check,
  ChevronRight,
  Loader2,
  NotebookPen,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import type {
  TesterUpdate,
  TesterUpdateCategory,
  TesterUpdateItem,
} from "@/lib/types"
import {
  createTesterUpdate,
  deleteTesterUpdate,
  updateTesterUpdate,
} from "@/app/actions"

type Props = {
  initialUpdates: TesterUpdate[]
  unlocked: boolean
}

type CategoryMeta = {
  label: string
  short: string
  icon: typeof Sparkles
  color: string
  softBg: string
}

const CATEGORY_META: Record<TesterUpdateCategory, CategoryMeta> = {
  update: {
    label: "تحديثات",
    short: "تحديث",
    icon: Sparkles,
    color: "var(--primary)",
    softBg: "color-mix(in oklch, var(--primary) 14%, transparent)",
  },
  general_error: {
    label: "أخطاء عامة",
    short: "خطأ",
    icon: AlertOctagon,
    color: "var(--status-fail)",
    softBg: "color-mix(in oklch, var(--status-fail) 14%, transparent)",
  },
}

type FilterKey = "all" | TesterUpdateCategory

function normalizeItems(value: unknown): TesterUpdateItem[] {
  if (!Array.isArray(value)) return []
  const out: TesterUpdateItem[] = []
  for (const raw of value) {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      const item: TesterUpdateItem = {
        text: typeof obj.text === "string" ? obj.text : "",
        done: obj.done === true,
      }
      if (typeof obj.created_at === "string" && obj.created_at.length > 0) {
        item.created_at = obj.created_at
      }
      out.push(item)
    }
  }
  return out
}

function normalizeCategory(value: unknown): TesterUpdateCategory {
  return value === "general_error" ? "general_error" : "update"
}

function normalizeRow(row: Record<string, unknown>): TesterUpdate {
  return {
    id: row.id as number,
    category: normalizeCategory(row.category),
    tester_name: (row.tester_name as string) ?? "",
    items: normalizeItems(row.items),
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  }
}

/** Returns "DD/MM · HH:MM" (24-hour) for an ISO timestamp — no year.
 *  Returns an empty string if the timestamp is missing or invalid. */
function formatItemDate(iso?: string): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  return `${day}/${month} · ${hours}:${minutes}`
}

export function TesterUpdatesFab({ initialUpdates, unlocked }: Props) {
  const [open, setOpen] = useState(false)
  const [updates, setUpdates] = useState<TesterUpdate[]>(initialUpdates)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [picker, setPicker] = useState(false)
  // Which card is currently expanded in the centered modal editor.
  const [activeId, setActiveId] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Realtime sync — pick up rows added/edited/deleted in other tabs.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("tester_updates_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tester_updates" },
        (payload: {
          eventType: string
          new: Record<string, unknown>
          old: Record<string, unknown>
        }) => {
          setUpdates((prev) => {
            if (payload.eventType === "DELETE") {
              const oldRow = payload.old
              return prev.filter((u) => u.id !== (oldRow.id as number))
            }
            const row = normalizeRow(payload.new)
            const idx = prev.findIndex((u) => u.id === row.id)
            if (idx === -1) {
              return [row, ...prev]
            }
            const next = prev.slice()
            next[idx] = row
            return next
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Outside-click & Escape:
  //   * If modal is open → close only the modal first.
  //   * Else close the popover.
  // The modal renders OUTSIDE containerRef (it's a centered overlay), so we
  // skip the outside-click check whenever the modal is up.
  useEffect(() => {
    if (!open) return
    const handlePointer = (e: MouseEvent) => {
      if (activeId !== null) return
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setPicker(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (activeId !== null) {
        setActiveId(null)
      } else {
        setOpen(false)
        setPicker(false)
      }
    }
    window.addEventListener("mousedown", handlePointer)
    window.addEventListener("keydown", handleKey)
    return () => {
      window.removeEventListener("mousedown", handlePointer)
      window.removeEventListener("keydown", handleKey)
    }
  }, [open, activeId])

  const filteredUpdates = useMemo(() => {
    if (filter === "all") return updates
    return updates.filter((u) => u.category === filter)
  }, [updates, filter])

  const counts = useMemo(() => {
    let updateCount = 0
    let errorCount = 0
    let openItems = 0
    for (const u of updates) {
      if (u.category === "update") updateCount++
      else errorCount++
      for (const it of u.items) {
        if (!it.done) openItems++
      }
    }
    return { updateCount, errorCount, total: updates.length, openItems }
  }, [updates])

  const activeUpdate = useMemo(
    () => (activeId === null ? null : updates.find((u) => u.id === activeId) ?? null),
    [updates, activeId],
  )

  const handleCreate = async (category: TesterUpdateCategory) => {
    setPicker(false)
    if (!unlocked) {
      toast.error("التعديل مقفول — افتحه من الأعلى أولاً")
      return
    }
    const res = await createTesterUpdate(category, "")
    if (res.ok && res.update) {
      setUpdates((prev) => {
        if (prev.some((u) => u.id === res.update!.id)) return prev
        return [res.update!, ...prev]
      })
      setFilter(category)
      // Open the new card straight away in the centered editor modal.
      setActiveId(res.update.id)
    } else {
      toast.error(res.error || "تعذر إنشاء البطاقة")
    }
  }

  const handleUpdateLocal = (id: number, patch: Partial<TesterUpdate>) => {
    setUpdates((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  const handleDelete = async (id: number) => {
    if (!unlocked) {
      toast.error("التعديل مقفول")
      return
    }
    const prev = updates
    setUpdates((curr) => curr.filter((u) => u.id !== id))
    if (activeId === id) setActiveId(null)
    const res = await deleteTesterUpdate(id)
    if (!res.ok) {
      toast.error(res.error || "تعذر حذف البطاقة")
      setUpdates(prev)
    }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="fixed z-40 bottom-6 end-6 flex flex-col items-end gap-3"
        dir="ltr"
      >
        {/* ── Anchored popover (compact list view) ── */}
        {open && (
          <div
            className="origin-bottom-right will-change-transform animate-fab-popover-in"
            dir="rtl"
          >
            <div className="w-[min(92vw,380px)] max-h-[min(75vh,560px)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <header
                className="px-4 pt-4 pb-3 border-b border-border"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklch, var(--primary) 8%, var(--card)), var(--card))",
                }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                      style={{
                        background:
                          "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 60%, var(--gold)))",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <NotebookPen className="size-4" />
                    </span>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-display font-semibold text-base text-foreground truncate">
                        دفتر الملاحظات
                      </span>
                      <span className="tag-mono text-[9px] text-muted-foreground truncate">
                        Notepad — Updates &amp; Errors
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setPicker(false)
                    }}
                    className="size-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors shrink-0"
                    aria-label="إغلاق"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <FilterPill
                    active={filter === "all"}
                    onClick={() => setFilter("all")}
                    label="الكل"
                    count={counts.total}
                  />
                  <FilterPill
                    active={filter === "update"}
                    onClick={() => setFilter("update")}
                    label="تحديثات"
                    count={counts.updateCount}
                    color="var(--primary)"
                    icon={Sparkles}
                  />
                  <FilterPill
                    active={filter === "general_error"}
                    onClick={() => setFilter("general_error")}
                    label="أخطاء"
                    count={counts.errorCount}
                    color="var(--status-fail)"
                    icon={Bug}
                  />
                </div>
              </header>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-[160px]">
                {filteredUpdates.length === 0 ? (
                  <EmptyState
                    unlocked={unlocked}
                    onPick={() => setPicker(true)}
                    hint={
                      filter === "all"
                        ? "لسه ما فيش حاجة هنا"
                        : filter === "update"
                        ? "لا توجد تحديثات مسجلة بعد"
                        : "لا توجد أخطاء عامة مسجلة بعد"
                    }
                  />
                ) : (
                  filteredUpdates.map((update) => (
                    <UpdateRow
                      key={update.id}
                      update={update}
                      onOpen={() => setActiveId(update.id)}
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              <footer className="border-t border-border bg-card/80 px-3 py-2.5 flex items-center justify-between gap-2">
                <span className="tag-mono text-[10px] text-muted-foreground num-latin">
                  {counts.total} بطاقة · {counts.openItems} عنصر مفتوح
                </span>
                <div className="relative">
                  {picker && (
                    <div
                      className="absolute bottom-full end-0 mb-2 w-60 rounded-xl border border-border bg-card shadow-2xl p-1.5 origin-bottom-right animate-fab-picker-in"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {(Object.keys(CATEGORY_META) as TesterUpdateCategory[]).map(
                        (key) => {
                          const meta = CATEGORY_META[key]
                          const Icon = meta.icon
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleCreate(key)}
                              className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted transition-colors text-right group"
                            >
                              <span
                                className="size-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                                style={{ background: meta.softBg, color: meta.color }}
                              >
                                <Icon className="size-4" />
                              </span>
                              <span className="flex-1 min-w-0 text-right">
                                <span className="block font-display font-semibold text-sm text-foreground">
                                  {meta.label}
                                </span>
                                <span className="block text-[10px] text-muted-foreground leading-tight mt-0.5">
                                  {key === "update"
                                    ? "تحسينات وأفكار مستقبلية"
                                    : "أخطاء غير مرتبطة ببند"}
                                </span>
                              </span>
                              <ChevronRight className="size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          )
                        },
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setPicker((v) => !v)}
                    disabled={!unlocked}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-95"
                    style={{
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                    }}
                  >
                    <Plus
                      className={`size-3.5 transition-transform duration-200 ${
                        picker ? "rotate-45" : ""
                      }`}
                    />
                    إضافة
                  </button>
                </div>
              </footer>
            </div>
          </div>
        )}

        {/* ── Floating action button ── */}
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false)
              setPicker(false)
            } else {
              setOpen(true)
            }
          }}
          className="group relative size-14 rounded-2xl shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:rotate-3"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 55%, var(--gold)))",
            color: "var(--primary-foreground)",
          }}
          aria-label={open ? "إغلاق دفتر الملاحظات" : "فتح دفتر الملاحظات"}
        >
          <span
            aria-hidden
            className="absolute inset-0 rounded-2xl blur-xl opacity-40 transition-opacity group-hover:opacity-70 -z-10"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 55%, var(--gold)))",
            }}
          />

          <span
            className={`transition-all duration-300 ${
              open ? "rotate-90 scale-90" : "rotate-0 scale-100"
            }`}
          >
            {open ? <X className="size-5" /> : <NotebookPen className="size-5" />}
          </span>

          {!open && counts.openItems > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full tag-mono text-[10px] flex items-center justify-center num-latin shadow-md border-2 border-background"
              style={{
                background: "var(--status-fail)",
                color: "var(--primary-foreground)",
              }}
            >
              {counts.openItems}
            </span>
          )}
        </button>
      </div>

      {/* ── Centered editor modal ── */}
      {activeUpdate && (
        <UpdateEditorModal
          key={activeUpdate.id}
          update={activeUpdate}
          unlocked={unlocked}
          onClose={() => setActiveId(null)}
          onLocalUpdate={handleUpdateLocal}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}

function FilterPill({
  active,
  onClick,
  label,
  count,
  color,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  color?: string
  icon?: typeof Sparkles
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-colors border"
      style={{
        background: active
          ? color
            ? `color-mix(in oklch, ${color} 16%, transparent)`
            : "var(--muted)"
          : "transparent",
        color: active && color ? color : "var(--foreground)",
        borderColor: active
          ? color
            ? `color-mix(in oklch, ${color} 40%, transparent)`
            : "var(--border-strong)"
          : "var(--border)",
      }}
    >
      {Icon && <Icon className="size-2.5" />}
      {label}
      <span className="tag-mono num-latin opacity-70 text-[10px]">{count}</span>
    </button>
  )
}

function EmptyState({
  unlocked,
  onPick,
  hint,
}: {
  unlocked: boolean
  onPick: () => void
  hint: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-3">
      <span
        className="size-12 rounded-2xl flex items-center justify-center"
        style={{
          background: "color-mix(in oklch, var(--primary) 10%, transparent)",
          color: "var(--primary)",
        }}
      >
        <NotebookPen className="size-5" />
      </span>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
        {hint}
      </p>
      {!unlocked && (
        <p className="text-[10px] tag-mono text-muted-foreground">
          افتح وضع التعديل لإضافة بطاقات
        </p>
      )}
      <button
        type="button"
        onClick={onPick}
        disabled={!unlocked}
        className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-95"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        <Plus className="size-3.5" /> ابدأ بطاقة جديدة
      </button>
    </div>
  )
}

// ── Compact row in the popover list — clickable to expand the editor.
function UpdateRow({
  update,
  onOpen,
}: {
  update: TesterUpdate
  onOpen: () => void
}) {
  const meta = CATEGORY_META[update.category]
  const Icon = meta.icon
  const doneCount = update.items.filter((it) => it.done).length
  const totalCount = update.items.length
  const firstItem = update.items.find((it) => it.text.trim() !== "")
  const previewText = firstItem?.text.trim() ?? ""

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border bg-card text-right px-2.5 py-2 flex items-center gap-2 hover:shadow-md transition-all active:scale-[0.99] group"
      style={{
        borderColor: `color-mix(in oklch, ${meta.color} 22%, var(--border))`,
      }}
    >
      <span
        className="size-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: meta.softBg, color: meta.color }}
      >
        <Icon className="size-4" />
      </span>
      <span className="flex-1 min-w-0 text-right">
        <span className="flex items-center gap-2 leading-tight">
          <span className="font-display font-semibold text-sm text-foreground truncate">
            {update.tester_name.trim() || "بدون اسم"}
          </span>
          <span
            className="tag-mono text-[9px] uppercase tracking-wider shrink-0"
            style={{ color: meta.color }}
          >
            {meta.short}
          </span>
        </span>
        <span className="block text-[11px] text-muted-foreground truncate mt-0.5">
          {previewText || "لا توجد عناصر بعد"}
        </span>
      </span>
      <span className="flex flex-col items-center gap-0.5 shrink-0">
        <span className="tag-mono text-[10px] text-muted-foreground num-latin">
          {doneCount}/{totalCount}
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground rtl:rotate-180 opacity-50 group-hover:opacity-100 transition-opacity" />
      </span>
    </button>
  )
}

// ── Centered modal: comfortable editor for a single update card.
function UpdateEditorModal({
  update,
  unlocked,
  onClose,
  onLocalUpdate,
  onDelete,
}: {
  update: TesterUpdate
  unlocked: boolean
  onClose: () => void
  onLocalUpdate: (id: number, patch: Partial<TesterUpdate>) => void
  onDelete: (id: number) => void
}) {
  const meta = CATEGORY_META[update.category]
  const Icon = meta.icon
  const [testerName, setTesterName] = useState(update.tester_name)
  const [items, setItems] = useState<TesterUpdateItem[]>(update.items)
  const [savePending, startSaveTransition] = useTransition()
  const focusIndexRef = useRef<number | null>(null)
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const baselineRef = useRef({
    tester_name: update.tester_name,
    items: JSON.stringify(update.items),
  })

  // Sync from upstream (realtime) when this row changes externally and
  // the user isn't currently typing in this card.
  useEffect(() => {
    const incomingItems = JSON.stringify(update.items)
    if (incomingItems === baselineRef.current.items) return
    const activeEl =
      typeof document !== "undefined" ? document.activeElement : null
    const isEditingHere = inputRefs.current.some((el) => el === activeEl)
    if (!isEditingHere) {
      setItems(update.items)
      baselineRef.current.items = incomingItems
    }
  }, [update.items])

  useEffect(() => {
    if (update.tester_name === baselineRef.current.tester_name) return
    const activeEl =
      typeof document !== "undefined" ? document.activeElement : null
    if (activeEl?.getAttribute("data-card-name") !== String(update.id)) {
      setTesterName(update.tester_name)
      baselineRef.current.tester_name = update.tester_name
    }
  }, [update.tester_name, update.id])

  useEffect(() => {
    if (focusIndexRef.current === null) return
    const el = inputRefs.current[focusIndexRef.current]
    if (el) el.focus()
    focusIndexRef.current = null
  }, [items.length])

  const persist = (patch: { items?: TesterUpdateItem[]; tester_name?: string }) => {
    if (!unlocked) return
    const payload: { items?: TesterUpdateItem[]; tester_name?: string } = {}
    if (patch.items !== undefined) {
      const serialized = JSON.stringify(patch.items)
      if (serialized !== baselineRef.current.items) {
        payload.items = patch.items
      }
    }
    if (patch.tester_name !== undefined) {
      if (patch.tester_name !== baselineRef.current.tester_name) {
        payload.tester_name = patch.tester_name
      }
    }
    if (Object.keys(payload).length === 0) return

    startSaveTransition(async () => {
      const res = await updateTesterUpdate(update.id, payload)
      if (res.ok) {
        if (payload.items) baselineRef.current.items = JSON.stringify(payload.items)
        if (payload.tester_name !== undefined) {
          baselineRef.current.tester_name = payload.tester_name
        }
        onLocalUpdate(update.id, payload)
      } else {
        toast.error(res.error || "فشل حفظ البطاقة")
      }
    })
  }

  const toggleDone = (idx: number) => {
    if (!unlocked) {
      toast.error("التعديل مقفول")
      return
    }
    const next = items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it))
    setItems(next)
    persist({ items: next })
  }

  const updateText = (idx: number, text: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, text } : it)))
  }

  const removeItem = (idx: number) => {
    if (!unlocked) return
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    persist({ items: next })
  }

  const addItem = () => {
    if (!unlocked) {
      toast.error("التعديل مقفول")
      return
    }
    focusIndexRef.current = items.length
    setItems((prev) => [
      ...prev,
      { text: "", done: false, created_at: new Date().toISOString() },
    ])
  }

  const handleItemBlur = () => {
    const trimmed = items.filter((it, idx) => {
      if (it.text.trim() !== "" || it.done) return true
      return idx !== items.length - 1
    })
    if (trimmed.length !== items.length) {
      setItems(trimmed)
    }
    persist({ items: trimmed })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault()
      persist({ items })
      focusIndexRef.current = idx + 1
      setItems((prev) => [
        ...prev.slice(0, idx + 1),
        { text: "", done: false, created_at: new Date().toISOString() },
        ...prev.slice(idx + 1),
      ])
    } else if (e.key === "Backspace" && items[idx]?.text === "" && items.length > 0) {
      e.preventDefault()
      focusIndexRef.current = Math.max(0, idx - 1)
      const next = items.filter((_, i) => i !== idx)
      setItems(next)
      persist({ items: next })
    }
  }

  const doneCount = items.filter((it) => it.done).length
  const totalCount = items.length

  // Lock body scroll while the modal is up.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-fab-backdrop-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />

      <article
        className="relative w-[min(94vw,640px)] max-h-[min(88vh,720px)] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fab-modal-in"
        style={{
          borderColor: `color-mix(in oklch, ${meta.color} 32%, var(--border))`,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header
          className="flex items-center gap-3 px-5 py-3.5 border-b border-border"
          style={{ background: meta.softBg }}
        >
          <span
            className="size-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: `color-mix(in oklch, ${meta.color} 22%, transparent)`,
              color: meta.color,
            }}
          >
            <Icon className="size-5" />
          </span>
          <div className="flex flex-col leading-tight min-w-0 flex-1">
            <span className="font-display font-semibold text-lg text-foreground truncate">
              {meta.label}
            </span>
            <span
              className="tag-mono text-[10px] uppercase tracking-wider"
              style={{ color: meta.color }}
            >
              {meta.short} · {doneCount}/{totalCount}
            </span>
          </div>
          {unlocked && (
            <button
              type="button"
              onClick={() => onDelete(update.id)}
              className="size-9 rounded-lg hover:bg-foreground/5 flex items-center justify-center transition-colors text-muted-foreground hover:text-[var(--status-fail)]"
              aria-label="حذف البطاقة"
              title="حذف البطاقة"
            >
              <Trash2 className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="size-9 rounded-lg hover:bg-foreground/5 flex items-center justify-center transition-colors"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <div>
            <label className="block tag-mono text-[10px] text-muted-foreground mb-1.5">
              اسم التيستر
            </label>
            <input
              type="text"
              data-card-name={update.id}
              value={testerName}
              onChange={(e) => setTesterName(e.target.value)}
              onBlur={() => persist({ tester_name: testerName })}
              disabled={!unlocked}
              placeholder="مين اللي بيكتب الملاحظة؟"
              className="w-full bg-transparent text-base font-display font-semibold focus:outline-none border-b border-border focus:border-primary py-2 transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block tag-mono text-[10px] text-muted-foreground">
                العناصر
              </label>
              {savePending && (
                <span className="flex items-center gap-1.5 text-[10px] tag-mono text-primary animate-pulse">
                  <Loader2 className="size-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-2">
                ما فيش عناصر لسه — اضغط + لإضافة أول واحد
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((item, idx) => {
                  const dateLabel = formatItemDate(item.created_at)
                  return (
                    <li
                      key={idx}
                      className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleDone(idx)}
                        disabled={!unlocked}
                        aria-label={item.done ? "إلغاء العلامة" : "تعليم كمنجز"}
                        className={`size-5 mt-1 rounded flex items-center justify-center shrink-0 transition-all border ${
                          item.done
                            ? "text-primary-foreground"
                            : "bg-card border-border-strong hover:border-primary"
                        } ${
                          !unlocked
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                        }`}
                        style={
                          item.done
                            ? { background: meta.color, borderColor: meta.color }
                            : undefined
                        }
                      >
                        {item.done && <Check className="size-3.5" strokeWidth={3} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <input
                          ref={(el) => {
                            inputRefs.current[idx] = el
                          }}
                          type="text"
                          value={item.text}
                          onChange={(e) => updateText(idx, e.target.value)}
                          onBlur={handleItemBlur}
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          disabled={!unlocked}
                          placeholder="اكتب الملاحظة..."
                          className={`w-full bg-transparent text-[15px] focus:outline-none border-b border-transparent focus:border-border py-1 leading-relaxed transition-colors disabled:opacity-60 ${
                            item.done
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        />
                        {dateLabel && (
                          <span className="inline-flex items-center gap-1 tag-mono text-[10px] text-muted-foreground num-latin mt-1">
                            <Calendar className="size-2.5" />
                            {dateLabel}
                          </span>
                        )}
                      </div>

                      {unlocked && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="opacity-0 group-hover:opacity-100 hover:text-[var(--status-fail)] size-7 mt-0.5 flex items-center justify-center transition-opacity shrink-0 rounded-md hover:bg-foreground/5"
                          aria-label="حذف العنصر"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={addItem}
              disabled={!unlocked}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm active:scale-95"
              style={{
                color: meta.color,
                borderColor: `color-mix(in oklch, ${meta.color} 32%, transparent)`,
                background: `color-mix(in oklch, ${meta.color} 8%, transparent)`,
              }}
            >
              <Plus className="size-3.5" /> إضافة عنصر
            </button>
          </div>
        </div>

        <footer className="border-t border-border px-5 py-3 flex items-center justify-between gap-3 bg-card/80">
          <span className="tag-mono text-[10px] text-muted-foreground">
            اضغط خارج النافذة أو Escape للإغلاق
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-muted"
          >
            تم
          </button>
        </footer>
      </article>
    </div>
  )
}
