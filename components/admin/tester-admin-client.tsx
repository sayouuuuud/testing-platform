"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowRight, Loader2, ShieldCheck, Trash2 } from "lucide-react"
import { adminDeleteUser, adminUpdateProfile } from "@/app/actions"
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
  stats: TesterStats
  activity: ActivityLogEntry[]
}

export function TesterAdminClient({ profile, items, stats, activity }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [isAdmin, setIsAdmin] = useState(profile.is_admin)
  const [savingProfile, startProfileTransition] = useTransition()
  const [deleting, startDeleteTransition] = useTransition()

  const handleSaveProfile = () => {
    startProfileTransition(async () => {
      const res = await adminUpdateProfile(profile.id, {
        display_name: displayName,
        is_admin: isAdmin,
      })
      if (res.ok) toast.success("اتحفظ")
      else toast.error(res.error || "فشل")
    })
  }

  const handleDelete = () => {
    if (!confirm(`متأكد إن عايز تشيل ${profile.email}؟ كل التيستات بتاعته هتفضل بس من غير ربط.`)) return
    startDeleteTransition(async () => {
      const res = await adminDeleteUser(profile.id)
      if (res.ok) {
        toast.success("اتشال")
        window.location.href = "/admin/users"
      } else {
        toast.error(res.error || "فشل الحذف")
      }
    })
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow mb-1" style={{ color: "var(--gold)" }}>
            Tester
          </div>
          <h1 className="font-display text-3xl lg:text-4xl text-foreground leading-tight flex items-center gap-3">
            {profile.display_name || profile.email}
            {profile.is_admin && (
              <ShieldCheck className="size-5" style={{ color: "var(--gold)" }} />
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{profile.email}</p>
        </div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-sm tag-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="size-4" />
          رجوع للقايمة
        </Link>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Pass" value={stats.pass} color="var(--status-pass)" />
        <StatBox label="Fail" value={stats.fail} color="var(--status-fail)" />
        <StatBox label="Blocked" value={stats.blocked} color="var(--status-blocked)" />
        <StatBox label="Skip" value={stats.skip} color="var(--status-skip)" />
        <StatBox label="Completion" value={`${stats.completionPct}%`} color="var(--primary)" />
      </section>

      <section className="card-paper p-5 space-y-4">
        <div className="tag-mono text-[11px] uppercase text-muted-foreground">
          تعديل البيانات
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="tag-mono text-[10px] text-muted-foreground block mb-1">
              اسم العرض
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
              />
              <span>أدمن</span>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {savingProfile && <Loader2 className="size-4 animate-spin" />}
            حفظ
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-md border border-[color-mix(in_oklch,var(--status-fail)_40%,transparent)] text-[var(--status-fail)] hover:bg-[color-mix(in_oklch,var(--status-fail)_8%,transparent)] px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            مسح المستخدم
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="eyebrow">حالاته</span>
          <span className="flex-1 hairline" />
          <span className="tag-mono text-[11px] text-muted-foreground num-latin">
            {items.length} item
          </span>
        </div>
        {items.length === 0 ? (
          <div className="card-paper p-8 text-center text-muted-foreground text-sm">
            مفيش حالات متعلم عليها لسه
          </div>
        ) : (
          <div className="card-paper divide-y divide-border/70">
            {items.map((item) => {
              const cfg = STATUS_CONFIG[item.status as ItemStatus]
              return (
                <div key={item.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <span
                    className="font-mono text-[11px] font-semibold num-latin px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      color: "var(--gold)",
                      background: "color-mix(in oklch, var(--gold) 10%, transparent)",
                    }}
                  >
                    {item.code}
                  </span>
                  <span className="flex-1 truncate">{item.description}</span>
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
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="eyebrow">سجل النشاط</span>
          <span className="flex-1 hairline" />
        </div>
        {activity.length === 0 ? (
          <div className="card-paper p-6 text-center text-muted-foreground text-sm">
            مفيش سجل لسه
          </div>
        ) : (
          <div className="card-paper divide-y divide-border/70">
            {activity.map((entry) => (
              <div key={entry.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
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
  )
}

function StatBox({
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
