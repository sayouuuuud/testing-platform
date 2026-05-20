import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import { createServiceClient } from "@/lib/supabase/server"
import { normalizeProfile } from "@/lib/auth"
import type { Profile } from "@/lib/types"
import { InviteForm } from "@/components/admin/invite-form"
import { TimeAgo } from "@/components/time-ago"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const svc = createServiceClient()
  const { data } = await svc
    .from("profiles")
    .select("*")
    .order("registration_order", { ascending: true, nullsFirst: false })
  const profiles: Profile[] = ((data ?? []) as Record<string, unknown>[]).map(normalizeProfile)

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-1" style={{ color: "var(--gold)" }}>
          Users
        </div>
        <h1 className="font-display text-3xl lg:text-5xl text-foreground leading-tight">
          المستخدمين
        </h1>
      </div>

      <section className="card-paper p-5">
        <div className="tag-mono text-[11px] uppercase text-muted-foreground mb-3">
          دعوة عضو جديد
        </div>
        <InviteForm />
        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          هيتبعت إيميل بلينك تفعيل. لما يضغطه، يتنقل لـ /auth/set-password عشان يحط الباس بتاعه. السيشن بتاعته بتفضل شغالة 30 يوم.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="eyebrow">قائمة الأعضاء</span>
          <span className="flex-1 hairline" />
          <span className="tag-mono text-[11px] text-muted-foreground num-latin">
            {profiles.length} user
          </span>
        </div>

        {profiles.length === 0 ? (
          <div className="card-paper p-8 text-center text-muted-foreground text-sm">
            لسه مفيش أعضاء
          </div>
        ) : (
          <div className="card-paper divide-y divide-border/70">
            {profiles.map((p) => (
              <Link
                key={p.id}
                href={`/admin/testers/${p.id}`}
                className="px-4 py-3 flex items-center gap-3 text-sm hover:bg-muted/40 transition-colors"
              >
                <span
                  className="size-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                  style={{
                    background: "color-mix(in oklch, var(--primary) 14%, transparent)",
                    color: "var(--primary)",
                  }}
                >
                  {(p.display_name || p.email).slice(0, 1).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    {p.display_name || "—"}
                    {p.is_admin && (
                      <ShieldCheck
                        className="size-3.5"
                        style={{ color: "var(--gold)" }}
                      />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                </div>
                <span className="tag-mono text-[10px] text-muted-foreground num-latin shrink-0">
                  #{p.registration_order ?? "—"}
                </span>
                <TimeAgo
                  iso={p.last_seen_at}
                  className="tag-mono text-[10px] text-muted-foreground shrink-0"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
