import { resolvePaymentCapture } from "../../collector/snapshot-builder";

describe("resolvePaymentCapture", () => {
  it("uses autoCapture when the API returns it", () => {
    expect(resolvePaymentCapture(true, [])).toEqual({
      captureMode: "AUTOMATIC",
      captureModeKnown: true,
    });
    expect(resolvePaymentCapture(false, [])).toEqual({
      captureMode: "MANUAL",
      captureModeKnown: true,
    });
  });

  it("infers manual capture from authorized orders", () => {
    expect(
      resolvePaymentCapture(null, [
        { test: false, displayFinancialStatus: "AUTHORIZED" },
      ]),
    ).toEqual({ captureMode: "MANUAL", captureModeKnown: true });
  });

  it("infers automatic capture from multiple paid orders", () => {
    expect(
      resolvePaymentCapture(null, [
        { test: false, displayFinancialStatus: "PAID" },
        { test: false, displayFinancialStatus: "PAID" },
      ]),
    ).toEqual({ captureMode: "AUTOMATIC", captureModeKnown: true });
  });

  it("returns unknown when capture cannot be determined", () => {
    expect(resolvePaymentCapture(null, [])).toEqual({
      captureMode: "MANUAL",
      captureModeKnown: false,
    });
  });
});
