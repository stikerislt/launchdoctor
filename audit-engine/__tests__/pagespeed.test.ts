import { parsePageSpeedPerformanceScore } from "../../collector/pagespeed";
import { pageSpeedToSnapshotMobile } from "../../collector/mobile-insights";

describe("parsePageSpeedPerformanceScore", () => {
  it("converts Lighthouse 0–1 score to 0–100", () => {
    expect(
      parsePageSpeedPerformanceScore({
        lighthouseResult: {
          categories: { performance: { score: 0.847 } },
        },
      }),
    ).toBe(85);
  });

  it("returns null for missing data", () => {
    expect(parsePageSpeedPerformanceScore(null)).toBeNull();
    expect(parsePageSpeedPerformanceScore({})).toBeNull();
  });
});

describe("pageSpeedToSnapshotMobile", () => {
  it("maps PageSpeed result to snapshot mobile fields", () => {
    const fields = pageSpeedToSnapshotMobile(72, "https://shop.example.com");
    expect(fields.lighthousePerformance).toBe(72);
    expect(fields.performanceSource).toBe("pagespeed");
    expect(fields.performanceMeasuredUrl).toBe("https://shop.example.com");
  });
});
