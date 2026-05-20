"use client"

import { useMemo, useState } from "react"
import { ChevronDown, MessageSquareText, Plus, Minus } from "lucide-react"
import type { ItemStatus, TestItem, TestPhase } from "@/lib/types"
import { PHASE_LABELS } from "@/lib/status-config"
import { SectionGroup } from "./section-group"
import { updatePhaseNotes } from "@/app/actions"
import { NotesChecklist } from "./notes-checklist"
import { usePhaseNotesPresence } from "./presence/item-presence-context"
import { EditingBadge } from "./presence/editing-badge"

type Props = {
  phase: TestPhase
  unlocked: boolean
  statusFilter: ItemStatus | "all"
  query: string
  onLocalUpdate: (itemId: number, patch: Partial<TestItem>) => void
}

export function PhaseCard({
  phase,
  unlocked,
  statusFilter,
  query,
  onLocalUpdate,
}: Props) {
  // `userOpen` reflects what the user explicitly chose. Filtering may
  // *display* the phase as open without mutating this — see displayOpen.
  const [userOpen, setUserOpen] = useState(false)
  const [showNotes, setShowNotes] = useState(!!phase.notes)

  const kicker = PHASE_LABELS[phase.color_key]?.kicker ?? "MODULE"

  const isFiltering = statusFilter !== "all" || query.trim() !== ""

  const { total, done, pass, fail, pct, filteredSections } = useMemo(() => {
    let total = 0,
      done = 0,
      pass = 0,
      fail = 0
    for (const sec of phase.sections) {
      for (const it of sec.items) {
        total++
        if (it.status !== "pending") done++
        if (it.status === "pass") pass++
        if (it.status === "fail") fail++
      }
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0

    const q = query.trim().toLowerCase()
    const filteredSections = phase.sections
      .map((sec) => {
        const items = sec.items.filter((it) => {
          if (statusFilter !== "all" && it.status !== statusFilter) return false
          if (q) {
            const hay = `${it.code} ${it.description}`.toLowerCase()
            if (!hay.includes(q)) return false
          }
          return true
        })
        return { ...sec, items }
      })
      .filter((sec) => sec.items.length > 0)

    return { total, done, pass, fail, pct, filteredSections }
  }, [phase.sections, statusFilter, query])

  const hidden = filteredSections.length === 0 && isFiltering

  // When filtering is active and this phase has matching sections, surface
  // them automatically — but only *display* it as open. We never mutate the
  // user's chosen state, so clearing the filter returns each phase to its
  // pre-filter open/closed state.
  const displayOpen = userOpen || (isFiltering && filteredSections.length > 0)

  if (hidden) return null

  const chapterNum = String(phase.order_num).padStart(2, "0")

  return (
    <article className="card-paper overflow-hidden">
      {/* ── Editorial chapter header ── */}
      <header
        role="button"
        tabIndex={0}
        aria-expanded={displayOpen}
        onClick={() => setUserOpen(() => !displayOpen)}
        onKeyDown={(e) =>
          (e.key === "Enter" || e.key === " ") && setUserOpen(() => !displayOpen)
        }
        className="w-full cursor-pointer select-none transition-colors hover:bg-muted/50"
      >
        <div className="flex items-stretch">
          {/* Giant phase number */}
          <div
            className="shrink-0 flex flex-col items-center justify-center border-l border-border px-5 lg:px-8 py-6 lg:py-8"
            style={{
              background: "color-mix(in oklch, var(--primary) 4%, var(--card))",
            }}
          >
            <div className="eyebrow mb-1.5" style={{ color: "var(--gold)" }}>
              Phase
            </div>
            <div
              className="display-number num-latin text-primary"
              style={{ fontSize: "clamp(2.5rem, 5vw, 3.75rem)" }}
            >
              {chapterNum}
            </div>
          </div>

          {/* Title + goal */}
          <div className="flex-1 min-w-0 px-5 lg:px-7 py-6 lg:py-7 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="tag-mono" style={{ color: "var(--gold)" }}>
                {kicker}
              </span>
              <span className="hidden sm:inline size-1 rounded-full bg-border-strong" />
              <span className="tag-mono text-muted-foreground num-latin">
                {phase.sections.length} sections · {total} items
              </span>
            </div>
            <h2 className="font-display text-xl lg:text-2xl font-semibold text-foreground leading-tight text-pretty">
              {phase.title}
            </h2>
            {phase.goal && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2 max-w-2xl">
                {phase.goal}
              </p>
            )}
          </div>

          {/* Right-side meta (mini stats + circle + chevron) */}
          <div className="shrink-0 flex items-center gap-4 lg:gap-6 px-4 lg:px-6 border-r border-border">
            <div className="hidden md:flex items-center gap-5">
              <MiniStat label="تم" value={done} color="var(--primary)" />
              <MiniStat label="نجح" value={pass} color="var(--status-pass)" />
              {fail > 0 && (
                <MiniStat label="فشل" value={fail} color="var(--status-fail)" />
              )}
            </div>

            <div className="relative flex items-center justify-center">
              <CircleProgress pct={pct} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="display-number num-latin text-foreground text-base leading-none">
                  {pct}
                  <span className="text-[0.55em] text-muted-foreground ms-0.5">%</span>
                </span>
              </div>
            </div>

            <ChevronDown
              className={`size-5 text-muted-foreground transition-transform duration-300 ${
                displayOpen ? "rotate-180" : ""
              }`}
            />
          </div>
        </div>

        {/* Baseline progress */}
        <div
          className="rounded-none"
          style={{
            height: 3,
            background: "color-mix(in oklch, var(--foreground) 6%, transparent)",
          }}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(to left, var(--primary), color-mix(in oklch, var(--primary) 55%, var(--gold)))",
              transition: "width .8s cubic-bezier(.22,1,.36,1)",
            }}
          />
        </div>
      </header>

      {/* ── Expanded body ── */}
      {displayOpen && (
        <div className="border-t border-border bg-[color-mix(in_oklch,var(--background)_50%,var(--card))]">
          <div className="px-5 lg:px-8 py-3 border-b border-border/50 bg-muted/10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MessageSquareText className="size-4" />
                <span className="tag-mono text-[11px] uppercase tracking-wider">Phase Notes</span>
                <PhaseNotesPresenceBadge phaseId={phase.id} />
              </div>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="size-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors border border-border"
                title={showNotes ? "إخفاء الملاحظات" : "إضافة/تعديل ملاحظات"}
              >
                {showNotes ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
              </button>
            </div>

            {showNotes && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <NotesChecklist
                  initialValue={phase.notes}
                  unlocked={unlocked}
                  onSave={(value) => updatePhaseNotes(phase.id, value)}
                  addLabel="إضافة ملاحظة للمرحلة"
                  emptyLabel="لا توجد ملاحظات بعد — أضف أول عنصر لتتبع ما يخص هذه المرحلة"
                  presenceTarget={{ kind: "phase_notes", id: phase.id }}
                />
              </div>
            )}
          </div>
          <div className="divide-y divide-border/80">
            {filteredSections.map((section, idx) => (
              <SectionGroup
                key={section.id}
                section={section}
                unlocked={unlocked}
                onLocalUpdate={onLocalUpdate}
                isLast={idx === filteredSections.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </article>
  )
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex flex-col items-end leading-none">
      <span className="display-number num-latin text-xl" style={{ color }}>
        {value}
      </span>
      <span className="tag-mono text-muted-foreground mt-1">{label}</span>
    </div>
  )
}

function CircleProgress({ pct }: { pct: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <svg width="58" height="58" viewBox="0 0 58 58" className="-rotate-90">
      <circle
        cx="29"
        cy="29"
        r={r}
        fill="none"
        stroke="color-mix(in oklch, var(--foreground) 10%, transparent)"
        strokeWidth="3"
      />
      <circle
        cx="29"
        cy="29"
        r={r}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }}
      />
    </svg>
  )
}

function PhaseNotesPresenceBadge({ phaseId }: { phaseId: number }) {
  const entries = usePhaseNotesPresence(phaseId)
  return <EditingBadge entries={entries} />
}
