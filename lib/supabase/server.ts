import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: THIRTY_DAYS_SECONDS,
              }),
            )
          } catch {
            // Server Components cannot set cookies; safely ignored.
          }
        },
      },
    },
  )
}

/**
 * Privileged server-only client that bypasses RLS.
 * Never import this into a client component.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set")
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: {
      getAll() {
        return []
      },
      setAll() {},
    },
  })
}
