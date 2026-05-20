import Link from "next/link"
import { requireAdmin } from "@/lib/auth"
import { signOut } from "@/app/actions"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireAdmin()

  return (
    <div className="min-h-screen paper-bg" dir="rtl">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto max-w-[1280px] px-5 lg:px-10 py-3 flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span
              className="eyebrow"
              style={{ color: "var(--gold)" }}
            >
              Admin · ITQ
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors tag-mono"
            >
              لوحة
            </Link>
            <Link
              href="/admin/users"
              className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors tag-mono"
            >
              المستخدمين
            </Link>
            <Link
              href="/admin/unassigned"
              className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors tag-mono"
            >
              بدون تيستر
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-md hover:bg-muted transition-colors tag-mono text-muted-foreground"
            >
              ← المنصة
            </Link>
          </nav>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {profile.email}
          </span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs tag-mono text-muted-foreground hover:text-[var(--status-fail)] transition-colors"
            >
              خروج
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] px-5 lg:px-10 py-8 lg:py-10">{children}</div>
    </div>
  )
}
