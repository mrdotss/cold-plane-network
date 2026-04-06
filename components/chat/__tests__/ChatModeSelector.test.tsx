// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

import { ChatModeSelector } from "../ChatModeSelector"

describe("ChatModeSelector", () => {
  it("renders all three mode tabs", () => {
    render(<ChatModeSelector mode="sizing" onModeChange={() => {}} />)

    expect(screen.getByText("Sizing")).toBeInTheDocument()
    expect(screen.getByText("CFM")).toBeInTheDocument()
    expect(screen.getByText("Insights")).toBeInTheDocument()
  })

  it("marks the active mode as selected", () => {
    render(<ChatModeSelector mode="insights" onModeChange={() => {}} />)

    expect(screen.getByText("Insights")).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("Sizing")).toHaveAttribute("aria-selected", "false")
    expect(screen.getByText("CFM")).toHaveAttribute("aria-selected", "false")
  })

  it("calls onModeChange when a different mode is clicked", async () => {
    const onModeChange = vi.fn()
    const user = userEvent.setup()

    render(<ChatModeSelector mode="sizing" onModeChange={onModeChange} />)

    await user.click(screen.getByText("Insights"))

    expect(onModeChange).toHaveBeenCalledWith("insights")
  })

  it("calls onModeChange with cfm when CFM tab is clicked", async () => {
    const onModeChange = vi.fn()
    const user = userEvent.setup()

    render(<ChatModeSelector mode="sizing" onModeChange={onModeChange} />)

    await user.click(screen.getByText("CFM"))

    expect(onModeChange).toHaveBeenCalledWith("cfm")
  })

  it("applies active styling to the selected tab", () => {
    render(<ChatModeSelector mode="cfm" onModeChange={() => {}} />)

    const cfmTab = screen.getByText("CFM")
    expect(cfmTab.className).toContain("bg-background")

    const sizingTab = screen.getByText("Sizing")
    expect(sizingTab.className).toContain("text-muted-foreground")
  })
})
