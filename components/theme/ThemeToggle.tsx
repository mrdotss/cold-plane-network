"use client"

import { useState, useEffect } from "react"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import { SunIcon, MoonIcon, ComputerIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import type { IconSvgElement } from "@hugeicons/react"

const modes = ["system", "light", "dark"] as const
type ThemeMode = (typeof modes)[number]

const icons: Record<ThemeMode, IconSvgElement> = {
  system: ComputerIcon,
  light: SunIcon,
  dark: MoonIcon,
}

const labels: Record<ThemeMode, string> = {
  system: "Switch to light mode",
  light: "Switch to dark mode",
  dark: "Switch to system mode",
}

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // Defer rendering until after hydration — useTheme() returns undefined on
  // the server, causing an icon mismatch flash without this guard.
  useEffect(() => {
    setMounted(true)
  }, [])

  // Render a static placeholder button during SSR / before hydration
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </Button>
    )
  }

  const current = (theme ?? "system") as ThemeMode
  const nextMode = modes[(modes.indexOf(current) + 1) % modes.length]

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      onClick={() => setTheme(nextMode)}
      aria-label={labels[current]}
    >
      <HugeiconsIcon
        icon={icons[current]}
        strokeWidth={2}
        className="size-4"
      />
    </Button>
  )
}
