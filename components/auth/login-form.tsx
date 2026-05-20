"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { signInWithPassword } from "@/app/actions"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      toast.error("املأ الإيميل والباس")
      return
    }
    startTransition(async () => {
      const res = await signInWithPassword(email, password)
      if (!res.ok) {
        toast.error(res.error || "فشل تسجيل الدخول")
        return
      }
      toast.success("أهلاً بيك")
      router.refresh()
      router.push("/")
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-paper p-6 space-y-5"
      dir="rtl"
    >
      <div className="space-y-1.5">
        <label className="tag-mono text-muted-foreground block">Email</label>
        <input
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>
      <div className="space-y-1.5">
        <label className="tag-mono text-muted-foreground block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          autoComplete="current-password"
          className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        دخول
      </button>

      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        تم دعوتك بإيميل؟ <span className="text-primary">افتح اللينك من إيميلك عشان تحط الباس</span>
      </p>
    </form>
  )
}
