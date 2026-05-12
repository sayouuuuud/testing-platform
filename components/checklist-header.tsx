"use client"

import { useState, useTransition, useEffect } from "react"
import { Lock, LockOpen, Search, X, FileDown, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useTheme } from "next-themes"
import { lockEditor, unlockEditor } from "@/app/actions"
import { toast } from "sonner"
import type { ItemStatus, TestPhase } from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/status-config"
import { generateMarkdownReport, downloadMarkdown } from "@/lib/export-utils"

type Stats = {
  pending: number
  pass: number
  fail: number
  blocked: number
  skip: number
  total: number
  done: number
  completionPct: number
}

type Props = {
  stats: Stats
  unlocked: boolean
  onUnlockChange: (next: boolean) => void
  statusFilter: ItemStatus | "all"
  onStatusFilterChange: (s: ItemStatus | "all") => void
  query: string
  onQueryChange: (q: string) => void
  phases: TestPhase[]
}

export function ChecklistHeader({
  stats,
  unlocked,
  onUnlockChange,
  statusFilter,
  onStatusFilterChange,
  query,
  onQueryChange,
  phases,
}: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [pending, startTransition] = useTransition()
  const [exporting, setExporting] = useState(false)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleExport = () => {
    setExporting(true)
    try {
      const md = generateMarkdownReport(phases)
      downloadMarkdown(md)
      toast.success("تم تصدير التقرير بصيغة Markdown ✅")
    } catch {
      toast.error("حدث خطأ أثناء التصدير")
    } finally {
      setExporting(false)
    }
  }

  const handleUnlock = () => {
    startTransition(async () => {
      const res = await unlockEditor(password)
      if (res.ok) {
        onUnlockChange(true)
        setDialogOpen(false)
        setPassword("")
        toast.success("تم فتح وضع التعديل")
      } else {
        toast.error(res.error || "كلمة المرور غير صحيحة")
      }
    })
  }

  const handleLock = () => {
    startTransition(async () => {
      await lockEditor()
      onUnlockChange(false)
      toast.success("تم قفل التعديل")
    })
  }

  const statusPills: { key: ItemStatus; count: number }[] = [
    { key: "pass", count: stats.pass },
    { key: "fail", count: stats.fail },
    { key: "blocked", count: stats.blocked },
    { key: "skip", count: stats.skip },
    { key: "pending", count: stats.pending },
  ]

  return (
    <header className="relative">
      {/* Top meta bar — editorial masthead */}
      <div className="border-b border-border">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 h-11 flex items-center justify-between">
          <div className="flex items-center gap-3 tag-mono text-muted-foreground">
            <span className="font-semibold text-foreground">ITQ</span>
            <span className="text-border-strong">·</span>
            <span>Testing Journal</span>
            <span className="hidden sm:inline text-border-strong">·</span>
            <span className="hidden sm:inline">Platform</span>
          </div>
          <div className="flex items-center gap-3 tag-mono">
            <span className="flex items-center gap-2" style={{ color: "var(--status-pass)" }}>
              <span
                className="size-1.5 rounded-full pulse-dot"
                style={{ background: "var(--status-pass)" }}
              />
              LIVE
            </span>
            <span className="hidden sm:inline text-border-strong">·</span>
            <span className="hidden sm:inline text-muted-foreground num-latin">
              {stats.total} items
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          HERO — editorial magazine spread
          ═══════════════════════════════════════════════════════════ */}
      <div className="relative">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 pt-14 pb-16 lg:pt-20 lg:pb-20">
          {/* Issue line */}
          <div className="flex items-center gap-4 mb-10">
            <span className="tag-mono" style={{ color: "var(--gold)" }}>
              Vol. 01 — Issue 001
            </span>
            <span className="flex-1 h-px bg-border" />
            <span className="tag-mono text-muted-foreground">
              {new Date().toLocaleDateString("en-GB", {
                year: "numeric",
                month: "short",
                day: "2-digit",
              })}
            </span>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* ── LEFT: Masthead title + giant number ── */}
            <div className="lg:col-span-7 flex flex-col">
              <h1 className="font-display display-hero text-foreground text-[clamp(2.5rem,7vw,5.5rem)]">
                سجلّ الاختبار
                <br />
                <span className="text-gradient-emerald italic">Platform.</span>
              </h1>

              <p className="mt-6 max-w-lg text-base lg:text-lg leading-relaxed text-muted-foreground">
                تتبُّع لحظي لجميع بنود الاختبار عبر{" "}
                <span className="font-semibold text-foreground">{phases.length} مرحلة</span> —
                كل تحديث ينعكس فوراً لكل المختبرين المتصلين.
              </p>

              <div className="mt-10 gold-rule w-24" />

              {/* Giant completion stat */}
              <div className="mt-8 flex items-end gap-6">
                <div>
                  <div className="eyebrow mb-3">نسبة الإنجاز</div>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="display-number text-foreground num-latin"
                      style={{ fontSize: "clamp(5rem,14vw,9rem)" }}
                    >
                      {String(stats.completionPct).padStart(2, "0")}
                    </span>
                    <span
                      className="font-display font-semibold num-latin"
                      style={{
                        fontSize: "clamp(2rem,5vw,3.5rem)",
                        color: "var(--gold)",
                      }}
                    >
                      %
                    </span>
                  </div>
                </div>

                <div className="flex-1 pb-4">
                  <div className="tag-mono text-muted-foreground mb-2 num-latin">
                    {stats.done} / {stats.total} items completed
                  </div>
                  <div className="progress-rail">
                    <div
                      className="progress-fill"
                      style={{ width: `${stats.completionPct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT: Status breakdown panel ── */}
            <aside className="lg:col-span-5">
              <div className="card-paper overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
                  <span className="eyebrow">Status Breakdown</span>
                  {statusFilter !== "all" && (
                    <span
                      className="tag-mono num-latin px-2 py-0.5 rounded-md"
                      style={{
                        color: STATUS_CONFIG[statusFilter].color,
                        background: `color-mix(in oklch, ${STATUS_CONFIG[statusFilter].color} 12%, transparent)`,
                      }}
                    >
                      filtering · {STATUS_CONFIG[statusFilter].label}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-border/70">
                  {statusPills.map(({ key, count }) => {
                    const cfg = STATUS_CONFIG[key]
                    const active = statusFilter === key
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <button
                        key={key}
                        onClick={() => onStatusFilterChange(active ? "all" : key)}
                        className={`group w-full flex items-center gap-4 px-5 py-4 text-right transition-colors ${
                          active
                            ? "bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <span
                          aria-hidden
                          className="size-2.5 rounded-full shrink-0 transition-transform group-hover:scale-125"
                          style={{ background: cfg.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-3 mb-2">
                            <span className="font-medium text-foreground">
                              {cfg.label}
                            </span>
                            <span
                              className="display-number num-latin text-2xl"
                              style={{ color: cfg.color }}
                            >
                              {count}
                            </span>
                          </div>
                          <div
                            className="h-[3px] rounded-full overflow-hidden"
                            style={{ background: "color-mix(in oklch, var(--foreground) 6%, transparent)" }}
                          >
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: cfg.color }}
                            />
                          </div>
                        </div>
                        <span className="tag-mono text-muted-foreground num-latin tabular-nums w-10 text-left">
                          {pct}%
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tiny caption */}
              <p className="tag-mono text-muted-foreground mt-3 px-1 text-start">
                اضغط أي حالة لعرض بنودها فقط · اضغط مرة أخرى للعودة
              </p>
            </aside>
          </div>
        </div>
      </div>

      {/* Sticky bar */}
      <div className="sticky top-0 z-40 border-y border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1320px] px-6 lg:px-10 py-3 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 -translate-y-1/2 right-3.5 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث بالكود أو النص..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full bg-card border border-border rounded-md py-2.5 px-4 pr-10 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-md border-border-strong hover:text-primary transition-all size-10 shrink-0 bg-transparent"
              title="تغيير المظهر"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          )}

          {/* Export button */}
          <Button
            onClick={handleExport}
            disabled={exporting}
            variant="outline"
            className="gap-2 rounded-md border-border-strong hover:border-emerald-500 hover:text-emerald-500 transition-all px-4 h-10 bg-transparent shrink-0"
            title="تصدير التقرير كملف Markdown"
          >
            <FileDown className="size-4" />
            <span className="tag-mono hidden sm:inline">تصدير .md</span>
          </Button>

          {unlocked ? (
            <Button
              onClick={handleLock}
              disabled={pending}
              className="gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 h-10"
            >
              <LockOpen className="size-4" />
              <span className="tag-mono">محرّر مفعّل</span>
            </Button>
          ) : (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="gap-2 rounded-md border-border-strong hover:border-primary hover:text-primary transition-all px-5 h-10 bg-transparent"
                >
                  <Lock className="size-4" />
                  <span className="tag-mono">فتح التعديل</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-lg" dir="rtl">
                <DialogHeader>
                  <div className="eyebrow" style={{ color: "var(--gold)" }}>
                    Authorization
                  </div>
                  <DialogTitle className="font-display text-3xl mt-2">
                    فتح وضع التعديل
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground leading-relaxed">
                    أدخل كلمة المرور المشتركة لتتمكن من تحديث حالات البنود وإضافة ملاحظات.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 pt-4">
                  <Label htmlFor="editor-password" className="tag-mono text-muted-foreground">
                    Password
                  </Label>
                  <input
                    id="editor-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
                    className="w-full bg-background border border-border rounded-md px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    autoFocus
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button
                    onClick={handleUnlock}
                    disabled={pending || !password}
                    className="w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                  >
                    تأكيد الدخول
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
    </header>
  )
}
