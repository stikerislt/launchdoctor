import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { pagesLink } from "../utils/deep-link";

export const trustNoAboutRule: Rule = {
  id: 32,
  code: "TRUST_NO_ABOUT",
  category: Category.TRUST_SIGNALS,
  severity: Severity.HIGH,
  title: "About page missing or too short",
  description: "No /pages/about page or body under 100 chars.",
  evaluate(snap) {
    if (snap.pages.about && snap.pages.aboutBodyLength >= 100) return null;
    return createFinding({
      snap,
      ruleId: 32,
      ruleCode: "TRUST_NO_ABOUT",
      category: Category.TRUST_SIGNALS,
      severity: Severity.HIGH,
      title: "About page missing or too short",
      body: "Your store lacks a meaningful About page. Customers want to know who is behind the brand before purchasing.",
      fixSteps: getFixSteps("TRUST_NO_ABOUT"),
      fixDeepLink: pagesLink(snap.shop.handle),
      evidence: { aboutBodyLength: snap.pages.aboutBodyLength },
    });
  },
};
