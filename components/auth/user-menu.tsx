"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, ShieldCheck, User as UserIcon, ChevronDown, LogIn } from "lucide-react"
import { signOut } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Profile } from "@/lib/types"

type Props = {
  profile: Profile | null
}

export function UserMenu({ profile }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  if (!profile) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-md border border-border-strong hover:border-primary hover:text-primary px-5 h-10 bg-transparent text-sm tag-mono transition-colors"
      >
        <LogIn className="size-4" />
        تسجيل دخول
      </Link>
    )
  }

  const initials = (profile.display_name || profile.email)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?"

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-md border-border-strong h-10 bg-transparent"
        >
          <span
            className="size-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{
              background: "color-mix(in oklch, var(--primary) 14%, transparent)",
              color: "var(--primary)",
            }}
          >
            {initials}
          </span>
          <span className="tag-mono hidden sm:inline">
            {profile.display_name || profile.email}
          </span>
          {profile.is_admin && (
            <ShieldCheck
              className="size-3.5"
              style={{ color: "var(--gold)" }}
            />
          )}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {profile.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="size-4" />
            البروفايل بتاعي
          </Link>
        </DropdownMenuItem>
        {profile.is_admin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <ShieldCheck className="size-4" />
              لوحة الأدمن
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={pending}
          onSelect={(e) => {
            e.preventDefault()
            startTransition(async () => {
              await signOut()
              router.refresh()
            })
          }}
          className="text-[var(--status-fail)] focus:text-[var(--status-fail)] cursor-pointer"
        >
          <LogOut className="size-4" />
          تسجيل خروج
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
