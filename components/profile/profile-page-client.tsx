"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowRight, Loader2, ShieldCheck, User } from "lucide-react"
import { updateOwnProfile, setOwnPassword } from "@/app/actions"
import { TimeAgo } from "@/components/time-ago"
import type {
  ActivityLogEntry,
  ItemStatus,
  Profile,
  TestItem,
  TesterStats,
} from "@/lib/types"
import { STATUS_CONFIG } from "@/lib/status-config"

type Props = {
  profile: Profile
  items: TestItem[]
  activity: ActivityLogEntry[]
  stats: TesterStats
}

export function ProfilePageClient({ profile, items, activity, stats }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [savingName, startNameTransition] = useTransition()
  const [newPassword, setNewPassword] = useState("")
  const [savingPass, startPassTransition] = useTransition()

  const handleSaveName = () => {
    startNameTransition(async () => {
      const res = await updateOwnProfile({ display_name: displayName })
      if (res.ok) toast.success("اتحفظ الاسم")
      else toast.error(res.error || "فشل الحفظ")
    })
  }

  const handleSavePass = () => {
    if (newPassword.length < 6) {
      toast.error("الباس لازم 6 حروف على الأقل")
      return
    }
    startPassTransition(async () => {
      const res = await setOwnPassword(newPassword)
      if (res.ok) {
        toast.success("تم تغيير الباس")
        setNewPassword("")
      } else {
        toast.error(res.error || "فشل التغيير")
      }
    })
  }

  return (
    <main className="min-h-screen paper-bg" dir="rtl">
      <div className="mx-auto max-w-[1100px] px-5 lg:px-10 py-8 lg:py-12 space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="eyebrow mb-1" style={{ color: "var(--gold)" }}>
              Profile
            </div>
            <h1 className="font-display text-3xl lg:text-5xl text-foreground leading-[1.05]">
              البروفايل بتاعك
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {profile.email}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm tag-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="size-4" />
            رجوع للوحة
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pass" value={stats.pass} color="var(--status-pass)" />
          <StatCard label="Fail" value={stats.fail} color="var(--status-fail)" />
          <StatCard label="Blocked" value={stats.blocked} color="var(--status-blocked)" />
          <StatCard label="Skip" value={stats.skip} color="var(--status-skip)" />
          <StatCard label="Completion" value={`${stats.completionPct}%`} color="var(--primary)" />
        </div>

        {/* Settings */}
        <section className="grid md:grid-cols-2 gap-5">
          <div className="card-paper p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="size-4" />
              <span className="tag-mono text-[11px] uppercase">بياناتي</span>
            </div>
            <div className="space-y-2">
              <label className="tag-mono text-muted-foreground block">الاسم اللي يظهر للناس</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <button
              onClick={handleSaveName}
              disabled={savingName || displayName === profile.display_name}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {savingName && <Loader2 className="size-4 animate-spin" />}
              حفظ الاسم
            </button>
            {profile.is_admin && (
              <div
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] tag-mono border"
                style={{
                  color: "var(--gold)",
                  borderColor: "color-mix(in oklch, var(--gold) 35%, transparent)",
                  background: "color-mix(in oklch, var(--gold) 8%, transparent)",
                }}
              >
                <ShieldCheck className="size-3" />
                Admin
              </div>
            )}
          </div>

          <div className="card-paper p-5 space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="tag-mono text-[11px] uppercase">تغيير الباس</span>
            </div>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="باس جديد (6+ حروف)"
              className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              onClick={handleSavePass}
              disabled={savingPass || !newPassword}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {savingPass && <Loader2 className="size-4 animate-spin" />}
              تحديث الباس
            </button>
          </div>
        </section>

        {/* Recent items */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow">آخر التحديثات بتاعتك</span>
            <span className="flex-1 hairline" />
            <span className="tag-mono text-muted-foreground num-latin text-[11px]">
              {items.length} item
            </span>
          </div>

          {items.length === 0 ? (
            <div className="card-paper p-8 text-center text-muted-foreground text-sm">
              لسه مفيش حالات معدّل عليها
            </div>
          ) : (
            <div className="card-paper divide-y divide-border/70">
              {items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {/* Activity */}
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="eyebrow">سجل النشاط</span>
            <span className="flex-1 hairline" />
            <span className="tag-mono text-muted-foreground num-latin text-[11px]">
              {activity.length} event
            </span>
          </div>

          {activity.length === 0 ? (
            <div className="card-paper p-8 text-center text-muted-foreground text-sm">
              لسه مفيش سجل نشاط
            </div>
          ) : (
            <div className="card-paper divide-y divide-border/70">
              {activity.map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span
                    className="tag-mono text-[10px] uppercase px-2 py-0.5 rounded border"
                    style={{
                      color: "var(--primary)",
                      borderColor: "color-mix(in oklch, var(--primary) 30%, transparent)",
                    }}
                  >
                    {entry.kind}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground">
                    {entry.item_id ? `Item #${entry.item_id}` : "—"}
                  </span>
                  <TimeAgo
                    iso={entry.created_at}
                    className="tag-mono text-[10px] text-muted-foreground"
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number | string
  color?: string
}) {
  return (
    <div
      className="card-paper px-4 py-3 flex flex-col gap-1"
      style={color ? { borderColor: `color-mix(in oklch, ${color} 35%, var(--border))` } : undefined}
    >
      <span
        className="tag-mono text-[10px] uppercase tracking-wider"
        style={{ color: color ?? "var(--muted-foreground)" }}
      >
        {label}
      </span>
      <span
        className="display-number num-latin text-3xl"
        style={{ color: color ?? "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  )
}

function ItemRow({ item }: { item: TestItem }) {
  const cfg = STATUS_CONFIG[item.status as ItemStatus]
  return (
    <div className="px-4 py-3 flex items-center gap-3 text-sm">
      <span
        className="font-mono text-[11px] font-semibold num-latin px-1.5 py-0.5 rounded shrink-0"
        style={{
          color: "var(--gold)",
          background: "color-mix(in oklch, var(--gold) 10%, transparent)",
        }}
      >
        {item.code}
      </span>
      <span className="flex-1 truncate text-foreground/80">{item.description}</span>
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
      <TimeAgo iso={item.updated_at} className="tag-mono text-[10px] text-muted-foreground" />
    </div>
  )
}
