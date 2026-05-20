"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { setOwnPassword } from "@/app/actions"

type Props = {
  initialDisplayName: string
  email: string
}

export function SetPasswordForm({ initialDisplayName, email }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error("الباس لازم 6 حروف على الأقل")
      return
    }
    if (password !== confirm) {
      toast.error("الباس متطابقش")
      return
    }
    startTransition(async () => {
      const res = await setOwnPassword(password, displayName)
      if (!res.ok) {
        toast.error(res.error || "تعذر حفظ الباس")
        return
      }
      toast.success("تمام، الحساب جاهز")
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
          disabled
          className="w-full bg-muted/40 border border-border rounded-md px-4 py-2.5 text-sm opacity-70"
        />
      </div>

      <div className="space-y-1.5">
        <label className="tag-mono text-muted-foreground block">الاسم اللي هيظهر للناس</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="اسمك"
          className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="tag-mono text-muted-foreground block">باس جديد</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          autoComplete="new-password"
          className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="tag-mono text-muted-foreground block">تأكيد الباس</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••"
          autoComplete="new-password"
          className="w-full bg-card border border-border rounded-md px-4 py-2.5 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2.5 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        حفظ والبدء
      </button>
    </form>
  )
}
