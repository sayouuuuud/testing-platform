import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            response.cookies.set(name, value, {
              ...options,
              maxAge: THIRTY_DAYS_SECONDS,
            })
          }
        },
      },
    },
  )

  // Triggers a session refresh and synchronises auth cookies onto the
  // outgoing response so SSR + RSC always see a consistent user.
  await supabase.auth.getUser()

  return response
}
