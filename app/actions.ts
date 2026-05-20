"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import type {
  ItemStatus,
  TesterUpdate,
  TesterUpdateCategory,
  TesterUpdateItem,
} from "@/lib/types"

const EDITOR_COOKIE = "editor_unlocked"

function validatePassword(input: string) {
  const expected = process.env.EDITOR_PASSWORD
  if (!expected) return false
  return input === expected
}

export async function unlockEditor(password: string): Promise<{ ok: boolean; error?: string }> {
  if (!validatePassword(password)) {
    return { ok: false, error: "كلمة المرور غير صحيحة" }
  }

  const cookieStore = await cookies()
  cookieStore.set(EDITOR_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/",
  })

  return { ok: true }
}

export async function lockEditor(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(EDITOR_COOKIE)
  return { ok: true }
}

export async function isEditorUnlocked(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(EDITOR_COOKIE)?.value === "1"
}

async function assertUnlocked() {
  const unlocked = await isEditorUnlocked()
  if (!unlocked) {
    throw new Error("التعديل مقفول — الرجاء إدخال كلمة المرور أولاً")
  }
}

export async function updateItemStatus(
  itemId: number,
  status: ItemStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_items")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updateItemFields(
  itemId: number,
  fields: {
    notes?: string | null
    tester_name?: string | null
    error_description?: string | null
    error_code?: string | null
  },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_items")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updateSectionNotes(
  sectionId: number,
  notes: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_sections")
      .update({ notes })
      .eq("id", sectionId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updatePhaseNotes(
  phaseId: number,
  notes: string | null
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_phases")
      .update({ notes })
      .eq("id", phaseId)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tester updates (floating notepad)
// ─────────────────────────────────────────────────────────────────────────────

function normalizeItems(items: unknown): TesterUpdateItem[] {
  if (!Array.isArray(items)) return []
  const out: TesterUpdateItem[] = []
  for (const raw of items) {
    if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>
      const text = typeof obj.text === "string" ? obj.text : ""
      const done = obj.done === true
      const created_at =
        typeof obj.created_at === "string" && obj.created_at.length > 0
          ? obj.created_at
          : undefined
      const item: TesterUpdateItem = { text, done }
      if (created_at) item.created_at = created_at
      out.push(item)
    }
  }
  return out
}

function normalizeCategory(value: unknown): TesterUpdateCategory {
  return value === "general_error" ? "general_error" : "update"
}

export async function listTesterUpdates(): Promise<TesterUpdate[]> {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("tester_updates")
      .select("*")
      .order("created_at", { ascending: false })

    if (error || !data) return []
    return data.map((row) => ({
      id: row.id as number,
      category: normalizeCategory(row.category),
      tester_name: (row.tester_name as string) ?? "",
      items: normalizeItems(row.items),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    }))
  } catch {
    return []
  }
}

export async function createTesterUpdate(
  category: TesterUpdateCategory,
  testerName: string,
): Promise<{ ok: boolean; error?: string; update?: TesterUpdate }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("tester_updates")
      .insert({
        category: normalizeCategory(category),
        tester_name: testerName.trim(),
        items: [],
      })
      .select("*")
      .single()

    if (error || !data) {
      return { ok: false, error: error?.message || "تعذر إنشاء البطاقة" }
    }

    return {
      ok: true,
      update: {
        id: data.id as number,
        category: normalizeCategory(data.category),
        tester_name: (data.tester_name as string) ?? "",
        items: normalizeItems(data.items),
        created_at: data.created_at as string,
        updated_at: data.updated_at as string,
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updateTesterUpdate(
  id: number,
  patch: { tester_name?: string; items?: TesterUpdateItem[] },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (typeof patch.tester_name === "string") {
      payload.tester_name = patch.tester_name.trim()
    }
    if (patch.items !== undefined) {
      payload.items = normalizeItems(patch.items)
    }

    const { error } = await supabase
      .from("tester_updates")
      .update(payload)
      .eq("id", id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function deleteTesterUpdate(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertUnlocked()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("tester_updates")
      .delete()
      .eq("id", id)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}
