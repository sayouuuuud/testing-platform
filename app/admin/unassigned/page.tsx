import { createServiceClient } from "@/lib/supabase/server"
import { normalizeProfile } from "@/lib/auth"
import type { ItemStatus, Profile, TestItem } from "@/lib/types"
import { UnassignedClient } from "@/components/admin/unassigned-client"

export const dynamic = "force-dynamic"

export default async function UnassignedPage() {
  const svc = createServiceClient()
  const [itemsRes, profilesRes] = await Promise.all([
    svc
      .from("test_items")
      .select("*")
      .is("tester_id", null)
      .neq("status", "pending")
      .order("updated_at", { ascending: false }),
    svc
      .from("profiles")
      .select("*")
      .order("registration_order", { ascending: true, nullsFirst: false }),
  ])

  const items = (itemsRes.data ?? []) as TestItem[]
  const profiles: Profile[] = ((profilesRes.data ?? []) as Record<string, unknown>[]).map(
    normalizeProfile,
  )

  return <UnassignedClient items={items} profiles={profiles} />
}

export type { ItemStatus }
