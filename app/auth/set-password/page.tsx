import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/auth"
import { SetPasswordForm } from "@/components/auth/set-password-form"
import { ThemeToggle } from "@/components/theme-toggle"

export const dynamic = "force-dynamic"

export default async function SetPasswordPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  return (
    <main className="min-h-screen paper-bg flex items-center justify-center px-4 py-12 relative">
      <div className="absolute top-4 left-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            Welcome
          </div>
          <h1 className="font-display text-4xl text-foreground leading-tight">
            أهلاً، {profile.display_name || profile.email}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            اختار باس خاص بيك عشان تستخدمه في تسجيل الدخول لاحقاً
          </p>
        </div>
        <SetPasswordForm
          initialDisplayName={profile.display_name}
          email={profile.email}
        />
      </div>
    </main>
  )
}
