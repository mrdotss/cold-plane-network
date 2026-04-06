// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

const mockPush = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon" className={className as string} {...props} />
  ),
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  ChartRingIcon: "ChartRingIcon",
  SecurityCheckIcon: "SecurityCheckIcon",
  Notification01Icon: "Notification01Icon",
  Alert01Icon: "Alert01Icon",
  CheckmarkCircle01Icon: "CheckmarkCircle01Icon",
  AlertCircleIcon: "AlertCircleIcon",
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { NotificationCenter } from "../NotificationCenter"

const sampleNotifications = [
  {
    id: "n1",
    type: "cfm_scan_complete",
    title: "CFM Scan Complete",
    body: "Found $200 savings",
    metadata: {},
    readAt: null,
    createdAt: new Date(Date.now() - 3600_000).toISOString(), // 1h ago
  },
  {
    id: "n2",
    type: "csp_scan_complete",
    title: "Security Score: 87",
    body: "2 high findings",
    metadata: {},
    readAt: "2026-04-01T00:00:00.000Z",
    createdAt: new Date(Date.now() - 7200_000).toISOString(), // 2h ago
  },
  {
    id: "n3",
    type: "digest_summary",
    title: "Weekly Digest",
    body: "## Summary\nSpend up 12%",
    metadata: {},
    readAt: null,
    createdAt: new Date(Date.now() - 86400_000).toISOString(), // 1d ago
  },
]

function mockFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  })
}

describe("NotificationCenter", () => {
  const onCountChange = vi.fn()
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  it("renders loading skeletons initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    expect(screen.getByText("Notifications")).toBeInTheDocument()
  })

  it("renders notification list after loading", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      }),
    )

    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("CFM Scan Complete")).toBeInTheDocument()
      expect(screen.getByText("Security Score: 87")).toBeInTheDocument()
      expect(screen.getByText("Weekly Digest")).toBeInTheDocument()
    })

    expect(onCountChange).toHaveBeenCalledWith(2)
  })

  it("shows empty state when no notifications", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: [],
        unreadCount: 0,
        total: 0,
      }),
    )

    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("No notifications yet")).toBeInTheDocument()
    })
  })

  it("visually distinguishes unread from read notifications", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      }),
    )

    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("CFM Scan Complete")).toBeInTheDocument()
    })

    // Unread items (n1, n3) should have border-primary class
    const buttons = screen.getAllByRole("button")
    const notifButtons = buttons.filter(
      (b) => b.textContent?.includes("CFM Scan Complete") ||
             b.textContent?.includes("Weekly Digest") ||
             b.textContent?.includes("Security Score"),
    )

    // n1 (unread) should have border-primary
    const unreadButton = notifButtons.find((b) =>
      b.textContent?.includes("CFM Scan Complete"),
    )
    expect(unreadButton?.className).toContain("border-primary")

    // n2 (read) should NOT have border-primary
    const readButton = notifButtons.find((b) =>
      b.textContent?.includes("Security Score"),
    )
    expect(readButton?.className).not.toContain("border-primary")
  })

  it("marks all as read when button clicked", async () => {
    let fetchCallCount = 0
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      fetchCallCount++
      if (options?.method === "PATCH") {
        return mockFetchResponse({ updated: 2 })
      }
      return mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      })
    })

    const user = userEvent.setup()
    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("Mark all as read")).toBeInTheDocument()
    })

    await user.click(screen.getByText("Mark all as read"))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining('"action":"read"'),
      })
    })

    expect(onCountChange).toHaveBeenCalledWith(0)
  })

  it("navigates to CSP dashboard on csp_scan_complete click", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      }),
    )

    const user = userEvent.setup()
    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("Security Score: 87")).toBeInTheDocument()
    })

    // Find and click the CSP notification
    const cspButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Security Score: 87"))
    if (cspButton) await user.click(cspButton)

    expect(onClose).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith("/dashboard/csp")
  })

  it("navigates to CFM dashboard on cfm_scan_complete click", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      }),
    )

    const user = userEvent.setup()
    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("CFM Scan Complete")).toBeInTheDocument()
    })

    const cfmButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("CFM Scan Complete"))
    if (cfmButton) await user.click(cfmButton)

    expect(onClose).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith("/dashboard/cfm")
  })

  it("expands digest body on digest_summary click", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        notifications: sampleNotifications,
        unreadCount: 2,
        total: 3,
      }),
    )

    const user = userEvent.setup()
    render(
      <NotificationCenter onCountChange={onCountChange} onClose={onClose} />,
    )

    await waitFor(() => {
      expect(screen.getByText("Weekly Digest")).toBeInTheDocument()
    })

    // Body should not be visible initially
    expect(screen.queryByText(/Spend up 12%/)).not.toBeInTheDocument()

    const digestButton = screen
      .getAllByRole("button")
      .find((b) => b.textContent?.includes("Weekly Digest"))
    if (digestButton) await user.click(digestButton)

    // Body should now be visible
    await waitFor(() => {
      expect(screen.getByText(/Spend up 12%/)).toBeInTheDocument()
    })
  })
})
