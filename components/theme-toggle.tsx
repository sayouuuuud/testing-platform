"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="size-8" />

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="size-8 rounded-md flex items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-all bg-transparent"
      title={resolvedTheme === "dark" ? "تفعيل الوضع المضيء" : "تفعيل الوضع المظلم"}
    >
      {resolvedTheme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
    </button>
  )
}
