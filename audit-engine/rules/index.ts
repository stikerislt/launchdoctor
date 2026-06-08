import type { Rule } from "../types";
import { payAutoCaptureRule } from "./01-auto-capture";
import { payTestModeRule } from "./02-test-mode";
import { payNo3dsEuRule } from "./03-no-3ds-eu";
import { payManualMethodsRawRule } from "./04-manual-methods-raw";
import { polRefundMissingRule } from "./05-refund-missing";
import { polAllMissingRule } from "./06-all-policies-missing";
import { payWalletsDisabledRule } from "./07-wallets-disabled";
import { shipLowIntlRateRule } from "./08-low-intl-rate";
import { shipNoHomeZoneRule } from "./09-no-home-zone";
import { shipNoRowRule } from "./10-no-row";
import { shipNoFreeThresholdRule } from "./11-no-free-threshold";
import { prodNoWeightRule } from "./12-no-weight";
import { locMissingRule } from "./13-loc-missing";
import { pdpNoDeliveryDateRule } from "./14-pdp-no-delivery-date";
import { prodThinDescRule } from "./15-thin-desc";
import { prodSingleImageRule } from "./16-single-image";
import { prodMissingAltRule } from "./17-missing-alt";
import { prodNoSkuRule } from "./18-no-sku";
import { prodPriceOutlierRule } from "./19-price-outlier";
import { prodBrokenCompareAtRule } from "./20-broken-compare-at";
import { prodDuplicateRule } from "./21-duplicate";
import { prodInventoryOffRule } from "./22-inventory-off";
import { seoDefaultTitleRule } from "./23-default-title";
import { seoNoMetaDescRule } from "./24-no-meta-desc";
import { seoRobotsBlockedRule } from "./25-robots-blocked";
import { seoNoSitemapRule } from "./26-no-sitemap";
import { seoNoCustomDomainRule } from "./27-no-custom-domain";
import { seoHeavyImagesRule } from "./28-heavy-images";
import { seoProductMetaRule } from "./29-product-meta";
import { seoHandleNoiseRule } from "./30-handle-noise";
import { trustNoReviewsRule } from "./31-no-reviews";
import { trustNoAboutRule } from "./32-no-about";
import { trustNoContactRule } from "./33-no-contact";
import { trustVagueReturnsRule } from "./34-vague-returns";
import { trustNoFaqRule } from "./35-no-faq";
import { trustBrokenSocialRule } from "./36-broken-social";
import { trustEmptyBadgesRule } from "./37-empty-badges";
import { chkNoAbandonedRule } from "./38-no-abandoned";
import { chkVisibleDiscountFieldRule } from "./39-visible-discount-field";
import { chkNoLocalCurrencyRule } from "./40-no-local-currency";
import { chkNoUpsellRule } from "./41-no-upsell";
import { chkRequirePhoneRule } from "./42-require-phone";
import { chkForceAccountRule } from "./43-force-account";
import { thmNotOs20Rule } from "./44-not-os20";
import { thmLowLighthouseRule } from "./45-low-lighthouse";
import { thmTinyTapsRule } from "./46-tiny-taps";
import { thmHeavyHeroRule } from "./47-heavy-hero";
import { thmSmallFontRule } from "./48-small-font";
import { thmNoStickyAtcRule } from "./49-no-sticky-atc";
import { thmOutdatedRule } from "./50-outdated";
import { prodNoImageRule } from "./51-no-image";
import { prodPngFormatRule } from "./52-png-format";

export const allRules: Rule[] = [
  payAutoCaptureRule,
  payTestModeRule,
  payNo3dsEuRule,
  payManualMethodsRawRule,
  polRefundMissingRule,
  polAllMissingRule,
  payWalletsDisabledRule,
  shipLowIntlRateRule,
  shipNoHomeZoneRule,
  shipNoRowRule,
  shipNoFreeThresholdRule,
  prodNoWeightRule,
  locMissingRule,
  pdpNoDeliveryDateRule,
  prodThinDescRule,
  prodSingleImageRule,
  prodMissingAltRule,
  prodNoSkuRule,
  prodPriceOutlierRule,
  prodBrokenCompareAtRule,
  prodDuplicateRule,
  prodInventoryOffRule,
  seoDefaultTitleRule,
  seoNoMetaDescRule,
  seoRobotsBlockedRule,
  seoNoSitemapRule,
  seoNoCustomDomainRule,
  seoHeavyImagesRule,
  seoProductMetaRule,
  seoHandleNoiseRule,
  trustNoReviewsRule,
  trustNoAboutRule,
  trustNoContactRule,
  trustVagueReturnsRule,
  trustNoFaqRule,
  trustBrokenSocialRule,
  trustEmptyBadgesRule,
  chkNoAbandonedRule,
  chkVisibleDiscountFieldRule,
  chkNoLocalCurrencyRule,
  chkNoUpsellRule,
  chkRequirePhoneRule,
  chkForceAccountRule,
  thmNotOs20Rule,
  thmLowLighthouseRule,
  thmTinyTapsRule,
  thmHeavyHeroRule,
  thmSmallFontRule,
  thmNoStickyAtcRule,
  thmOutdatedRule,
  prodNoImageRule,
  prodPngFormatRule,
];

export const ruleByCode = new Map(allRules.map((r) => [r.code, r]));
export const ruleById = new Map(allRules.map((r) => [r.id, r]));
