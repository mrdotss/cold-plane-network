// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: ({ className, ...props }: Record<string, unknown>) => (
    <span data-testid="icon" className={className as string} {...props} />
  ),
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Notification01Icon: "Notification01Icon",
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { DigestTrigger } from "../DigestTrigger"

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no existing digest notifications
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/notifications?")) {
      return mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 })
    }
    return mockFetchResponse({})
  })
})

describe("DigestTrigger", () => {
  it("renders Generate Digest button", async () => {
    render(<DigestTrigger />)

    expect(screen.getByRole("button")).toHaveTextContent("Generate Digest")
  })

  it("shows last digest date when a digest exists", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/notifications?")) {
        return mockFetchResponse({
          notifications: [
            {
              id: "n1",
              type: "digest_summary",
              title: "Weekly Digest",
              createdAt: "2026-04-01T08:00:00.000Z",
            },
          ],
          unreadCount: 0,
          total: 1,
        })
      }
      return mockFetchResponse({})
    })

    render(<DigestTrigger />)

    await waitFor(() => {
      expect(screen.getByText(/Last digest:/)).toBeInTheDocument()
    })
  })

  it("shows loading state while generating", async () => {
    // Make the digest POST hang
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return new Promise(() => {}) // never resolves
      }
      return mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 })
    })

    const user = userEvent.setup()
    render(<DigestTrigger />)

    await user.click(screen.getByRole("button"))

    expect(screen.getByRole("button")).toHaveTextContent("Generating…")
    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("shows success indicator after generation completes", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return mockFetchResponse({ notificationId: "notif-1" })
      }
      return mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 })
    })

    const user = userEvent.setup()
    render(<DigestTrigger />)

    await user.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByRole("button")).toHaveTextContent("Digest Created")
    })
  })

  it("shows error message on failure", async () => {
    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "POST") {
        return mockFetchResponse(
          { error: "Failed to generate digest" },
          false,
          500,
        )
      }
      return mockFetchResponse({ notifications: [], unreadCount: 0, total: 0 })
    })

    const user = userEvent.setup()
    render(<DigestTrigger />)

    await user.click(screen.getByRole("button"))

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate digest/)).toBeInTheDocument()
    })
  })
})
