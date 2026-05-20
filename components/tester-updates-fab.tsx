"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  AlertOctagon,
  Bug,
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  MessageCircle,
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
  description: string
}

const CATEGORY_META: Record<TesterUpdateCategory, CategoryMeta> = {
  update: {
    label: "تحديثات مستقبلية",
    short: "تحديث",
    icon: Sparkles,
    color: "var(--primary)",
    softBg: "color-mix(in oklch, var(--primary) 12%, transparent)",
    description: "أفكار وتحسينات تحب تضيفها على المنصة لاحقاً",
  },
  general_error: {
    label: "أخطاء عامة",
    short: "خطأ عام",
    icon: AlertOctagon,
    color: "var(--status-fail)",
    softBg: "color-mix(in oklch, var(--status-fail) 12%, transparent)",
    description: "أخطاء عامة غير مرتبطة ببند اختبار بعينه",
  },
}

type FilterKey = "all" | TesterUpdateCategory

function normalizeItems(value: unknown): TesterUpdateItem[] {
  if (!Array.isArray(value)) return []
  const out: TesterUpdateItem[] = []
  for (const raw of value) {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      out.push({
        text: typeof obj.text === "string" ? obj.text : "",
        done: obj.done === true,
      })
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

export function TesterUpdatesFab({ initialUpdates, unlocked }: Props) {
  const [open, setOpen] = useState(false)
  const [updates, setUpdates] = useState<TesterUpdate[]>(initialUpdates)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [picker, setPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

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

  // Close the picker on outside click.
  useEffect(() => {
    if (!picker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPicker(false)
      }
    }
    window.addEventListener("mousedown", handler)
    return () => window.removeEventListener("mousedown", handler)
  }, [picker])

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

  const handleCreate = async (category: TesterUpdateCategory) => {
    setPicker(false)
    if (!unlocked) {
      toast.error("التعديل مقفول — افتحه من الأعلى أولاً")
      return
    }
    const res = await createTesterUpdate(category, "")
    if (res.ok && res.update) {
      // Realtime will eventually deliver it, but we add it locally for snappiness.
      setUpdates((prev) => {
        if (prev.some((u) => u.id === res.update!.id)) return prev
        return [res.update!, ...prev]
      })
      setFilter(category)
      setOpen(true)
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
    const res = await deleteTesterUpdate(id)
    if (!res.ok) {
      toast.error(res.error || "تعذر حذف البطاقة")
      setUpdates(prev)
    }
  }

  return (
    <>
      {/* ── Floating button ── */}
      <div
        className="fixed z-40 bottom-6 end-6 flex flex-col items-end gap-3"
        dir="ltr"
      >
        {picker && (
          <div
            ref={pickerRef}
            className="rounded-2xl border border-border bg-card shadow-2xl p-2 w-64 animate-in fade-in slide-in-from-bottom-2 duration-200"
            dir="rtl"
          >
            <div className="px-3 py-2 tag-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              إضافة جديدة
            </div>
            {(Object.keys(CATEGORY_META) as TesterUpdateCategory[]).map((key) => {
              const meta = CATEGORY_META[key]
              const Icon = meta.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleCreate(key)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-right"
                >
                  <span
                    className="size-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: meta.softBg, color: meta.color }}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-display font-semibold text-sm text-foreground">
                      {meta.label}
                    </span>
                    <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">
                      {meta.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false)
            } else {
              setOpen(true)
            }
            setPicker(false)
          }}
          className="relative size-14 rounded-full shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 70%, var(--gold)))",
            color: "var(--primary-foreground)",
          }}
          aria-label={open ? "إغلاق لوحة التحديثات" : "فتح لوحة التحديثات"}
        >
          {open ? (
            <X className="size-6" />
          ) : (
            <MessageCircle className="size-6" />
          )}
          {!open && counts.openItems > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full tag-mono text-[10px] flex items-center justify-center num-latin shadow-md"
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

      {/* ── Side panel ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex" dir="rtl">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="flex-1 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-200"
          />

          <aside className="w-full max-w-md h-full bg-background border-s border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <header className="px-5 py-4 border-b border-border bg-card">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="size-9 rounded-lg flex items-center justify-center"
                    style={{
                      background:
                        "color-mix(in oklch, var(--primary) 14%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    <Lightbulb className="size-4" />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="font-display font-semibold text-lg text-foreground">
                      دفتر الملاحظات
                    </span>
                    <span className="tag-mono text-[10px] text-muted-foreground">
                      Notepad — Updates &amp; General Errors
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="size-9 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
                  aria-label="إغلاق"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
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
                  label="أخطاء عامة"
                  count={counts.errorCount}
                  color="var(--status-fail)"
                  icon={Bug}
                />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {filteredUpdates.length === 0 ? (
                <EmptyState
                  unlocked={unlocked}
                  onPick={() => setPicker(true)}
                  hint={
                    filter === "all"
                      ? "لسه ما فيش حاجة هنا — اضغط + عشان تضيف أول بطاقة"
                      : `لا توجد ${
                          filter === "update" ? "تحديثات" : "أخطاء عامة"
                        } مسجلة بعد`
                  }
                />
              ) : (
                filteredUpdates.map((update) => (
                  <UpdateCard
                    key={update.id}
                    update={update}
                    unlocked={unlocked}
                    onLocalUpdate={handleUpdateLocal}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>

            <footer className="border-t border-border bg-card px-4 py-3 flex items-center justify-between">
              <span className="tag-mono text-[10px] text-muted-foreground num-latin">
                {counts.total} بطاقة · {counts.openItems} عنصر مفتوح
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPicker((v) => !v)}
                  disabled={!unlocked}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  <Plus className="size-4" />
                  إضافة بطاقة
                  <ChevronDown
                    className={`size-3 transition-transform ${
                      picker ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
            </footer>
          </aside>
        </div>
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
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors border"
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
      {Icon && <Icon className="size-3" />}
      {label}
      <span className="tag-mono num-latin opacity-70">{count}</span>
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
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-4">
      <span
        className="size-16 rounded-2xl flex items-center justify-center"
        style={{
          background: "color-mix(in oklch, var(--primary) 10%, transparent)",
          color: "var(--primary)",
        }}
      >
        <Lightbulb className="size-7" />
      </span>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
        {hint}
      </p>
      {!unlocked && (
        <p className="text-[11px] tag-mono text-muted-foreground">
          افتح وضع التعديل لإضافة بطاقات جديدة
        </p>
      )}
      <button
        type="button"
        onClick={onPick}
        disabled={!unlocked}
        className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background: "var(--primary)",
          color: "var(--primary-foreground)",
        }}
      >
        <Plus className="size-4" /> ابدأ بطاقة جديدة
      </button>
    </div>
  )
}

function UpdateCard({
  update,
  unlocked,
  onLocalUpdate,
  onDelete,
}: {
  update: TesterUpdate
  unlocked: boolean
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
    const activeEl = typeof document !== "undefined" ? document.activeElement : null
    const isEditingHere = inputRefs.current.some((el) => el === activeEl)
    if (!isEditingHere) {
      setItems(update.items)
      baselineRef.current.items = incomingItems
    }
  }, [update.items])

  useEffect(() => {
    if (update.tester_name === baselineRef.current.tester_name) return
    const activeEl = typeof document !== "undefined" ? document.activeElement : null
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
    setItems((prev) => [...prev, { text: "", done: false }])
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
        { text: "", done: false },
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

  return (
    <article
      className="rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md"
      style={{
        borderColor: `color-mix(in oklch, ${meta.color} 28%, var(--border))`,
      }}
    >
      <header
        className="flex items-center gap-2 px-3 py-2 border-b border-border"
        style={{ background: meta.softBg }}
      >
        <span
          className="size-7 rounded-md flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklch, ${meta.color} 22%, transparent)`,
            color: meta.color,
          }}
        >
          <Icon className="size-3.5" />
        </span>
        <span
          className="tag-mono text-[10px] uppercase tracking-wider"
          style={{ color: meta.color }}
        >
          {meta.short}
        </span>
        <span className="tag-mono text-[10px] text-muted-foreground num-latin ms-auto">
          {doneCount}/{totalCount}
        </span>
        {unlocked && (
          <button
            type="button"
            onClick={() => onDelete(update.id)}
            className="size-7 rounded-md hover:bg-foreground/5 flex items-center justify-center transition-colors text-muted-foreground hover:text-[var(--status-fail)]"
            aria-label="حذف البطاقة"
            title="حذف البطاقة"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </header>

      <div className="px-3 py-3 space-y-3">
        <input
          type="text"
          data-card-name={update.id}
          value={testerName}
          onChange={(e) => setTesterName(e.target.value)}
          onBlur={() => persist({ tester_name: testerName })}
          disabled={!unlocked}
          placeholder="اسم التيستر..."
          className="w-full bg-transparent text-sm font-display font-semibold focus:outline-none border-b border-border focus:border-primary py-1.5 transition-colors disabled:opacity-60"
        />

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            لا توجد عناصر بعد — اضغط + لإضافة أول عنصر
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleDone(idx)}
                  disabled={!unlocked}
                  aria-label={item.done ? "إلغاء العلامة" : "تعليم كمنجز"}
                  className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-all border ${
                    item.done
                      ? "text-primary-foreground"
                      : "bg-card border-border-strong hover:border-primary"
                  } ${!unlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                  style={
                    item.done
                      ? { background: meta.color, borderColor: meta.color }
                      : undefined
                  }
                >
                  {item.done && <Check className="size-3.5" strokeWidth={3} />}
                </button>
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
                  placeholder="اكتب التحديث أو الخطأ..."
                  className={`flex-1 min-w-0 bg-transparent text-sm focus:outline-none border-b border-transparent focus:border-border py-1 leading-relaxed transition-colors disabled:opacity-60 ${
                    item.done ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                />
                {unlocked && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="opacity-40 hover:opacity-100 hover:text-[var(--status-fail)] size-6 flex items-center justify-center transition-opacity shrink-0"
                    aria-label="حذف العنصر"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={addItem}
            disabled={!unlocked}
            className="text-xs tag-mono flex items-center gap-1.5 hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ color: meta.color }}
          >
            <Plus className="size-3" /> إضافة عنصر
          </button>
          {savePending && (
            <div className="flex items-center gap-1.5 text-[10px] tag-mono text-primary animate-pulse">
              <Loader2 className="size-3 animate-spin" /> Saving...
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
