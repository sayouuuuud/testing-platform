"use client"

import { useState, useTransition } from "react"
import { Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { inviteUser } from "@/app/actions"

export function InviteForm() {
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [pending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    startTransition(async () => {
      const res = await inviteUser({
        email: email.trim(),
        display_name: displayName.trim() || undefined,
        is_admin: isAdmin,
      })
      if (res.ok) {
        toast.success("اتبعتت الدعوة")
        setEmail("")
        setDisplayName("")
        setIsAdmin(false)
      } else {
        toast.error(res.error || "فشلت الدعوة")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="tag-mono text-[10px] text-muted-foreground block mb-1">
            الإيميل
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="someone@example.com"
            required
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div>
          <label className="tag-mono text-[10px] text-muted-foreground block mb-1">
            اسم العرض (اختياري)
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="أحمد"
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={isAdmin}
          onChange={(e) => setIsAdmin(e.target.checked)}
        />
        <span className="tag-mono text-muted-foreground">يكون أدمن</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        ابعت دعوة
      </button>
    </form>
  )
}
