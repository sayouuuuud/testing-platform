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
  tester_id: string | null
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
  /** ISO timestamp of the last time this item's text or status was
   *  edited. Optional for backward compatibility. */
  updated_at?: string
}

export type TesterUpdateCategory = "update" | "general_error"

export interface TesterUpdate {
  id: number
  category: TesterUpdateCategory
  tester_name: string
  tester_id: string | null
  items: TesterUpdateItem[]
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  display_name: string
  is_admin: boolean
  registration_order: number | null
  avatar_url: string | null
  last_seen_at: string | null
  created_at: string
}

export interface ChatMessage {
  id: number
  user_id: string
  content: string
  mentions: string[]
  created_at: string
  /** Joined display_name + avatar from profiles. */
  author?: {
    display_name: string
    avatar_url: string | null
  } | null
}

export interface ActivityLogEntry {
  id: number
  user_id: string | null
  kind: string
  item_id: number | null
  payload: Record<string, unknown>
  created_at: string
}

export interface TesterStats {
  total: number
  pass: number
  fail: number
  blocked: number
  skip: number
  pending: number
  completionPct: number
}
