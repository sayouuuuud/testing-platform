"use client"

/**
 * Realtime presence — broadcasts which item / notes target each tester is
 * currently editing so other testers can avoid stepping on each other.
 *
 * Backed by a single Supabase Realtime channel using the presence API.
 * Each tab tracks its own state under its user_id and presents the set of
 * active editors via a context.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types"

export type PresenceTarget =
  | { kind: "item"; id: number }
  | { kind: "phase_notes"; id: number }
  | { kind: "section_notes"; id: number }

export interface PresenceEntry {
  user_id: string
  display_name: string
  target: PresenceTarget | null
  typing: boolean
  joined_at: string
}

type PresencePayload = {
  user_id: string
  display_name: string
  target: PresenceTarget | null
  typing: boolean
  joined_at: string
}

type Ctx = {
  /** All other users currently editing something (excludes self). */
  entries: PresenceEntry[]
  /** Set the current user's active target and typing state. */
  setActive: (target: PresenceTarget | null, typing?: boolean) => void
}

const PresenceContext = createContext<Ctx>({ entries: [], setActive: () => {} })

const CHANNEL = "editing_presence"

export function ItemPresenceProvider({
  profile,
  children,
}: {
  profile: Profile | null
  children: ReactNode
}) {
  const [entries, setEntries] = useState<PresenceEntry[]>([])
  const stateRef = useRef<PresencePayload>({
    user_id: profile?.id ?? "",
    display_name: profile?.display_name ?? "",
    target: null,
    typing: false,
    joined_at: new Date().toISOString(),
  })
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null)

  useEffect(() => {
    if (!profile) return
    const supabase = createClient()
    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: profile.id } },
    })
    channelRef.current = channel

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, PresencePayload[]>
      const flat: PresenceEntry[] = []
      for (const userId of Object.keys(state)) {
        if (userId === profile.id) continue
        const recs = state[userId]
        if (recs && recs.length > 0) {
          const last = recs[recs.length - 1]
          flat.push({
            user_id: last.user_id,
            display_name: last.display_name,
            target: last.target,
            typing: last.typing,
            joined_at: last.joined_at,
          })
        }
      }
      setEntries(flat)
    })

    channel.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        await channel.track(stateRef.current)
      }
    })

    return () => {
      void supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [profile])

  const setActive = useCallback(
    (target: PresenceTarget | null, typing: boolean = false) => {
      if (!profile) return
      stateRef.current = {
        ...stateRef.current,
        target,
        typing,
      }
      const ch = channelRef.current
      if (ch) {
        void ch.track(stateRef.current)
      }
    },
    [profile],
  )

  const value = useMemo(() => ({ entries, setActive }), [entries, setActive])

  return (
    <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>
  )
}

export function useItemPresence(itemId: number): PresenceEntry[] {
  const { entries } = useContext(PresenceContext)
  return entries.filter((e) => e.target?.kind === "item" && e.target.id === itemId)
}

export function usePhaseNotesPresence(phaseId: number): PresenceEntry[] {
  const { entries } = useContext(PresenceContext)
  return entries.filter(
    (e) => e.target?.kind === "phase_notes" && e.target.id === phaseId,
  )
}

export function useSectionNotesPresence(sectionId: number): PresenceEntry[] {
  const { entries } = useContext(PresenceContext)
  return entries.filter(
    (e) => e.target?.kind === "section_notes" && e.target.id === sectionId,
  )
}

export function usePresenceActions() {
  const { setActive } = useContext(PresenceContext)
  return { setActive }
}
