"use client"

import { useState, useTransition } from "react"
import type { TestItem, TestSection } from "@/lib/types"
import { ChecklistItem } from "./checklist-item"
import { MessageSquareText, Plus, Minus, Loader2 } from "lucide-react"
import { updateSectionNotes } from "@/app/actions"
import { toast } from "sonner"

type Props = {
  section: TestSection
  unlocked: boolean
  onLocalUpdate: (itemId: number, patch: Partial<TestItem>) => void
  isLast?: boolean
}

export function SectionGroup({ section, unlocked, onLocalUpdate }: Props) {
  const doneCount = section.items.filter((it) => it.status !== "pending").length
  const passCount = section.items.filter((it) => it.status === "pass").length
  const failCount = section.items.filter((it) => it.status === "fail").length
  const total = section.items.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  const [notes, setNotes] = useState(section.notes ?? "")
  const [showNotes, setShowNotes] = useState(!!section.notes)
  const [savePending, startSaveTransition] = useTransition()

  const handleSaveNotes = () => {
    if (!unlocked) return
    if (notes.trim() === (section.notes?.trim() ?? "")) return

    startSaveTransition(async () => {
      const res = await updateSectionNotes(section.id, notes.trim() || null)
      if (res.ok) {
        toast.success("تم حفظ ملاحظات القسم")
      } else {
        toast.error(res.error || "فشل حفظ ملاحظات القسم")
      }
    })
  }

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="px-5 lg:px-8 py-4 bg-background/60 border-b border-border/80 flex items-center gap-4">
        <span
          className="tag-mono num-latin px-2 py-0.5 rounded-md border"
          style={{
            color: "var(--gold)",
            borderColor: "color-mix(in oklch, var(--gold) 40%, transparent)",
            background: "color-mix(in oklch, var(--gold) 8%, transparent)",
          }}
        >
          {section.section_num}
        </span>

        <h3 className="flex-1 min-w-0 font-display text-base lg:text-lg font-semibold text-foreground truncate">
          {section.title}
        </h3>

        <div className="hidden sm:flex items-center gap-4">
          {failCount > 0 && (
            <span
              className="tag-mono num-latin"
              style={{ color: "var(--status-fail)" }}
            >
              {failCount} FAIL
            </span>
          )}
          <span
            className="tag-mono num-latin"
            style={{ color: "var(--status-pass)" }}
          >
            {passCount} PASS
          </span>
          <span className="tag-mono num-latin text-muted-foreground">
            {doneCount}/{total}
          </span>
          <div className="w-24 progress-rail">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="px-5 lg:px-8 py-2.5 bg-muted/5 border-b border-border/40">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MessageSquareText className="size-3.5" />
            <span className="tag-mono text-[10px] uppercase tracking-wider">Section Notes</span>
          </div>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="size-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors border border-border"
          >
            {showNotes ? <Minus className="size-3" /> : <Plus className="size-3" />}
          </button>
        </div>

        {showNotes && (
          <div className="mt-3 animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              disabled={!unlocked || savePending}
              rows={2}
              placeholder="أضف ملاحظات عن هذا السيكشن (يتم الحفظ تلقائياً عند النقر خارج المربع)..."
              className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50 resize-y leading-relaxed transition-all"
            />
            {savePending && (
              <div className="flex justify-end">
                <div className="flex items-center gap-1.5 text-[10px] tag-mono text-primary animate-pulse">
                  <Loader2 className="size-3 animate-spin" />
                  Saving section notes...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ul className="divide-y divide-border/70">
        {section.items.map((item) => (
          <ChecklistItem
            key={item.id}
            item={item}
            unlocked={unlocked}
            onLocalUpdate={onLocalUpdate}
          />
        ))}
      </ul>
    </div>
  )
}
