import { describe, it, expect } from "vitest";
import {
  INSIGHTS_SYSTEM_PROMPT,
  getSystemPromptForMode,
} from "../insights-prompt";

describe("INSIGHTS_SYSTEM_PROMPT", () => {
  it("includes CFM recommendation fields", () => {
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("service");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("resourceId");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("resourceName");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("priority");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("recommendation");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("currentCost");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("estimatedSavings");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("effort");
  });

  it("includes CSP finding fields", () => {
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("category");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("severity");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("finding");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("remediation");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("cisReference");
  });

  it("mentions both CFM and CSP data sources", () => {
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("cfm_recommendations");
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("csp_findings");
  });

  it("describes the analyst role", () => {
    expect(INSIGHTS_SYSTEM_PROMPT).toContain("AWS cloud insights analyst");
  });
});

describe("getSystemPromptForMode", () => {
  it("returns insights prompt for insights mode", () => {
    const prompt = getSystemPromptForMode("insights");
    expect(prompt).toBe(INSIGHTS_SYSTEM_PROMPT);
  });

  it("returns undefined for sizing mode", () => {
    expect(getSystemPromptForMode("sizing")).toBeUndefined();
  });

  it("returns undefined for cfm mode", () => {
    expect(getSystemPromptForMode("cfm")).toBeUndefined();
  });
});
