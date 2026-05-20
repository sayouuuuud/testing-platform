import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/auth"
import {
  listTesterUpdates,
  listChatMessages,
  trackVisit,
} from "./actions"
import type { Profile, TestPhase, TestSection, TestItem } from "@/lib/types"
import { ChecklistApp } from "@/components/checklist-app"
import { normalizeProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function Page() {
  const supabase = await createClient()
  const profile = await getCurrentProfile()

  const [phasesRes, sectionsRes, itemsRes, testerUpdates, chatMessages, testersRes] = await Promise.all([
    supabase.from("test_phases").select("*").order("order_num", { ascending: true }),
    supabase.from("test_sections").select("*").order("order_num", { ascending: true }),
    supabase.from("test_items").select("*").order("order_num", { ascending: true }),
    listTesterUpdates(),
    profile ? listChatMessages() : Promise.resolve([]),
    profile
      ? createServiceClient()
          .from("profiles")
          .select("*")
          .order("registration_order", { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  const phases = (phasesRes.data ?? []) as Omit<TestPhase, "sections">[]
  const sections = (sectionsRes.data ?? []) as Omit<TestSection, "items">[]
  const items = (itemsRes.data ?? []) as TestItem[]

  const phasesNested: TestPhase[] = phases.map((p) => ({
    ...p,
    sections: sections
      .filter((s) => s.phase_id === p.id)
      .map((s) => ({
        ...s,
        items: items.filter((i) => i.section_id === s.id),
      })),
  }))

  const testers: Profile[] = ((testersRes.data ?? []) as Record<string, unknown>[]).map(
    normalizeProfile,
  )

  // Track this visit without blocking the render.
  void trackVisit("/")

  return (
    <ChecklistApp
      initialPhases={phasesNested}
      initialTesterUpdates={testerUpdates}
      initialChatMessages={chatMessages}
      profile={profile}
      testers={testers}
    />
  )
}
