import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { paymentsLink } from "../utils/deep-link";

export const payNo3dsEuRule: Rule = {
  id: 3,
  code: "PAY_NO_3DS_EU",
  category: Category.PAYMENTS_FRAUD,
  severity: Severity.HIGH,
  title: "3D Secure not configured for EU shipping",
  description: "Checks 3DS configuration when EU shipping zones exist.",
  evaluate(snap) {
    const hasEuZone = snap.delivery.profiles.some((p) =>
      p.zones.some(
        (z) =>
          z.isInternational &&
          z.countries.some((c) =>
            ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"].includes(c),
          ),
      ),
    );
    if (!hasEuZone || snap.shop.paymentSettings.threeDSConfigured) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 3,
      ruleCode: "PAY_NO_3DS_EU",
      category: Category.PAYMENTS_FRAUD,
      severity: Severity.HIGH,
      title: "3D Secure not configured for EU shipping",
      body: "You ship to EU countries but 3D Secure authentication is not configured, increasing fraud and chargeback risk.",
      fixSteps: getFixSteps("PAY_NO_3DS_EU"),
      fixDeepLink: paymentsLink(snap.shop.handle),
    });
  },
};
