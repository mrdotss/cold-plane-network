// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// We need to mock the hugeicons to avoid ESM issues in jsdom
vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon" className={className as string} {...props} />
  ),
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Notification03Icon: "Notification03Icon",
  ChartRingIcon: "ChartRingIcon",
  SecurityCheckIcon: "SecurityCheckIcon",
  Notification01Icon: "Notification01Icon",
  Alert01Icon: "Alert01Icon",
  CheckmarkCircle01Icon: "CheckmarkCircle01Icon",
  AlertCircleIcon: "AlertCircleIcon",
}))

import { NotificationBell } from "../NotificationBell"

function mockFetchResponse(data: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(data),
  })
}

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders bell icon", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 }),
    )

    render(<NotificationBell />)

    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("shows unread badge when count > 0", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 5, total: 5 }),
    )

    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument()
    })
  })

  it("does not show badge when unread count is 0", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 }),
    )

    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Notifications",
      )
    })

    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("caps badge display at 99+", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 150, total: 150 }),
    )

    render(<NotificationBell />)

    await waitFor(() => {
      expect(screen.getByText("99+")).toBeInTheDocument()
    })
  })

  it("polls every 30 seconds", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 }),
    )

    render(<NotificationBell />)

    // Initial fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Advance 30 seconds
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it("opens popover on click showing NotificationCenter", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 }),
    )

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<NotificationBell />)

    await user.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument()
    })
  })
})
