// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

// Mock recharts to avoid canvas issues in jsdom
vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Legend: () => null,
}))

const mockFetch = vi.fn()
global.fetch = mockFetch

import { ForecastChart } from "../ForecastChart"

const sampleForecast = {
  history: [
    { date: "2026-03-01", value: 4200 },
    { date: "2026-03-15", value: 4400 },
  ],
  forecast: [
    { date: "2026-04-01", value: 4600 },
    { date: "2026-04-15", value: 4800 },
  ],
  trend: "up",
  changePercent: 7.1,
}

const insufficientData = {
  history: [{ date: "2026-03-01", value: 4200 }],
  forecast: [],
  trend: "stable",
  changePercent: 0,
  message: "Not enough data for forecasting",
}

function mockFetchResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
    body: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/insights/forecast")) {
      return mockFetchResponse(sampleForecast)
    }
    return mockFetchResponse({})
  })
})

describe("ForecastChart", () => {
  it("renders chart with forecast data", async () => {
    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByTestId("line-chart")).toBeInTheDocument()
    })
  })

  it("renders metric selector tabs", async () => {
    render(<ForecastChart accountId="acc-1" />)

    expect(screen.getByText("Monthly Spend")).toBeInTheDocument()
    expect(screen.getByText("Security Score")).toBeInTheDocument()
    expect(screen.getByText("Finding Count")).toBeInTheDocument()
  })

  it("renders timeframe selector", async () => {
    render(<ForecastChart accountId="acc-1" />)

    expect(screen.getByText("7d")).toBeInTheDocument()
    expect(screen.getByText("30d")).toBeInTheDocument()
    expect(screen.getByText("90d")).toBeInTheDocument()
  })

  it("shows 'Not enough data' message when insufficient data", async () => {
    mockFetch.mockImplementation(() => mockFetchResponse(insufficientData))

    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("Not enough data for forecasting")).toBeInTheDocument()
    })
  })

  it("fetches new data when metric changes", async () => {
    const user = userEvent.setup()
    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const initialCallCount = mockFetch.mock.calls.length

    await user.click(screen.getByText("Security Score"))

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount)
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
      expect(lastCall).toContain("metric=security_score")
    })
  })

  it("fetches new data when timeframe changes", async () => {
    const user = userEvent.setup()
    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    const initialCallCount = mockFetch.mock.calls.length

    await user.click(screen.getByText("90d"))

    await waitFor(() => {
      expect(mockFetch.mock.calls.length).toBeGreaterThan(initialCallCount)
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0]
      expect(lastCall).toContain("horizon=90")
    })
  })

  it("renders Ask AI button when data is available", async () => {
    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("Ask AI")).toBeInTheDocument()
    })
  })

  it("does not render Ask AI button when insufficient data", async () => {
    mockFetch.mockImplementation(() => mockFetchResponse(insufficientData))

    render(<ForecastChart accountId="acc-1" />)

    await waitFor(() => {
      expect(screen.getByText("Not enough data for forecasting")).toBeInTheDocument()
    })

    expect(screen.queryByText("Ask AI")).not.toBeInTheDocument()
  })
})
