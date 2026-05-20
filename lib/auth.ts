import { redirect } from "next/navigation"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { Profile } from "@/lib/types"

/** Returns the currently signed-in profile or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return null

  // Fetch the profile row via the service client so we always see it
  // (RLS is read-public but RSC sessions can be flaky during invite flow).
  const svc = createServiceClient()
  const { data: profile } = await svc
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  if (!profile) return null
  return normalizeProfile(profile)
}

/** Redirects to /login when the user is signed out. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  return profile
}

/** Redirects to / when the user isn't an admin. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (!profile.is_admin) redirect("/")
  return profile
}

export function normalizeProfile(row: Record<string, unknown>): Profile {
  return {
    id: row.id as string,
    email: (row.email as string) ?? "",
    display_name: (row.display_name as string) ?? "",
    is_admin: row.is_admin === true,
    registration_order: (row.registration_order as number) ?? null,
    avatar_url: (row.avatar_url as string) ?? null,
    last_seen_at: (row.last_seen_at as string) ?? null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}
