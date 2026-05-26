import {
  PREVIEW_FINDING_COUNT,
  serializeFindingForClient,
} from "../utils/audit-serialize";

const baseFinding = {
  id: "f1",
  ruleId: 5,
  ruleCode: "POL_REFUND_MISSING",
  severity: "CRITICAL",
  category: "TRUST_SIGNALS",
  title: "Refund policy missing or too short",
  body: "Your refund policy is missing or too short.",
  fixSteps: ["Go to Settings → Policies", "Add refund policy"],
  fixDeepLink: "https://admin.shopify.com/store/test/settings/legal",
  evidence: { policyLength: 0 },
  confidence: 1,
};

describe("audit-serialize", () => {
  it("returns full finding data for preview slots when locked", () => {
    const finding = serializeFindingForClient(baseFinding, false, null, 0);

    expect(finding.locked).toBe(false);
    expect(finding.ruleCode).toBe("POL_REFUND_MISSING");
    expect(finding.fixSteps).toHaveLength(2);
    expect(finding.fixDeepLink).toBeTruthy();
  });

  it("redacts findings beyond preview count when locked", () => {
    const finding = serializeFindingForClient(
      baseFinding,
      false,
      new Set(["other-finding-id"]),
      PREVIEW_FINDING_COUNT,
    );

    expect(finding.locked).toBe(true);
    expect(finding.ruleCode).toBe("LOCKED");
    expect(finding.fixSteps).toEqual([]);
    expect(finding.fixDeepLink).toBeNull();
    expect(finding.evidence).toBeNull();
  });

  it("returns all findings when unlocked", () => {
    const finding = serializeFindingForClient(baseFinding, true, null, PREVIEW_FINDING_COUNT);

    expect(finding.locked).toBe(false);
    expect(finding.ruleCode).toBe("POL_REFUND_MISSING");
    expect(finding.fixSteps).toHaveLength(2);
  });
});
