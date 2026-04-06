// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"

const mockFetch = vi.fn()
global.fetch = mockFetch

import { SavingsTracker } from "../SavingsTracker"

const sampleData = {
  tracked: [
    {
      trackingId: "t1",
      accountId: "acc-1",
      resourceId: "i-abc123",
      service: "EC2",
      expectedSavings: 73,
      actualSavings: 68,
      verificationStatus: "confirmed",
      implementedAt: "2026-03-15T00:00:00Z",
      verifiedAt: "2026-03-22T00:00:00Z",
    },
    {
      trackingId: "t2",
      accountId: "acc-1",
      resourceId: "vol-xyz",
      service: "EBS",
      expectedSavings: 30,
      actualSavings: 15,
      verificationStatus: "partial",
      implementedAt: "2026-03-10T00:00:00Z",
      verifiedAt: "2026-03-22T00:00:00Z",
    },
    {
      trackingId: "t3",
      accountId: "acc-1",
      resourceId: "rds-old",
      service: "RDS",
      expectedSavings: 100,
      actualSavings: null,
      verificationStatus: "pending",
      implementedAt: "2026-03-20T00:00:00Z",
      verifiedAt: null,
    },
  ],
  summary: { totalExpectedSavings: 203, totalActualSavings: 83 },
}

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockImplementation(() => mockFetchResponse(sampleData))
})

describe("SavingsTracker", () => {
  it("renders tracked items", async () => {
    render(<SavingsTracker />)

    await waitFor(() => {
      expect(screen.getByText("i-abc123")).toBeInTheDocument()
      expect(screen.getByText("vol-xyz")).toBeInTheDocument()
      expect(screen.getByText("rds-old")).toBeInTheDocument()
    })
  })

  it("displays status badges", async () => {
    render(<SavingsTracker />)

    await waitFor(() => {
      expect(screen.getByText("Confirmed")).toBeInTheDocument()
      expect(screen.getByText("Partial")).toBeInTheDocument()
      expect(screen.getByText("Pending Verification")).toBeInTheDocument()
    })
  })

  it("displays summary card", async () => {
    render(<SavingsTracker />)

    await waitFor(() => {
      expect(screen.getByText(/\$83 \/ \$203 verified/)).toBeInTheDocument()
    })
  })

  it("shows empty state when no tracked recommendations", async () => {
    mockFetch.mockImplementation(() =>
      mockFetchResponse({
        tracked: [],
        summary: { totalExpectedSavings: 0, totalActualSavings: 0 },
      }),
    )

    render(<SavingsTracker />)

    await waitFor(() => {
      expect(
        screen.getByText("No recommendations have been implemented yet"),
      ).toBeInTheDocument()
    })
  })

  it("displays service badges", async () => {
    render(<SavingsTracker />)

    await waitFor(() => {
      expect(screen.getByText("EC2")).toBeInTheDocument()
      expect(screen.getByText("EBS")).toBeInTheDocument()
      expect(screen.getByText("RDS")).toBeInTheDocument()
    })
  })
})
