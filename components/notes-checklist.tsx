"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { Check, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  parseChecklistNotes,
  serializeChecklistNotes,
  type ChecklistNoteItem,
} from "@/lib/notes-checklist"
import {
  type PresenceTarget,
  usePresenceActions,
} from "@/components/presence/item-presence-context"

type Props = {
  initialValue: string | null
  unlocked: boolean
  onSave: (value: string | null) => Promise<{ ok: boolean; error?: string }>
  addLabel?: string
  emptyLabel?: string
  itemPlaceholder?: string
  compact?: boolean
  presenceTarget?: PresenceTarget | null
}

export function NotesChecklist({
  initialValue,
  unlocked,
  onSave,
  addLabel = "إضافة عنصر",
  emptyLabel = "لا توجد ملاحظات بعد",
  itemPlaceholder = "اكتب الملاحظة...",
  compact,
  presenceTarget = null,
}: Props) {
  const [items, setItems] = useState<ChecklistNoteItem[]>(() =>
    parseChecklistNotes(initialValue),
  )
  const [savePending, startSaveTransition] = useTransition()
  const baselineRef = useRef<string | null>(
    serializeChecklistNotes(parseChecklistNotes(initialValue)),
  )
  const focusIndexRef = useRef<number | null>(null)
  const inputRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const { setActive } = usePresenceActions()
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const broadcastTyping = useCallback(() => {
    if (!presenceTarget) return
    setActive(presenceTarget, true)
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      setActive(presenceTarget, false)
    }, 1500)
  }, [presenceTarget, setActive])

  // Auto-resize a textarea to fit its content.
  const autosize = (el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }

  // Sync from upstream (e.g. another tab via realtime) when the value
  // actually changes — but never clobber the user mid-edit.
  useEffect(() => {
    const parsed = parseChecklistNotes(initialValue)
    const incoming = serializeChecklistNotes(parsed)
    if (incoming !== baselineRef.current) {
      const activeEl = typeof document !== "undefined" ? document.activeElement : null
      const isEditingHere = inputRefs.current.some((el) => el === activeEl)
      if (!isEditingHere) {
        setItems(parsed)
        baselineRef.current = incoming
      }
    }
  }, [initialValue])

  // Focus a newly added row.
  useEffect(() => {
    if (focusIndexRef.current === null) return
    const idx = focusIndexRef.current
    const el = inputRefs.current[idx]
    if (el) {
      el.focus()
      autosize(el)
    }
    focusIndexRef.current = null
  }, [items.length])

  // Re-autosize every textarea whenever the items change so wrapping stays
  // accurate after re-renders.
  useEffect(() => {
    for (const el of inputRefs.current) autosize(el)
  }, [items])

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      if (presenceTarget) setActive(null, false)
    }
  }, [presenceTarget, setActive])

  const persist = (next: ChecklistNoteItem[]) => {
    if (!unlocked) return
    const serialized = serializeChecklistNotes(next)
    if (serialized === baselineRef.current) return
    startSaveTransition(async () => {
      const res = await onSave(serialized)
      if (res.ok) {
        baselineRef.current = serialized
      } else {
        toast.error(res.error || "فشل حفظ الملاحظات")
      }
    })
  }

  const toggleDone = (idx: number) => {
    if (!unlocked) {
      toast.error("التعديل مقفول — افتحه من الأعلى")
      return
    }
    const next = items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it))
    setItems(next)
    persist(next)
  }

  const updateText = (idx: number, text: string) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, text } : it)))
  }

  const removeItem = (idx: number) => {
    if (!unlocked) return
    const next = items.filter((_, i) => i !== idx)
    setItems(next)
    persist(next)
  }

  const addItem = () => {
    if (!unlocked) {
      toast.error("التعديل مقفول — افتحه من الأعلى")
      return
    }
    focusIndexRef.current = items.length
    setItems((prev) => [...prev, { text: "", done: false }])
  }

  const handleBlur = () => {
    // Drop fully-empty trailing rows on blur so the list stays tidy.
    const trimmed = items.filter((it, idx) => {
      if (it.text.trim() !== "" || it.done) return true
      return idx !== items.length - 1
    })
    if (trimmed.length !== items.length) {
      setItems(trimmed)
    }
    persist(trimmed)
    if (presenceTarget) setActive(null, false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      // Persist current state, then add a new row. Shift+Enter inserts a line break inside the current item.
      persist(items)
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
      persist(next)
    }
  }

  const sizes = compact
    ? {
        box: "size-4",
        icon: "size-3",
        text: "text-[13px]",
        gap: "gap-1.5",
        addText: "text-[11px]",
      }
    : {
        box: "size-5",
        icon: "size-3.5",
        text: "text-sm",
        gap: "gap-2",
        addText: "text-xs",
      }

  return (
    <div className="space-y-2">
      {items.length === 0 ? (
        <p className={`${sizes.text} text-muted-foreground italic`}>{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, idx) => (
            <li key={idx} className={`flex items-start ${sizes.gap}`}>
              <button
                type="button"
                onClick={() => toggleDone(idx)}
                disabled={!unlocked}
                aria-label={item.done ? "إلغاء العلامة" : "تعليم كمنجز"}
                className={`${sizes.box} rounded-md flex items-center justify-center shrink-0 transition-all border ${
                  item.done
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-card border-border-strong hover:border-primary"
                } ${!unlocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
              >
                {item.done && <Check className={`${sizes.icon}`} strokeWidth={3} />}
              </button>
              <textarea
                ref={(el) => {
                  inputRefs.current[idx] = el
                  autosize(el)
                }}
                rows={1}
                value={item.text}
                onChange={(e) => {
                  updateText(idx, e.target.value)
                  autosize(e.currentTarget)
                  broadcastTyping()
                }}
                onFocus={() => {
                  if (presenceTarget) setActive(presenceTarget, false)
                }}
                onBlur={handleBlur}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                disabled={!unlocked}
                placeholder={itemPlaceholder}
                className={`flex-1 min-w-0 bg-transparent ${sizes.text} focus:outline-none border-b border-transparent focus:border-border py-1 leading-relaxed transition-colors disabled:opacity-60 resize-none overflow-hidden break-words whitespace-pre-wrap ${
                  item.done ? "line-through text-muted-foreground" : "text-foreground"
                }`}
              />
              {unlocked && (
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  aria-label="حذف العنصر"
                  className="opacity-40 hover:opacity-100 hover:text-[var(--status-fail)] size-6 flex items-center justify-center transition-opacity shrink-0"
                >
                  <Trash2 className={`${sizes.icon}`} />
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
          className={`${sizes.addText} tag-mono flex items-center gap-1.5 text-primary hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity`}
        >
          <Plus className={`${sizes.icon}`} /> {addLabel}
        </button>
        {savePending && (
          <div className="flex items-center gap-1.5 text-[10px] tag-mono text-primary animate-pulse">
            <Loader2 className="size-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>
    </div>
  )
}
