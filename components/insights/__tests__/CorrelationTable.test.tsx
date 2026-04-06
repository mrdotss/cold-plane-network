// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

const mockFetch = vi.fn()
global.fetch = mockFetch

import { CorrelationTable } from "../CorrelationTable"

const sampleCorrelations = [
  {
    resourceId: "sg-123",
    resourceName: "web-server-sg",
    service: "EC2",
    cfmRecommendation: { priority: "medium", currentCost: 150, estimatedSavings: 45 },
    cspFindings: [
      { severity: "critical", finding: "SSH open to 0.0.0.0/0", cisReference: "4.1", category: "Network" },
    ],
  },
  {
    resourceId: "i-abc",
    resourceName: "app-server",
    service: "EC2",
    cfmRecommendation: { priority: "low", currentCost: 80, estimatedSavings: 20 },
    cspFindings: [
      { severity: "medium", finding: "No IMDSv2", cisReference: null, category: "Network" },
    ],
  },
]

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockImplementation(() =>
    mockFetchResponse({ correlations: sampleCorrelations }),
  )
})

describe("CorrelationTable", () => {
  it("renders correlated resources", async () => {
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("web-server-sg")).toBeInTheDocument()
      expect(screen.getByText("app-server")).toBeInTheDocument()
    })
  })

  it("shows correlation count", async () => {
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("2 correlated resources")).toBeInTheDocument()
    })
  })

  it("shows empty state when no correlations", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({ correlations: [] }),
    )

    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("No cross-domain insights yet")).toBeInTheDocument()
    })
  })

  it("expands row to show details on click", async () => {
    const user = userEvent.setup()
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("web-server-sg")).toBeInTheDocument()
    })

    // Details should not be visible initially
    expect(screen.queryByText(/SSH open to 0.0.0.0\/0/)).not.toBeInTheDocument()

    // Click to expand
    await user.click(screen.getByText("web-server-sg"))

    await waitFor(() => {
      expect(screen.getByText(/SSH open to 0.0.0.0\/0/)).toBeInTheDocument()
      expect(screen.getByText(/CIS 4.1/)).toBeInTheDocument()
    })
  })

  it("sorts by combined risk score (cost × severity)", async () => {
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      const buttons = screen.getAllByRole("button")
      const resourceButtons = buttons.filter(
        (b) =>
          b.textContent?.includes("web-server-sg") ||
          b.textContent?.includes("app-server"),
      )
      // web-server-sg (45 * 4 = 180) should come before app-server (20 * 2 = 40)
      expect(resourceButtons[0].textContent).toContain("web-server-sg")
      expect(resourceButtons[1].textContent).toContain("app-server")
    })
  })

  it("displays severity badges", async () => {
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("critical")).toBeInTheDocument()
    })
  })

  it("displays cost impact", async () => {
    render(<CorrelationTable accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("$45/mo")).toBeInTheDocument()
      expect(screen.getByText("$20/mo")).toBeInTheDocument()
    })
  })
})
