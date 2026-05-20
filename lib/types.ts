export type ItemStatus = "pending" | "pass" | "fail" | "blocked" | "skip"

export interface TestItem {
  id: number
  section_id: number
  code: string
  order_num: number
  description: string
  status: ItemStatus
  notes: string | null
  tester_name: string | null
  error_description: string | null
  error_code: string | null
  updated_at: string
  created_at: string
}

export interface TestSection {
  id: number
  phase_id: number
  section_num: string
  title: string
  order_num: number
  notes: string | null
  items: TestItem[]
}

export interface TestPhase {
  id: number
  order_num: number
  title: string
  goal: string | null
  color_key: string
  notes: string | null
  sections: TestSection[]
}

export interface TesterUpdateItem {
  text: string
  done: boolean
  /** ISO timestamp of when this item was first added. Optional for
   *  backward compatibility with rows that were stored before this
   *  field existed. */
  created_at?: string
}

export type TesterUpdateCategory = "update" | "general_error"

export interface TesterUpdate {
  id: number
  category: TesterUpdateCategory
  tester_name: string
  items: TesterUpdateItem[]
  created_at: string
  updated_at: string
}
