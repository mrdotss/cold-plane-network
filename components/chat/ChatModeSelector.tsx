"use client"

import * as React from "react"
import type { ChatMode } from "@/lib/chat/insights-prompt"

interface ChatModeSelectorProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

const modes: { value: ChatMode; label: string }[] = [
  { value: "sizing", label: "Sizing" },
  { value: "cfm", label: "CFM" },
  { value: "insights", label: "Insights" },
]

export function ChatModeSelector({ mode, onModeChange }: ChatModeSelectorProps) {
  return (
    <div className="flex gap-0.5 rounded-md bg-muted p-0.5" role="tablist" aria-label="Chat mode">
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          role="tab"
          aria-selected={mode === m.value}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            mode === m.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onModeChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
