import { Category, Severity } from "../types";
import type { Rule } from "../types";
import { createFinding } from "../utils/finding";
import { getFixSteps } from "../utils/finding-guidance";
import { themesLink } from "../utils/deep-link";

export const thmOutdatedRule: Rule = {
  id: 50,
  code: "THM_OUTDATED",
  category: Category.MOBILE_THEME,
  severity: Severity.MEDIUM,
  title: "Theme Store version is outdated",
  description: "Theme Store theme with newer version available.",
  evaluate(snap) {
    const { themeStoreId, themeStoreLatestVersion, installedVersion } = snap.theme;
    if (
      themeStoreId === null ||
      themeStoreLatestVersion === null ||
      installedVersion === null ||
      installedVersion >= themeStoreLatestVersion
    ) {
      return null;
    }
    return createFinding({
      snap,
      ruleId: 50,
      ruleCode: "THM_OUTDATED",
      category: Category.MOBILE_THEME,
      severity: Severity.MEDIUM,
      title: "Theme Store version is outdated",
      body: `Your theme (${snap.theme.name}) has a newer version available (v${themeStoreLatestVersion} vs your v${installedVersion}). Updates often include performance and security fixes.`,
      fixSteps: getFixSteps("THM_OUTDATED"),
      fixDeepLink: themesLink(snap.shop.handle),
      evidence: { installedVersion, themeStoreLatestVersion },
    });
  },
};
