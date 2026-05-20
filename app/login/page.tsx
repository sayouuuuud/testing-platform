import { redirect } from "next/navigation"
import { getCurrentProfile } from "@/lib/auth"
import { LoginForm } from "@/components/auth/login-form"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  const profile = await getCurrentProfile()
  if (profile) {
    redirect(profile.is_admin ? "/admin" : "/")
  }

  return (
    <main className="min-h-screen paper-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="eyebrow mb-3" style={{ color: "var(--gold)" }}>
            ITQ · Testing Platform
          </div>
          <h1 className="font-display display-hero text-foreground text-[clamp(2rem,5vw,3rem)] leading-[1.05]">
            تسجيل الدخول
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            ادخل ببياناتك عشان تشتغل على الاختبارات وتشارك في الـ chat
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
