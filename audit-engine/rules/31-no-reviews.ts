import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { SHOPIFY_APP_STORE_REVIEWS_URL } from "../utils/deep-link";

export const trustNoReviewsRule: Rule = {
  id: 31,
  code: "TRUST_NO_REVIEWS",
  category: Category.TRUST_SIGNALS,
  severity: Severity.HIGH,
  title: "No product reviews on store",
  description: "No reviews app and no reviews block on PDP.",
  evaluate(snap) {
    if (snap.reviewsAppInstalled || snap.theme.sections.pdpHasReviews) return null;
    return createFinding({
      snap,
      ruleId: 31,
      ruleCode: "TRUST_NO_REVIEWS",
      category: Category.TRUST_SIGNALS,
      severity: Severity.HIGH,
      title: "No product reviews on store",
      body: "Your store has no product reviews. Social proof is one of the strongest conversion drivers for new stores.",
      fixSteps: getFixSteps("TRUST_NO_REVIEWS"),
      fixDeepLink: SHOPIFY_APP_STORE_REVIEWS_URL,
    });
  },
};
