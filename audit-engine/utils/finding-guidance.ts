/**
 * Canonical admin navigation and fix guidance for audit findings.
 * Keep rule fixSteps and finding-playbook in sync via this module.
 */

export const ADMIN = {
  policiesLegal: "Settings → Policies (Legal)",
  payments: "Settings → Payments",
  paymentsShopifyPayments: "Settings → Payments → Shopify Payments",
  shipping: "Settings → Shipping and delivery",
  locations: "Settings → Locations",
  general: "Settings → General",
  checkout: "Settings → Checkout",
  checkoutCustomize: "Settings → Checkout → Configurations → Customize",
  domains: "Settings → Domains",
  markets: "Settings → Markets",
  notifications: "Settings → Notifications",
  onlineStorePreferences: "Online Store → Preferences",
  themes: "Online Store → Themes",
  themesCustomize: "Online Store → Themes → Customize",
  themesEditCode: "Online Store → Themes → Edit code",
  pages: "Online Store → Pages",
  products: "Products",
  messagingAutomations: "Apps → Messaging → Automations",
  appStoreReviews: "Shopify App Store → Search \"product reviews\"",
  googleSearchConsole: "Google Search Console",
} as const;

export interface FindingGuidanceEntry {
  whyItMatters: string;
  adminPath: string;
  actionLabel: string;
  tips?: string[];
  fixSteps: string[];
}

export const FINDING_GUIDANCE: Record<string, FindingGuidanceEntry> = {
  PAY_AUTO_CAPTURE: {
    whyItMatters:
      "Auto-captured payments are hard to unwind after fulfillment. One fraudulent order can cost you product, shipping, and a chargeback fee before you spot it.",
    adminPath: ADMIN.payments,
    actionLabel: "Open payment settings",
    tips: [
      "Manual capture is safer until you have 50+ legitimate orders and know your average order value.",
      "Shopify Protect (free Shop Pay chargeback protection in eligible regions) is not a store-wide toggle — it applies to qualifying Shop Pay orders when Shopify Payments is active.",
    ],
    fixSteps: [
      `Go to ${ADMIN.payments}`,
      "Under Payment capture method, select Manually while you are still building order history",
      "In Orders, open new orders and review fraud analysis (risk indicators) before you capture or fulfill",
      "If you use Shopify Payments, enable Shop Pay where available — eligible US Shop Pay orders may qualify for Shopify Protect chargeback coverage",
    ],
  },
  PAY_TEST_MODE: {
    whyItMatters:
      "Test mode means real customers cannot pay you. Orders look successful in admin but no money is collected.",
    adminPath: ADMIN.paymentsShopifyPayments,
    actionLabel: "Open payment settings",
    tips: ["Complete Shopify Payments setup and submit verification documents before launching ads."],
    fixSteps: [
      `Go to ${ADMIN.paymentsShopifyPayments}`,
      "Deactivate test mode on your payment provider",
      "Place a test order to confirm live payments work",
    ],
  },
  PAY_NO_3DS_EU: {
    whyItMatters:
      "Strong Customer Authentication is required for many EU card payments. Shopify Payments applies 3D Secure automatically when needed.",
    adminPath: ADMIN.paymentsShopifyPayments,
    actionLabel: "Open Shopify Payments",
    fixSteps: [
      `Go to ${ADMIN.paymentsShopifyPayments}`,
      "Complete Shopify Payments setup and activation",
      "3D Secure is applied automatically for eligible EU transactions once Shopify Payments is active",
    ],
  },
  PAY_MANUAL_METHODS_RAW: {
    whyItMatters:
      "Manual payment instructions in the default email template confuse buyers and look unprofessional, leading to abandoned orders.",
    adminPath: `${ADMIN.notifications} → Customer notifications`,
    actionLabel: "Open notification templates",
    tips: ["Edit the \"Order confirmation\" and \"Payment pending\" templates to match your brand voice."],
    fixSteps: [
      `Go to ${ADMIN.notifications}`,
      "Open Customer notifications → Order confirmation",
      "Add clear payment instructions for manual payment methods",
    ],
  },
  POL_REFUND_MISSING: {
    whyItMatters:
      "Payment providers and marketplaces review your refund policy during disputes. A missing policy makes chargebacks harder to win.",
    adminPath: ADMIN.policiesLegal,
    actionLabel: "Edit refund policy",
    tips: ["Include: return window (e.g. 30 days), item condition, who pays return shipping, and refund timeline."],
    fixSteps: [
      `Go to ${ADMIN.policiesLegal}`,
      "Create or expand your Refund policy",
      "Include return window, condition requirements, and refund timeline",
    ],
  },
  POL_ALL_MISSING: {
    whyItMatters:
      "Privacy, terms, and shipping policies are legally required in many regions and linked from checkout and your footer.",
    adminPath: ADMIN.policiesLegal,
    actionLabel: "Open store policies",
    fixSteps: [
      `Go to ${ADMIN.policiesLegal}`,
      "Create all missing policy pages",
      "Use Shopify policy templates as a starting point",
    ],
  },
  PAY_WALLETS_DISABLED: {
    whyItMatters:
      "Apple Pay, Google Pay, and Shop Pay reduce checkout friction on mobile. They are included with an active Shopify Payments setup.",
    adminPath: ADMIN.paymentsShopifyPayments,
    actionLabel: "Open Shopify Payments",
    fixSteps: [
      `Go to ${ADMIN.paymentsShopifyPayments}`,
      "Complete Shopify Payments activation",
      "Verify accelerated checkout buttons appear on checkout after setup",
    ],
  },
  SHIP_LOW_INTL_RATE: {
    whyItMatters:
      "International customers abandon carts when shipping looks unreasonably expensive compared to the product price.",
    adminPath: ADMIN.shipping,
    actionLabel: "Open shipping settings",
    tips: ["Use calculated rates or flat rates that reflect actual carrier costs for each zone."],
    fixSteps: [
      `Go to ${ADMIN.shipping}`,
      "Review international zone rates",
      "Set rates that cover actual carrier costs plus packaging",
    ],
  },
  SHIP_NO_HOME_ZONE: {
    whyItMatters:
      "Without a domestic shipping zone, customers in your home country may see no shipping options at checkout.",
    adminPath: ADMIN.shipping,
    actionLabel: "Open shipping settings",
    fixSteps: [
      `Go to ${ADMIN.shipping}`,
      "Add a zone covering your home country",
      "Set at least one shipping rate for domestic orders",
    ],
  },
  SHIP_NO_ROW: {
    whyItMatters:
      "Rest-of-world coverage ensures international visitors can complete checkout instead of hitting a dead end.",
    adminPath: ADMIN.shipping,
    actionLabel: "Open shipping settings",
    tips: ["Add a \"Rest of world\" zone with a flat rate or carrier-calculated rates."],
    fixSteps: [
      `Go to ${ADMIN.shipping}`,
      "Add a Rest of World zone",
      "Set a rate that covers international shipping costs",
    ],
  },
  SHIP_NO_FREE_THRESHOLD: {
    whyItMatters:
      "Free-shipping thresholds increase average order value. Most stores set the threshold 15–30% above their current AOV.",
    adminPath: ADMIN.shipping,
    actionLabel: "Open shipping settings",
    fixSteps: [
      `Go to ${ADMIN.shipping}`,
      "Add a free shipping rate at 1.2–1.5× your average order value",
      "Promote the threshold on product and cart pages",
    ],
  },
  PROD_NO_WEIGHT: {
    whyItMatters:
      "Weight is required for accurate shipping calculations. Missing weights cause under-charged shipping or checkout errors.",
    adminPath: `${ADMIN.products} → [product] → Variants → Shipping`,
    actionLabel: "Open products",
    tips: ["Bulk-edit variants: select all → Edit → add weight in the Shipping section."],
    fixSteps: [
      `Go to ${ADMIN.products} and bulk-edit variant weights`,
      "Weigh sample products and apply consistent weights",
      "Verify shipping rates calculate correctly at checkout",
    ],
  },
  LOC_MISSING: {
    whyItMatters:
      "A fulfillment location is required for inventory tracking and shipping rate calculations.",
    adminPath: ADMIN.locations,
    actionLabel: "Open locations",
    fixSteps: [
      `Go to ${ADMIN.locations}`,
      "Add your warehouse or fulfillment address",
      "Enable online order fulfillment for the location",
    ],
  },
  LOC_INCOMPLETE: {
    whyItMatters:
      "An incomplete fulfillment address breaks shipping rate and tax calculations at checkout.",
    adminPath: ADMIN.locations,
    actionLabel: "Open locations",
    fixSteps: [
      `Go to ${ADMIN.locations}`,
      "Complete the address for your primary fulfillment location",
      "Verify shipping zones reference the correct origin",
    ],
  },
  PDP_NO_DELIVERY_DATE: {
    whyItMatters:
      "Delivery date estimates reduce \"where is my order?\" support tickets and increase buyer confidence on product pages.",
    adminPath: `${ADMIN.themesCustomize} → Product page`,
    actionLabel: "Open theme editor",
    tips: ["Add a delivery date block or app section to your product template in the theme customizer."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize}`,
      "Open the Product page template",
      "Add a delivery estimate block or compatible app section",
    ],
  },
  PROD_THIN_DESC: {
    whyItMatters:
      "Thin descriptions hurt SEO and conversion. Product pages with 150+ words typically rank better and answer buyer questions.",
    adminPath: `${ADMIN.products} → [product] → Description`,
    actionLabel: "Open products",
    tips: ["Cover: who it's for, materials, sizing, care instructions, and what's in the box."],
    fixSteps: [
      `Go to ${ADMIN.products} and review short descriptions`,
      "Add benefits, materials, sizing, and use cases",
      "Aim for at least 150 characters per product",
    ],
  },
  PROD_SINGLE_IMAGE: {
    whyItMatters:
      "Multiple angles and lifestyle shots reduce returns. Shoppers cannot touch the product — photos must do the selling.",
    adminPath: `${ADMIN.products} → [product] → Media`,
    actionLabel: "Open products",
    tips: ["Aim for 4+ images: hero, detail, scale, and in-use/lifestyle shot."],
    fixSteps: [
      `Go to ${ADMIN.products} and add images`,
      "Include front, detail, and lifestyle shots",
      "Use consistent lighting and backgrounds",
    ],
  },
  PROD_MISSING_ALT: {
    whyItMatters:
      "Alt text helps Google Image Search and screen readers. It's free SEO and improves accessibility compliance.",
    adminPath: `${ADMIN.products} → [product] → Media → Edit alt text`,
    actionLabel: "Open products",
    tips: ["Describe what's in the image, not \"product photo\" — e.g. \"Blue ceramic mug on white table\"."],
    fixSteps: [
      `Go to ${ADMIN.products} and bulk-edit image alt text`,
      "Include product name, color, and key feature in alt text",
      "Avoid keyword stuffing",
    ],
  },
  PROD_NO_SKU: {
    whyItMatters:
      "SKUs are essential for inventory management, fulfillment apps, and accounting integrations as you scale.",
    adminPath: `${ADMIN.products} → [product] → Variants → SKU`,
    actionLabel: "Open products",
    fixSteps: [
      `Go to ${ADMIN.products} and assign SKUs to variants`,
      "Use a consistent naming convention (e.g. PROD-COLOR-SIZE)",
      "Export and bulk-edit via CSV if needed",
    ],
  },
  PROD_PRICE_OUTLIER: {
    whyItMatters:
      "A variant priced far above or below the rest usually indicates a data entry error that will confuse customers.",
    adminPath: `${ADMIN.products} → [product] → Variants → Price`,
    actionLabel: "Open products",
    fixSteps: [
      `Go to ${ADMIN.products} and review multi-variant products`,
      "Check for missing decimal points or wrong prices",
      "Correct any pricing errors before launch",
    ],
  },
  PROD_BROKEN_COMPARE_AT: {
    whyItMatters:
      "Compare-at prices must be higher than the sale price. Incorrect values look like fake discounts and erode trust.",
    adminPath: `${ADMIN.products} → [product] → Variants → Compare-at price`,
    actionLabel: "Open products",
    fixSteps: [
      `Go to ${ADMIN.products} and review sale badges`,
      "Set compare-at price higher than current price, or remove it",
      "Only show discounts when compare-at reflects genuine MSRP",
    ],
  },
  PROD_DUPLICATE: {
    whyItMatters:
      "Near-duplicate product titles split SEO authority and confuse customers browsing your catalog.",
    adminPath: ADMIN.products,
    actionLabel: "Open products",
    tips: ["Merge duplicates or differentiate titles clearly (e.g. by size, color, or bundle contents)."],
    fixSteps: [
      `Go to ${ADMIN.products}`,
      "Identify products with nearly identical titles",
      "Merge duplicates or rename them clearly",
    ],
  },
  PROD_INVENTORY_OFF: {
    whyItMatters:
      "Without inventory tracking, you can oversell and disappoint customers. Shopify cannot warn you when stock runs out.",
    adminPath: `${ADMIN.products} → [product] → Variants → Inventory`,
    actionLabel: "Open products",
    tips: ["Enable \"Track quantity\" and set a low-stock alert threshold."],
    fixSteps: [
      `Go to ${ADMIN.products} and enable inventory tracking on variants`,
      "Set initial stock quantities",
      "Configure out-of-stock behavior (hide or continue selling)",
    ],
  },
  SEO_DEFAULT_TITLE: {
    whyItMatters:
      "Your homepage title appears in Google search results. A generic title wastes your most valuable SEO real estate.",
    adminPath: ADMIN.onlineStorePreferences,
    actionLabel: "Open store preferences",
    tips: ["Format: Brand Name — Primary Product Category | Key Benefit"],
    fixSteps: [
      `Go to ${ADMIN.onlineStorePreferences}`,
      "Set a descriptive homepage title with your primary keyword",
      "Keep it under 60 characters",
    ],
  },
  SEO_NO_META_DESC: {
    whyItMatters:
      "Meta descriptions appear under your link in search results. A compelling description improves click-through rate.",
    adminPath: ADMIN.onlineStorePreferences,
    actionLabel: "Open store preferences",
    fixSteps: [
      `Go to ${ADMIN.onlineStorePreferences}`,
      "Write a compelling meta description (120–160 characters)",
      "Include your primary value proposition and keyword",
    ],
  },
  SEO_ROBOTS_BLOCKED: {
    whyItMatters:
      "If robots.txt blocks crawlers, Google cannot index your store and you will get zero organic search traffic.",
    adminPath: `${ADMIN.onlineStorePreferences} → Password protection`,
    actionLabel: "Open store preferences",
    tips: [
      "Shopify adds Disallow: / automatically while your store is password-protected — remove the password before launch.",
      "robots.txt.liquid is not included by default; most merchants fix this in Preferences, not theme code.",
    ],
    fixSteps: [
      `Go to ${ADMIN.onlineStorePreferences}`,
      "In Password protection, remove the password or disable the password page",
      "Visit yourstore.com/robots.txt and confirm Disallow: / is gone",
    ],
  },
  SEO_NO_SITEMAP: {
    whyItMatters:
      "Shopify generates sitemap.xml automatically. A missing or empty sitemap usually means the store is password-protected or has no published content.",
    adminPath: ADMIN.googleSearchConsole,
    actionLabel: "Open Google Search Console",
    tips: [
      "Shopify creates sitemap.xml automatically — you do not edit it in Preferences.",
      "If the store is password-protected, remove the password before launch, then submit the sitemap in Search Console.",
    ],
    fixSteps: [
      "Visit yourstore.com/sitemap.xml and confirm it loads with URLs",
      "If the store is password-protected, go to Online Store → Preferences and remove the password",
      "After launch, submit your sitemap in Google Search Console",
    ],
  },
  SEO_NO_CUSTOM_DOMAIN: {
    whyItMatters:
      "A custom domain (yourbrand.com) looks professional and is required for most ad platforms and email deliverability.",
    adminPath: `${ADMIN.domains} → Connect existing domain`,
    actionLabel: "Open domain settings",
    fixSteps: [
      `Go to ${ADMIN.domains}`,
      "Connect your custom domain",
      "Set it as the primary domain",
    ],
  },
  SEO_HEAVY_IMAGES: {
    whyItMatters:
      "Large images slow page load, hurt Google rankings, and increase mobile bounce rate.",
    adminPath: `${ADMIN.products} → [product] → Media`,
    actionLabel: "Open products",
    tips: ["Compress images to under 200 KB. Use WebP format where possible."],
    fixSteps: [
      `Go to ${ADMIN.products} and compress large product images`,
      "Re-upload images under 500 KB where possible",
      "Use Shopify's image sizing parameters in theme code",
    ],
  },
  SEO_PRODUCT_META: {
    whyItMatters:
      "Product-level SEO titles and descriptions help individual product pages rank in Google. Missing metadata means lost organic traffic on your catalog.",
    adminPath: ADMIN.products,
    actionLabel: "Open products",
    tips: [
      "Use Audit Plus Fix Center to bulk-fill missing product SEO in one click.",
      "Format: Product Name | Brand — include primary keyword naturally.",
    ],
    fixSteps: [
      `Go to ${ADMIN.products} and open products missing SEO metadata`,
      "Add a unique SEO title and meta description to each product",
      "Use Audit Plus Fix Center to apply suggested metadata in bulk",
    ],
  },
  SEO_HANDLE_NOISE: {
    whyItMatters:
      "URLs with random number suffixes look spammy and are harder to remember or share.",
    adminPath: `${ADMIN.products} → [product] → Search engine listing → URL handle`,
    actionLabel: "Open products",
    fixSteps: [
      `Go to ${ADMIN.products} and open Search engine listing for affected products`,
      "Shorten handles to readable slugs",
      "Set up redirects if you change live product URLs",
    ],
  },
  TRUST_NO_REVIEWS: {
    whyItMatters:
      "Product reviews are the #1 trust signal for new stores. Without them, conversion rates are significantly lower.",
    adminPath: ADMIN.appStoreReviews,
    actionLabel: "Browse review apps",
    tips: [
      "Install a reviews app (Judge.me, Loox, or similar), then add the reviews block in the theme editor.",
    ],
    fixSteps: [
      `Go to ${ADMIN.appStoreReviews}`,
      "Install a product reviews app",
      `Go to ${ADMIN.themesCustomize} → Product page and add the app's reviews block`,
    ],
  },
  TRUST_NO_ABOUT: {
    whyItMatters:
      "An About page tells your story and answers \"who am I buying from?\" — critical for new brands.",
    adminPath: ADMIN.pages,
    actionLabel: "Create About page",
    tips: ["Include founder story, mission, and photos. Link it from your footer navigation."],
    fixSteps: [
      `Go to ${ADMIN.pages} and create an About page`,
      "Share your brand story, mission, and team",
      "Add photos and link the page from your footer navigation",
    ],
  },
  TRUST_NO_CONTACT: {
    whyItMatters:
      "A visible contact method reduces buyer anxiety and is required by many payment providers and ad platforms.",
    adminPath: ADMIN.general,
    actionLabel: "Open store details",
    tips: ["Also add a Contact page with a form or email link in your footer menu."],
    fixSteps: [
      `Go to ${ADMIN.general} and set a store contact email`,
      `Go to ${ADMIN.pages} and create a Contact page`,
      "Link the contact page in your footer",
    ],
  },
  TRUST_VAGUE_RETURNS: {
    whyItMatters:
      "Vague return policies increase pre-purchase hesitation and make dispute resolution harder.",
    adminPath: ADMIN.policiesLegal,
    actionLabel: "Edit refund policy",
    fixSteps: [
      `Go to ${ADMIN.policiesLegal} and expand your Refund policy`,
      "Specify return window (e.g. 30 days)",
      "State who pays return shipping and refund processing time",
    ],
  },
  TRUST_NO_FAQ: {
    whyItMatters:
      "An FAQ page deflects common support questions about shipping, sizing, and returns before customers abandon.",
    adminPath: ADMIN.pages,
    actionLabel: "Create FAQ page",
    fixSteps: [
      `Go to ${ADMIN.pages} and create an FAQ page`,
      "Cover shipping, returns, and sizing questions",
      "Link it from your footer and product pages",
    ],
  },
  TRUST_BROKEN_SOCIAL: {
    whyItMatters:
      "Broken social links in your footer make the store look abandoned or unprofessional.",
    adminPath: `${ADMIN.themesCustomize} → Footer`,
    actionLabel: "Open theme editor",
    tips: ["Remove links you don't use or update URLs to your active profiles."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize}`,
      "Open Footer settings and review social links",
      "Remove broken links or update URLs to active profiles",
    ],
  },
  TRUST_EMPTY_BADGES: {
    whyItMatters:
      "Empty trust badge sections draw attention to what's missing instead of building confidence.",
    adminPath: `${ADMIN.themesCustomize} → Product page`,
    actionLabel: "Open theme editor",
    tips: ["Add payment icons, security badges, or a short guarantee statement."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize}`,
      "Add trust badges or payment icons on the product page",
      "Or remove the empty section if you do not need it",
    ],
  },
  CHK_NO_ABANDONED: {
    whyItMatters:
      "Abandoned checkout emails recover 5–15% of lost sales automatically — often the highest-ROI marketing you can enable.",
    adminPath: ADMIN.messagingAutomations,
    actionLabel: "Open Messaging automations",
    fixSteps: [
      `Go to ${ADMIN.messagingAutomations}`,
      "Turn on the Recover abandoned checkout automation",
      "Customize timing and email content, then save",
    ],
  },
  CHK_VISIBLE_DISCOUNT_FIELD: {
    whyItMatters:
      "A visible discount code field encourages customers to leave and search for coupons instead of completing checkout.",
    adminPath: ADMIN.checkoutCustomize,
    actionLabel: "Open checkout editor",
    fixSteps: [
      `Go to ${ADMIN.checkoutCustomize}`,
      "Disable \"Always show discount code field\" if you have no active promotions",
      "Or create a welcome discount for new customers",
    ],
  },
  CHK_NO_LOCAL_CURRENCY: {
    whyItMatters:
      "Showing prices in the customer's local currency reduces confusion and cart abandonment for international buyers.",
    adminPath: ADMIN.markets,
    actionLabel: "Open markets",
    tips: ["Enable Shopify Markets for your top visitor countries."],
    fixSteps: [
      `Go to ${ADMIN.markets}`,
      "Enable Shopify Markets for your shipping countries",
      "Configure local currency and pricing rules",
    ],
  },
  CHK_NO_UPSELL: {
    whyItMatters:
      "Cart upsells and cross-sells increase average order value without additional ad spend.",
    adminPath: `${ADMIN.themesCustomize} → Cart`,
    actionLabel: "Open theme editor",
    tips: ["Add a \"You may also like\" section or install a post-purchase upsell app."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize}`,
      "Open the Cart template and add cross-sell sections",
      "Or install a cart upsell app from the Shopify App Store",
    ],
  },
  CHK_REQUIRE_PHONE: {
    whyItMatters:
      "Requiring a phone number adds friction at checkout. Only require it if your carrier or fulfillment needs it.",
    adminPath: `${ADMIN.checkout} → Customer contact method`,
    actionLabel: "Open checkout settings",
    fixSteps: [
      `Go to ${ADMIN.checkout}`,
      "Set phone number to optional in Customer contact method",
      "Only require phone if your carrier or SMS notifications need it",
    ],
  },
  CHK_FORCE_ACCOUNT: {
    whyItMatters:
      "Forced account creation before checkout is one of the top causes of cart abandonment.",
    adminPath: `${ADMIN.checkout} → Customer accounts`,
    actionLabel: "Open checkout settings",
    tips: ["Set to \"Accounts are optional\" or \"Accounts are disabled\" for guest checkout."],
    fixSteps: [
      `Go to ${ADMIN.checkout}`,
      "Change customer accounts to optional or disabled",
      "Allow guest checkout to reduce friction",
    ],
  },
  THM_NOT_OS20: {
    whyItMatters:
      "Online Store 2.0 themes support sections on every page, faster updates, and better app block integration.",
    adminPath: `${ADMIN.themes} → Explore free themes`,
    actionLabel: "Browse themes",
    fixSteps: [
      `Go to ${ADMIN.themes}`,
      "Consider upgrading to an Online Store 2.0 theme such as Dawn",
      "Preview the new theme before publishing",
    ],
  },
  THM_LOW_LIGHTHOUSE: {
    whyItMatters:
      "Slow mobile performance directly hurts conversion and Google rankings. Most traffic is mobile.",
    adminPath: ADMIN.themesCustomize,
    actionLabel: "Open theme editor",
    tips: ["Reduce apps, compress images, and avoid heavy homepage slideshows."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize} and reduce heavy sections`,
      "Compress and lazy-load images",
      "Remove unused apps and scripts that add page weight",
    ],
  },
  THM_TINY_TAPS: {
    whyItMatters:
      "Buttons smaller than 48px are hard to tap on mobile, causing mis-taps and frustration.",
    adminPath: `${ADMIN.themesCustomize} → Product page`,
    actionLabel: "Open theme editor",
    tips: ["Increase button padding in theme settings. Minimum tap target: 48×48px."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize} → Product page`,
      "Increase button padding and size for Add to Cart and variant selectors",
      "Test on a real mobile device",
    ],
  },
  THM_HEAVY_HERO: {
    whyItMatters:
      "A large uncompressed hero image is often the #1 cause of slow homepage load on mobile.",
    adminPath: `${ADMIN.themesCustomize} → Homepage`,
    actionLabel: "Open theme editor",
    tips: ["Replace with a compressed image under 300 KB."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize} → Homepage`,
      "Compress the hero image to under 300 KB",
      "Enable lazy loading for below-fold images",
    ],
  },
  THM_SMALL_FONT: {
    whyItMatters:
      "Small product description text is hard to read on mobile and increases bounce rate on product pages.",
    adminPath: `${ADMIN.themesCustomize} → Product page`,
    actionLabel: "Open theme editor",
    fixSteps: [
      `Go to ${ADMIN.themesCustomize} → Product page`,
      "Increase body text font size to at least 14px (16px recommended)",
      "Check readability on a mobile device",
    ],
  },
  THM_NO_STICKY_ATC: {
    whyItMatters:
      "A sticky Add to Cart bar on mobile keeps the purchase button visible while scrolling long product pages.",
    adminPath: `${ADMIN.themesCustomize} → Product page`,
    actionLabel: "Open theme editor",
    tips: ["Many OS 2.0 themes include a sticky ATC block — enable it in the product template."],
    fixSteps: [
      `Go to ${ADMIN.themesCustomize} → Product page`,
      "Add a sticky add-to-cart bar or enable it in theme settings",
      "Test scrolling behavior on mobile",
    ],
  },
  THM_OUTDATED: {
    whyItMatters:
      "Outdated themes miss security patches, performance improvements, and new Shopify features.",
    adminPath: ADMIN.themes,
    actionLabel: "Open themes",
    tips: ["Duplicate your theme before updating, then preview changes on the duplicate first."],
    fixSteps: [
      `Go to ${ADMIN.themes}`,
      "Check for theme updates in the theme library",
      "Preview the update before publishing",
    ],
  },
};

export function getFindingGuidance(ruleCode: string): FindingGuidanceEntry {
  return (
    FINDING_GUIDANCE[ruleCode] ?? {
      whyItMatters: "Fixing this reduces lost revenue and improves customer trust.",
      adminPath: "Shopify admin",
      actionLabel: "Open in admin",
      fixSteps: ["Review this finding in your Shopify admin and apply the recommended fix."],
    }
  );
}

export function getFixSteps(ruleCode: string): string[] {
  return [...getFindingGuidance(ruleCode).fixSteps];
}
