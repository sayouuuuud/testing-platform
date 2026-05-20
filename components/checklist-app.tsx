"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { TestItem, TestPhase, ItemStatus, TesterUpdate } from "@/lib/types"
import { ChecklistHeader } from "./checklist-header"
import { PhaseCard } from "./phase-card"
import { TesterUpdatesFab } from "./tester-updates-fab"

type Props = {
  initialPhases: TestPhase[]
  initialUnlocked: boolean
  initialTesterUpdates: TesterUpdate[]
}

export function ChecklistApp({
  initialPhases,
  initialUnlocked,
  initialTesterUpdates,
}: Props) {
  const [phases, setPhases] = useState<TestPhase[]>(initialPhases)
  const [unlocked, setUnlocked] = useState(initialUnlocked)
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all")
  const [query, setQuery] = useState("")

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("test_items_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "test_items" },
        (payload: { new: Record<string, unknown> }) => {
          const updated = payload.new as unknown as TestItem
          setPhases((prev) =>
            prev.map((ph) => ({
              ...ph,
              sections: ph.sections.map((sec) => ({
                ...sec,
                items: sec.items.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)),
              })),
            })),
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const allItems = useMemo(
    () => phases.flatMap((p) => p.sections.flatMap((s) => s.items)),
    [phases],
  )

  const stats = useMemo(() => {
    const base: Record<ItemStatus, number> = {
      pending: 0,
      pass: 0,
      fail: 0,
      blocked: 0,
      skip: 0,
    }
    for (const it of allItems) base[it.status]++
    const total = allItems.length
    const done = base.pass + base.skip
    const completionPct = total > 0 ? Math.round((done / total) * 100) : 0
    return { ...base, total, done, completionPct }
  }, [allItems])

  const handleLocalUpdate = (itemId: number, patch: Partial<TestItem>) => {
    setPhases((prev) =>
      prev.map((ph) => ({
        ...ph,
        sections: ph.sections.map((sec) => ({
          ...sec,
          items: sec.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
        })),
      })),
    )
  }

  return (
    <div className="min-h-screen paper-bg">
      <ChecklistHeader
        stats={stats}
        unlocked={unlocked}
        onUnlockChange={setUnlocked}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        query={query}
        onQueryChange={setQuery}
        phases={phases}
      />

      <main className="mx-auto max-w-[1320px] px-4 lg:px-10 py-10 lg:py-14">
        <div className="flex items-center gap-4 mb-6">
          <span className="eyebrow">Chapters</span>
          <span className="flex-1 hairline" />
          <span className="tag-mono text-muted-foreground num-latin">
            {phases.length} phases
          </span>
        </div>

        <div className="space-y-5">
          {phases.map((phase, idx) => (
            <div
              key={phase.id}
              className="rise-in"
              style={{ animationDelay: `${Math.min(idx * 60, 360)}ms` }}
            >
              <PhaseCard
                phase={phase}
                unlocked={unlocked}
                statusFilter={statusFilter}
                query={query}
                onLocalUpdate={handleLocalUpdate}
              />
            </div>
          ))}
        </div>
      </main>

      {/* Footer — editorial colophon */}
      <footer className="border-t border-border mt-16 bg-card">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 py-12 lg:py-16">
          <div className="gold-rule w-16 mb-8" />
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-6 space-y-4">
              <div className="eyebrow" style={{ color: "var(--gold)" }}>
                Colophon
              </div>
              <h3 className="font-display text-3xl lg:text-4xl text-foreground leading-tight text-balance">
                منصة تتبع الاختبار الشاملة — تحديث لحظي لجميع المختبرين
              </h3>
              <p className="text-muted-foreground leading-relaxed max-w-md">
                كل تحديث يُبث فوراً لكل من يفتحون المنصة. التعديل محمي بكلمة مرور
                مشتركة على السيرفر.
              </p>
            </div>

            <div className="lg:col-span-3">
              <div className="eyebrow mb-3">Status</div>
              <div
                className="flex items-center gap-2 tag-mono"
                style={{ color: "var(--status-pass)" }}
              >
                <span
                  className="size-1.5 rounded-full pulse-dot"
                  style={{ background: "var(--status-pass)" }}
                />
                Realtime sync active
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mt-3">
                Supabase Realtime channel
                <br />
                table: <span className="font-mono">test_items</span>
              </p>
            </div>

            <div className="lg:col-span-3">
              <div className="eyebrow mb-3">Issue</div>
              <p className="font-display text-2xl text-foreground">Vol. 01</p>
              <p className="tag-mono text-muted-foreground mt-1">Platform — 001</p>
              <p className="tag-mono text-muted-foreground mt-6 num-latin">
                © {new Date().getFullYear()} ITQ Platform
              </p>
            </div>
          </div>
        </div>
      </footer>

      <TesterUpdatesFab
        initialUpdates={initialTesterUpdates}
        unlocked={unlocked}
      />
    </div>
  )
}
