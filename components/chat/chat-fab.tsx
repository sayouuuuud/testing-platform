"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { AtSign, MessageCircle, MinusCircle, Send, X } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { sendChatMessage } from "@/app/actions"
import type { ChatMessage, Profile } from "@/lib/types"
import { TimeAgo } from "@/components/time-ago"
import { Button } from "@/components/ui/button"

type Props = {
  initialMessages: ChatMessage[]
  profile: Profile
  testers: Profile[]
}

export function ChatFab({ initialMessages, profile, testers }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState("")
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [pending, startTransition] = useTransition()
  const [unread, setUnread] = useState(0)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  // Subscribe to new chat messages.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("chat_messages_changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new
          // Hydrate author via the testers list (best-effort — falls back
          // to "تيستر" when the user is brand new).
          const userId = row.user_id as string
          const author = testers.find((t) => t.id === userId)
          const msg: ChatMessage = {
            id: row.id as number,
            user_id: userId,
            content: (row.content as string) ?? "",
            mentions: ((row.mentions as string[]) ?? []),
            created_at: row.created_at as string,
            author: author
              ? { display_name: author.display_name, avatar_url: author.avatar_url }
              : { display_name: "تيستر", avatar_url: null },
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (!open && msg.user_id !== profile.id) {
            setUnread((n) => n + 1)
            if (msg.mentions.includes(profile.id)) {
              toast.message(`@${author?.display_name ?? "تيستر"} منشن`, {
                description: msg.content.slice(0, 120),
              })
            }
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [open, profile.id, testers])

  // Auto-scroll on open / new message.
  useEffect(() => {
    if (!open) return
    setUnread(0)
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [open, messages.length])

  // ── @mention typeahead ─────────────────────────────────────────────────
  const updateDraft = (next: string) => {
    setDraft(next)
    const m = next.match(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u)
    if (m) {
      setMentionQuery(m[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  const mentionCandidates = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase()
    return testers
      .filter((t) => t.id !== profile.id)
      .filter((t) => !q || t.display_name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q))
      .slice(0, 6)
  }, [mentionQuery, testers, profile.id])

  const insertMention = (t: Profile) => {
    setDraft((prev) => prev.replace(/(?:^|\s)@([\p{L}\p{N}_-]*)$/u, (m, _q, offset) => {
      const lead = offset === 0 ? "" : " "
      return `${lead}@${t.display_name} `
    }))
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const extractMentions = (text: string): string[] => {
    const ids = new Set<string>()
    const lower = text.toLowerCase()
    for (const t of testers) {
      const dn = t.display_name.toLowerCase()
      if (!dn) continue
      if (lower.includes(`@${dn}`)) ids.add(t.id)
    }
    return Array.from(ids)
  }

  const handleSend = useCallback(() => {
    const text = draft.trim()
    if (!text) return
    const mentionIds = extractMentions(text)
    startTransition(async () => {
      const res = await sendChatMessage(text, mentionIds)
      if (!res.ok) {
        toast.error(res.error || "تعذر إرسال الرسالة")
        return
      }
      setDraft("")
      if (res.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === res.message!.id)) return prev
          return [...prev, res.message!]
        })
      }
    })
  }, [draft, testers])

  return (
    <>
      {/* Floating ball */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="فتح الشات"
        className="fixed bottom-6 left-6 z-50 size-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-2"
        style={{
          background: "var(--card)",
          color: "var(--primary)",
          borderColor: "color-mix(in oklch, var(--primary) 30%, transparent)",
        }}
      >
        <MessageCircle className="size-6" />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 size-5 rounded-full text-[10px] font-bold flex items-center justify-center num-latin"
            style={{ background: "var(--status-fail)", color: "#fff" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 w-[min(92vw,380px)] card-paper flex flex-col overflow-hidden rise-in"
          style={{ height: "min(70vh, 540px)" }}
          dir="rtl"
        >
          <div
            className="px-4 py-3 border-b border-border flex items-center justify-between"
            style={{
              background: "color-mix(in oklch, var(--primary) 5%, var(--card))",
            }}
          >
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <span className="font-display text-sm">شات التيسترز</span>
              <span className="tag-mono text-[10px] text-muted-foreground">قناة عامة</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="size-7 rounded-md hover:bg-muted flex items-center justify-center"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </button>
          </div>

          <div
            ref={listRef}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
            onWheel={(e) => e.stopPropagation()}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 py-10">
                <MinusCircle className="size-6 opacity-40" />
                <p className="text-xs">لسه مفيش رسائل، ابدأ كلام</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatBubble key={msg.id} msg={msg} mine={msg.user_id === profile.id} />
              ))
            )}
          </div>

          {/* Mention popover */}
          {showMentions && mentionCandidates.length > 0 && (
            <div
              className="border-t border-border bg-card px-2 py-1.5 space-y-0.5 max-h-44 overflow-y-auto"
              onWheel={(e) => e.stopPropagation()}
            >
              <div className="tag-mono text-[10px] text-muted-foreground px-2 py-1 flex items-center gap-1">
                <AtSign className="size-3" />
                اختر تيستر
              </div>
              {mentionCandidates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => insertMention(t)}
                  className="w-full text-right px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-2"
                >
                  <span
                    className="size-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                    style={{
                      background: "color-mix(in oklch, var(--primary) 14%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {(t.display_name || t.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm">{t.display_name || t.email}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border p-2 flex items-end gap-1.5 bg-card">
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => updateDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="اكتب رسالة... استخدم @ للمنشن"
              className="flex-1 min-w-0 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
            />
            <Button
              type="button"
              onClick={handleSend}
              disabled={pending || !draft.trim()}
              size="icon"
              className="rounded-md shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function ChatBubble({ msg, mine }: { msg: ChatMessage; mine: boolean }) {
  const name = msg.author?.display_name || "تيستر"
  const initials = name.slice(0, 1).toUpperCase()
  const content = msg.content
  // Highlight @mentions in the text.
  const parts = content.split(/(@[\p{L}\p{N}_-]+)/u)

  return (
    <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
      <div
        className="size-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-semibold mt-1"
        style={{
          background: "color-mix(in oklch, var(--primary) 14%, transparent)",
          color: "var(--primary)",
        }}
      >
        {initials}
      </div>
      <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`flex items-center gap-2 ${mine ? "flex-row-reverse" : ""}`}>
          <span className="text-xs font-medium">{name}</span>
          <TimeAgo iso={msg.created_at} className="text-[10px] text-muted-foreground" />
        </div>
        <div
          className="px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words"
          style={{
            background: mine ? "color-mix(in oklch, var(--primary) 14%, transparent)" : "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          {parts.map((p, i) =>
            p.startsWith("@") ? (
              <span
                key={i}
                className="font-medium"
                style={{
                  color: "var(--primary)",
                  background: "color-mix(in oklch, var(--primary) 12%, transparent)",
                  padding: "0 4px",
                  borderRadius: 4,
                }}
              >
                {p}
              </span>
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
