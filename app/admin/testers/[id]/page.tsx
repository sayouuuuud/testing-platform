import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeProfile } from "@/lib/auth"
import type { ActivityLogEntry, ItemStatus, Profile, TestItem, TesterStats } from "@/lib/types"
import { TesterAdminClient } from "@/components/admin/tester-admin-client"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export default async function TesterDetailPage({ params }: Params) {
  const { id } = await params
  const svc = createServiceClient()

  const { data: profileRow } = await svc.from("profiles").select("*").eq("id", id).maybeSingle()
  if (!profileRow) notFound()
  const profile: Profile = normalizeProfile(profileRow)

  const [itemsRes, statusRows, activityRes] = await Promise.all([
    svc
      .from("test_items")
      .select("*")
      .eq("tester_id", profile.id)
      .order("updated_at", { ascending: false })
      .limit(100),
    svc.from("test_items").select("status").eq("tester_id", profile.id),
    svc
      .from("activity_log")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const items = (itemsRes.data ?? []) as TestItem[]
  const activity = (activityRes.data ?? []) as ActivityLogEntry[]

  const buckets: Record<ItemStatus, number> = {
    pending: 0,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
  }
  const rows = (statusRows.data ?? []) as { status: ItemStatus }[]
  for (const r of rows) buckets[r.status]++
  const total = rows.length
  const done = buckets.pass + buckets.skip
  const stats: TesterStats = {
    total,
    pending: buckets.pending,
    pass: buckets.pass,
    fail: buckets.fail,
    blocked: buckets.blocked,
    skip: buckets.skip,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
  }

  return (
    <TesterAdminClient
      profile={profile}
      items={items}
      stats={stats}
      activity={activity}
    />
  )
}
