import { createClient } from "@/lib/supabase/server"
import { isEditorUnlocked, listTesterUpdates } from "./actions"
import type { TestPhase, TestSection, TestItem } from "@/lib/types"
import { ChecklistApp } from "@/components/checklist-app"

export const dynamic = "force-dynamic"

export default async function Page() {
  const supabase = await createClient()
  const unlocked = await isEditorUnlocked()

  const [phasesRes, sectionsRes, itemsRes, testerUpdates] = await Promise.all([
    supabase.from("test_phases").select("*").order("order_num", { ascending: true }),
    supabase.from("test_sections").select("*").order("order_num", { ascending: true }),
    supabase.from("test_items").select("*").order("order_num", { ascending: true }),
    listTesterUpdates(),
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

  return (
    <ChecklistApp
      initialPhases={phasesNested}
      initialUnlocked={unlocked}
      initialTesterUpdates={testerUpdates}
    />
  )
}
