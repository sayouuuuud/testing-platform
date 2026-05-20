import Link from "next/link"
import { Users, BarChart3, Activity, Eye } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeProfile } from "@/lib/auth"
import type { ActivityLogEntry, ItemStatus, Profile } from "@/lib/types"
import { TimeAgo } from "@/components/time-ago"

export const dynamic = "force-dynamic"

export default async function AdminDashboard() {
  const svc = createServiceClient()

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    visitsDayRes,
    visitsWeekRes,
    itemsCountRes,
    statusRowsRes,
    profilesRes,
    activityRes,
  ] = await Promise.all([
    svc.from("visits").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    svc.from("visits").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
    svc.from("test_items").select("id", { count: "exact", head: true }),
    svc.from("test_items").select("status, tester_id"),
    svc.from("profiles").select("*").order("registration_order", { ascending: true, nullsFirst: false }),
    svc.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
  ])

  const visitsDay = visitsDayRes.count ?? 0
  const visitsWeek = visitsWeekRes.count ?? 0
  const totalItems = itemsCountRes.count ?? 0

  const statusRows = (statusRowsRes.data ?? []) as { status: ItemStatus; tester_id: string | null }[]
  const statusBuckets: Record<ItemStatus, number> = {
    pending: 0,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
  }
  for (const row of statusRows) statusBuckets[row.status]++
  const unassigned = statusRows.filter(
    (r) => r.tester_id === null && r.status !== "pending",
  ).length

  const profiles: Profile[] = ((profilesRes.data ?? []) as Record<string, unknown>[]).map(
    normalizeProfile,
  )

  const perTester = new Map<string, number>()
  for (const r of statusRows) {
    if (!r.tester_id) continue
    perTester.set(r.tester_id, (perTester.get(r.tester_id) ?? 0) + 1)
  }

  const activity = (activityRes.data ?? []) as ActivityLogEntry[]
  const profileById = new Map(profiles.map((p) => [p.id, p]))

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-1" style={{ color: "var(--gold)" }}>
          Overview
        </div>
        <h1 className="font-display text-4xl lg:text-5xl text-foreground leading-tight">
          لوحة الأدمن
        </h1>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Visits / 24h" value={visitsDay} icon={Eye} />
        <Metric label="Visits / 7d" value={visitsWeek} icon={BarChart3} />
        <Metric label="Total cases" value={totalItems} icon={Activity} color="var(--primary)" />
        <Metric label="Testers" value={profiles.length} icon={Users} color="var(--gold)" />
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniStat label="Pass" value={statusBuckets.pass} color="var(--status-pass)" />
        <MiniStat label="Fail" value={statusBuckets.fail} color="var(--status-fail)" />
        <MiniStat label="Blocked" value={statusBuckets.blocked} color="var(--status-blocked)" />
        <MiniStat label="Skip" value={statusBuckets.skip} color="var(--status-skip)" />
        <MiniStat label="Pending" value={statusBuckets.pending} color="var(--muted-foreground)" />
      </section>

      {unassigned > 0 && (
        <Link
          href="/admin/unassigned"
          className="block card-paper px-5 py-4 hover:border-primary transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div
                className="tag-mono text-[11px] uppercase"
                style={{ color: "var(--gold)" }}
              >
                Action needed
              </div>
              <div className="font-display text-lg mt-1">
                {unassigned} حالة معمول عليها تيست بدون تيستر معيّن
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                اضغط هنا لإسناد التيسترز
              </div>
            </div>
            <span className="text-2xl text-primary">←</span>
          </div>
        </Link>
      )}

      <section className="grid md:grid-cols-2 gap-5">
        <div className="card-paper p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="tag-mono text-[11px] uppercase">التيسترز</span>
            <span className="flex-1" />
            <Link
              href="/admin/users"
              className="tag-mono text-[11px] text-primary hover:opacity-80"
            >
              إدارة ←
            </Link>
          </div>

          {profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">لسه مفيش تيسترز مسجلين</p>
          ) : (
            <ul className="divide-y divide-border/70 -mx-5">
              {profiles.map((p) => (
                <li key={p.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                  <span
                    className="size-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
                    style={{
                      background: "color-mix(in oklch, var(--primary) 14%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {(p.display_name || p.email).slice(0, 1).toUpperCase()}
                  </span>
                  <Link
                    href={`/admin/testers/${p.id}`}
                    className="flex-1 min-w-0 truncate hover:text-primary transition-colors"
                  >
                    <span className="font-medium">{p.display_name || "بدون اسم"}</span>{" "}
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </Link>
                  <span className="tag-mono text-[10px] text-muted-foreground num-latin">
                    {perTester.get(p.id) ?? 0} cases
                  </span>
                  <TimeAgo iso={p.last_seen_at} className="tag-mono text-[10px] text-muted-foreground" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-paper p-5 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Activity className="size-4" />
            <span className="tag-mono text-[11px] uppercase">آخر نشاط</span>
          </div>

          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">مفيش سجل نشاط لسه</p>
          ) : (
            <ul className="divide-y divide-border/70 -mx-5">
              {activity.map((entry) => {
                const author = entry.user_id ? profileById.get(entry.user_id) : undefined
                return (
                  <li key={entry.id} className="px-5 py-2.5 flex items-center gap-3 text-sm">
                    <span
                      className="tag-mono text-[10px] uppercase px-2 py-0.5 rounded border shrink-0"
                      style={{
                        color: "var(--primary)",
                        borderColor: "color-mix(in oklch, var(--primary) 30%, transparent)",
                      }}
                    >
                      {entry.kind}
                    </span>
                    <span className="flex-1 truncate text-muted-foreground">
                      {author?.display_name ?? "—"}{" "}
                      {entry.item_id ? `· Item #${entry.item_id}` : ""}
                    </span>
                    <TimeAgo
                      iso={entry.created_at}
                      className="tag-mono text-[10px] text-muted-foreground"
                    />
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function Metric({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string
  value: number
  color?: string
  icon: typeof Eye
}) {
  return (
    <div
      className="card-paper px-5 py-4 flex items-center justify-between gap-3"
      style={color ? { borderColor: `color-mix(in oklch, ${color} 35%, var(--border))` } : undefined}
    >
      <div>
        <div
          className="tag-mono text-[10px] uppercase tracking-wider"
          style={{ color: color ?? "var(--muted-foreground)" }}
        >
          {label}
        </div>
        <div
          className="display-number num-latin text-3xl mt-1"
          style={{ color: color ?? "var(--foreground)" }}
        >
          {value}
        </div>
      </div>
      <Icon className="size-5 opacity-60" style={{ color: color ?? "var(--muted-foreground)" }} />
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="card-paper px-3 py-2.5 flex items-baseline justify-between gap-3"
      style={{ borderColor: `color-mix(in oklch, ${color} 25%, var(--border))` }}
    >
      <span className="tag-mono text-[10px]" style={{ color }}>{label}</span>
      <span className="display-number num-latin text-2xl" style={{ color }}>{value}</span>
    </div>
  )
}
