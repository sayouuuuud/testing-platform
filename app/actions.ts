"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { cookies, headers } from "next/headers"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { getCurrentProfile } from "@/lib/auth"
import type {
  ChatMessage,
  ItemStatus,
  Profile,
  TesterUpdate,
  TesterUpdateCategory,
  TesterUpdateItem,
} from "@/lib/types"

// Legacy cookie kept for backwards compatibility; checks below now treat
// "logged-in" as the unlock signal.
const LEGACY_EDITOR_COOKIE = "editor_unlocked"

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers (legacy-compatible API)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true when the current request is allowed to mutate data —
 *  i.e. the visitor is signed in with a profile. The shared editor
 *  password mechanism has been retired. */
export async function isEditorUnlocked(): Promise<boolean> {
  const profile = await getCurrentProfile()
  return !!profile
}

/** No-op kept so older callers don't break — sign-in is now handled by
 *  the /login page. */
export async function unlockEditor(_password: string): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: "تم استبدال كلمة المرور المشتركة بنظام الحسابات — سجّل دخول من /login" }
}

export async function lockEditor(): Promise<{ ok: boolean }> {
  const cookieStore = await cookies()
  cookieStore.delete(LEGACY_EDITOR_COOKIE)
  const supabase = await createClient()
  await supabase.auth.signOut()
  return { ok: true }
}

async function requireProfileOrThrow(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) {
    throw new Error("لازم تسجل دخول الأول")
  }
  return profile
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign-in / sign-out
// ─────────────────────────────────────────────────────────────────────────────

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) return { ok: false, error: error.message }

  // Bump last_seen for the admin dashboard.
  const profile = await getCurrentProfile()
  if (profile) {
    const svc = createServiceClient()
    await svc.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id)
  }
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function setOwnPassword(
  password: string,
  displayName?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (password.length < 6) {
    return { ok: false, error: "الباس لازم 6 حروف على الأقل" }
  }
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user) return { ok: false, error: "لازم تكون مسجل دخول" }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }

  if (displayName !== undefined) {
    const svc = createServiceClient()
    await svc
      .from("profiles")
      .update({ display_name: displayName.trim() })
      .eq("id", userData.user.id)
  }
  return { ok: true }
}

export async function updateOwnProfile(
  patch: { display_name?: string; avatar_url?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfileOrThrow()
  const svc = createServiceClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof patch.display_name === "string") {
    payload.display_name = patch.display_name.trim()
  }
  if (patch.avatar_url !== undefined) {
    payload.avatar_url = patch.avatar_url
  }
  const { error } = await svc.from("profiles").update(payload).eq("id", profile.id)
  if (error) return { ok: false, error: error.message }

  if (typeof patch.display_name === "string") {
    const newName = patch.display_name.trim()
    await svc
      .from("test_items")
      .update({ tester_name: newName })
      .eq("tester_id", profile.id)
    await svc
      .from("tester_updates")
      .update({ tester_name: newName })
      .eq("tester_id", profile.id)
  }

  revalidatePath("/profile")
  revalidatePath("/")
  return { ok: true }
}

export async function updateOwnEmail(
  newEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfileOrThrow()
  const svc = createServiceClient()
  const { error: authError } = await svc.auth.admin.updateUserById(profile.id, {
    email: newEmail,
  })
  if (authError) return { ok: false, error: authError.message }
  await svc.from("profiles").update({ email: newEmail, updated_at: new Date().toISOString() }).eq("id", profile.id)
  revalidatePath("/profile")
  return { ok: true }
}

export async function adminUpdateUserEmail(
  userId: string,
  newEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdminOrThrow()
  const svc = createServiceClient()
  const { error: authError } = await svc.auth.admin.updateUserById(userId, {
    email: newEmail,
  })
  if (authError) return { ok: false, error: authError.message }
  await svc.from("profiles").update({ email: newEmail, updated_at: new Date().toISOString() }).eq("id", userId)
  revalidatePath("/admin")
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Visit tracking (best-effort)
// ─────────────────────────────────────────────────────────────────────────────

export async function trackVisit(path: string): Promise<void> {
  try {
    const profile = await getCurrentProfile()
    const hdrs = await headers()
    const ua = hdrs.get("user-agent") ?? ""
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? ""
    const svc = createServiceClient()
    await svc.from("visits").insert({
      path,
      user_id: profile?.id ?? null,
      user_agent: ua.slice(0, 240),
      ip_hash: ip ? hashString(ip) : null,
    })
    if (profile) {
      await svc.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id)
    }
  } catch {
    // Visit tracking is best-effort.
  }
}

function hashString(s: string): string {
  // Tiny non-cryptographic hash so we don't store raw IPs.
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// ─────────────────────────────────────────────────────────────────────────────
// Test item edits
// ─────────────────────────────────────────────────────────────────────────────

export async function updateItemStatus(
  itemId: number,
  status: ItemStatus,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const { data: prev } = await supabase
      .from("test_items")
      .select("status, tester_name")
      .eq("id", itemId)
      .single()

    const patch: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
      tester_name: profile.display_name,
      tester_id: profile.id,
    }

    const { error } = await supabase
      .from("test_items")
      .update(patch)
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }

    await logActivity(profile.id, "status_change", itemId, {
      from: prev?.status ?? null,
      to: status,
    })
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
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const payload: Record<string, unknown> = {
      ...fields,
      updated_at: new Date().toISOString(),
    }
    // tester_name is always pinned to the current user's display_name
    // when they edit a row — the free-text override is no longer needed.
    payload.tester_name = profile.display_name
    payload.tester_id = profile.id
    const { error } = await supabase
      .from("test_items")
      .update(payload)
      .eq("id", itemId)

    if (error) return { ok: false, error: error.message }
    await logActivity(profile.id, "item_edit", itemId, {
      fields: Object.keys(fields),
    })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updateSectionNotes(
  sectionId: number,
  notes: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_sections")
      .update({ notes })
      .eq("id", sectionId)

    if (error) return { ok: false, error: error.message }
    await logActivity(profile.id, "section_notes_edit", null, { section_id: sectionId })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function updatePhaseNotes(
  phaseId: number,
  notes: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const { error } = await supabase
      .from("test_phases")
      .update({ notes })
      .eq("id", phaseId)

    if (error) return { ok: false, error: error.message }
    await logActivity(profile.id, "phase_notes_edit", null, { phase_id: phaseId })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

async function logActivity(
  userId: string,
  kind: string,
  itemId: number | null,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const svc = createServiceClient()
    await svc.from("activity_log").insert({
      user_id: userId,
      kind,
      item_id: itemId,
      payload,
    })
  } catch {
    // best-effort
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
      const updated_at =
        typeof obj.updated_at === "string" && obj.updated_at.length > 0
          ? obj.updated_at
          : undefined
      const item: TesterUpdateItem = { text, done }
      if (created_at) item.created_at = created_at
      if (updated_at) item.updated_at = updated_at
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
      tester_id: (row.tester_id as string) ?? null,
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
): Promise<{ ok: boolean; error?: string; update?: TesterUpdate }> {
  try {
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("tester_updates")
      .insert({
        category: normalizeCategory(category),
        tester_name: profile.display_name,
        tester_id: profile.id,
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
        tester_id: (data.tester_id as string) ?? null,
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
  patch: { items?: TesterUpdateItem[] },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const profile = await requireProfileOrThrow()
    const supabase = createServiceClient()
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (patch.items !== undefined) {
      const now = new Date().toISOString()
      // Stamp updated_at on items whose text changed.
      const existing = await supabase
        .from("tester_updates")
        .select("items")
        .eq("id", id)
        .single()
      const prevItems = normalizeItems(existing.data?.items)
      const next = patch.items.map((it, idx) => {
        const prev = prevItems[idx]
        const changed = !prev || prev.text !== it.text || prev.done !== it.done
        return {
          ...it,
          created_at: it.created_at ?? prev?.created_at ?? now,
          updated_at: changed ? now : it.updated_at ?? prev?.updated_at ?? now,
        }
      })
      payload.items = next
    }
    // Card stays attributed to its original creator. We don't relabel
    // tester_name here so the card belongs to whoever opened it.
    payload.tester_name = profile.display_name
    payload.tester_id = profile.id

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
    await requireProfileOrThrow()
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

// ─────────────────────────────────────────────────────────────────────────────
// Chat
// ─────────────────────────────────────────────────────────────────────────────

export async function listChatMessages(limit = 100): Promise<ChatMessage[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*, author:profiles!chat_messages_user_id_fkey(display_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
      .map((row) => ({
        id: row.id as number,
        user_id: row.user_id as string,
        content: (row.content as string) ?? "",
        mentions: ((row.mentions as string[]) ?? []),
        created_at: row.created_at as string,
        author: (row.author as { display_name: string; avatar_url: string | null } | null) ?? null,
      }))
      .reverse()
  } catch {
    return []
  }
}

export async function sendChatMessage(
  content: string,
  mentions: string[] = [],
): Promise<{ ok: boolean; error?: string; message?: ChatMessage }> {
  const trimmed = content.trim()
  if (!trimmed) return { ok: false, error: "اكتب رسالة الأول" }
  try {
    const profile = await requireProfileOrThrow()
    const svc = createServiceClient()
    const { data, error } = await svc
      .from("chat_messages")
      .insert({ user_id: profile.id, content: trimmed.slice(0, 2000), mentions })
      .select("*")
      .single()
    if (error || !data) return { ok: false, error: error?.message || "تعذر إرسال الرسالة" }
    return {
      ok: true,
      message: {
        id: data.id as number,
        user_id: data.user_id as string,
        content: data.content as string,
        mentions: ((data.mentions as string[]) ?? []),
        created_at: data.created_at as string,
        author: { display_name: profile.display_name, avatar_url: profile.avatar_url ?? null },
      },
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdminOrThrow(): Promise<Profile> {
  const profile = await requireProfileOrThrow()
  if (!profile.is_admin) throw new Error("الوصول للأدمن فقط")
  return profile
}

export async function inviteUser(args: {
  email: string
  display_name?: string
  is_admin?: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminOrThrow()
    const cleanEmail = args.email.trim().toLowerCase()
    if (!cleanEmail) return { ok: false, error: "اكتب الإيميل" }
    const cleanName = (args.display_name ?? "").trim()
    const svc = createServiceClient()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    let redirectTo: string | undefined
    if (siteUrl) {
      redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/set-password`
    } else {
      const hdrs = await headers()
      const proto = hdrs.get("x-forwarded-proto") ?? "https"
      const host = hdrs.get("host") ?? ""
      if (host && !host.startsWith("localhost")) {
        redirectTo = `${proto}://${host}/auth/set-password`
      }
    }

    const useCustomSmtp = !!process.env.SMTP_CONNECTION_URL

    if (useCustomSmtp) {
      const { sendInviteEmail } = await import("@/lib/mail")

      const { data: linkData, error: linkError } = await svc.auth.admin.generateLink({
        type: "invite",
        email: cleanEmail,
        options: {
          data: cleanName ? { display_name: cleanName } : undefined,
          redirectTo,
        },
      })
      if (linkError) return { ok: false, error: linkError.message }

      const tokenHash = linkData?.properties?.hashed_token
      const verType = linkData?.properties?.verification_type
      if (tokenHash) {
        const hdrs = await headers()
        const proto = hdrs.get("x-forwarded-proto") ?? "https"
        const host = hdrs.get("host") ?? ""
        const baseUrl = siteUrl?.replace(/\/$/, "") || `${proto}://${host}`
        const callbackLink = `${baseUrl}/auth/callback?token_hash=${tokenHash}&type=${verType ?? "invite"}&next=/auth/set-password`
        await sendInviteEmail(cleanEmail, callbackLink, cleanName || undefined)
      }

      if (linkData?.user && args.is_admin) {
        await svc.from("profiles").update({ is_admin: true }).eq("id", linkData.user.id)
      }
    } else {
      const { data, error } = await svc.auth.admin.inviteUserByEmail(cleanEmail, {
        data: cleanName ? { display_name: cleanName } : undefined,
        redirectTo,
      })
      if (error) return { ok: false, error: error.message }

      if (data.user && args.is_admin) {
        await svc.from("profiles").update({ is_admin: true }).eq("id", data.user.id)
      }
    }
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function adminUpdateProfile(
  userId: string,
  patch: { display_name?: string; is_admin?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminOrThrow()
    const svc = createServiceClient()
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof patch.display_name === "string") payload.display_name = patch.display_name.trim()
    if (typeof patch.is_admin === "boolean") payload.is_admin = patch.is_admin
    const { error } = await svc.from("profiles").update(payload).eq("id", userId)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/admin")
    revalidatePath(`/admin/testers/${userId}`)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

export async function adminDeleteUser(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const me = await requireAdminOrThrow()
    if (me.id === userId) return { ok: false, error: "مينفعش تحذف نفسك" }
    const svc = createServiceClient()
    const { error } = await svc.auth.admin.deleteUser(userId)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}

/** Assign a single test_item to the given tester profile. */
export async function adminAssignTester(
  itemId: number,
  newUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminOrThrow()
    const svc = createServiceClient()
    const { data: target } = await svc
      .from("profiles")
      .select("display_name")
      .eq("id", newUserId)
      .single()
    if (!target) return { ok: false, error: "اليوزر مش موجود" }
    const displayName = (target.display_name as string) ?? ""

    const { error } = await svc
      .from("test_items")
      .update({ tester_name: displayName, tester_id: newUserId })
      .eq("id", itemId)
    if (error) return { ok: false, error: error.message }

    revalidatePath("/admin")
    revalidatePath("/admin/unassigned")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "خطأ غير معروف" }
  }
}
