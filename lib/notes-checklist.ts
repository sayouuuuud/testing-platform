/**
 * Helpers for serializing checklist-style notes inside the existing
 * `notes` TEXT columns (test_phases.notes, test_sections.notes).
 *
 * Storage format: GitHub-flavored markdown task list lines, e.g.
 *
 *   - [ ] Item not done yet
 *   - [x] Item that has been completed
 *
 * Any legacy free-text content is preserved by treating each non-empty
 * line as an unchecked checklist item so users never lose old notes.
 */

export type ChecklistNoteItem = {
  text: string
  done: boolean
}

const TASK_LINE_RE = /^\s*[-*]\s*\[([ xX])\]\s*(.*)$/

export function parseChecklistNotes(raw: string | null | undefined): ChecklistNoteItem[] {
  if (!raw) return []
  const trimmed = raw.replace(/\r\n/g, "\n")
  if (!trimmed.trim()) return []

  const items: ChecklistNoteItem[] = []
  for (const line of trimmed.split("\n")) {
    const match = line.match(TASK_LINE_RE)
    if (match) {
      items.push({
        text: match[2].trim(),
        done: match[1].toLowerCase() === "x",
      })
    } else {
      const text = line.trim()
      if (text) items.push({ text, done: false })
    }
  }
  return items
}

export function serializeChecklistNotes(items: ChecklistNoteItem[]): string | null {
  const meaningful = items.filter((it) => it.text.trim() !== "" || it.done)
  if (meaningful.length === 0) return null
  return meaningful
    .map((it) => `- [${it.done ? "x" : " "}] ${it.text.trim()}`)
    .join("\n")
}
