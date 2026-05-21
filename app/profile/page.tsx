import { requireProfile, normalizeProfile } from "@/lib/auth"
import { createServiceClient } from "@/lib/supabase/server"
import { ProfilePageClient } from "@/components/profile/profile-page-client"
import { ChatFab } from "@/components/chat/chat-fab"
import { listChatMessages } from "@/app/actions"
import type { ActivityLogEntry, ItemStatus, Profile, TestItem, TesterStats } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const profile = await requireProfile()
  const svc = createServiceClient()

  const [itemsRes, activityRes, chatMessages, testersRes] = await Promise.all([
    svc.from("test_items").select("*").eq("tester_id", profile.id).order("updated_at", { ascending: false }).limit(50),
    svc
      .from("activity_log")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(30),
    listChatMessages(),
    svc
      .from("profiles")
      .select("*")
      .order("registration_order", { ascending: true, nullsFirst: false }),
  ])

  const testers: Profile[] = ((testersRes.data ?? []) as Record<string, unknown>[]).map(
    normalizeProfile,
  )

  const items = (itemsRes.data ?? []) as TestItem[]
  const activity = (activityRes.data ?? []) as ActivityLogEntry[]

  // Compute the user's stats over every row they've ever edited.
  const { count: totalAuthored } = await svc
    .from("test_items")
    .select("id", { count: "exact", head: true })
    .eq("tester_id", profile.id)

  const statusBuckets: Record<ItemStatus, number> = {
    pending: 0,
    pass: 0,
    fail: 0,
    blocked: 0,
    skip: 0,
  }
  const { data: statsRows } = await svc
    .from("test_items")
    .select("status")
    .eq("tester_id", profile.id)
  for (const row of (statsRows ?? []) as { status: ItemStatus }[]) {
    statusBuckets[row.status]++
  }
  const total = totalAuthored ?? 0
  const done = statusBuckets.pass + statusBuckets.skip
  const stats: TesterStats = {
    total,
    pending: statusBuckets.pending,
    pass: statusBuckets.pass,
    fail: statusBuckets.fail,
    blocked: statusBuckets.blocked,
    skip: statusBuckets.skip,
    completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
  }

  return (
    <>
      <ProfilePageClient
        profile={profile}
        items={items}
        activity={activity}
        stats={stats}
      />
      <ChatFab
        initialMessages={chatMessages}
        profile={profile}
        testers={testers}
      />
    </>
  )
}
