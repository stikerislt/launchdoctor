/**
 * Seed script documenting 14 deliberate issues for demo/review stores.
 * Run against a dev store via Shopify Admin after install.
 *
 * Issues seeded:
 * 1. PAY_AUTO_CAPTURE - Settings → Payments → automatic capture (not manual)
 * 2. POL_REFUND_MISSING - clear refund policy
 * 3. SHIP_LOW_INTL_RATE - set intl rate to $2
 * 4. SHIP_NO_HOME_ZONE - remove home country from zones
 * 5. PROD_THIN_DESC - products with <50 char descriptions
 * 6. SEO_ROBOTS_BLOCKED - password protect store (blocks crawlers)
 * 7. TRUST_NO_CONTACT - remove contact email and page
 * 8. CHK_NO_ABANDONED - disable abandoned checkout email
 * 9. THM_LOW_LIGHTHOUSE - install heavy apps/scripts
 * 10. PROD_SINGLE_IMAGE - products with 1 image
 * 11. SEO_NO_META_DESC - clear homepage meta description
 * 12. PAY_WALLETS_DISABLED - disable digital wallets
 * 13. LOC_MISSING - incomplete location address
 * 14. CHK_FORCE_ACCOUNT - require accounts at checkout
 */

console.log(`
Launch Doctor — Dev Store Seeding Guide
========================================

Configure these 14 issues manually on your dev store:

1. Settings → Payments → Payment capture method → Automatically at checkout
2. Settings → Policies (Legal) → Delete/refund policy content (<50 chars)
3. Settings → Shipping → International zone rate $2.00
4. Settings → Shipping → Remove home country from zones
5. Products → Set descriptions under 50 characters on 30%+ products
6. Online Store → Preferences → Enable password (blocks robots.txt)
7. Settings → General → Remove store contact email; delete contact page
8. Apps → Messaging → Automations → Disable abandoned checkout
9. Install 5+ heavy apps to degrade Lighthouse score
10. Products → Leave only 1 image on 30%+ products
11. Online Store → Preferences → Clear homepage meta description
12. Settings → Payments → Disable Shop Pay / Apple Pay / Google Pay
13. Settings → Locations → Clear address fields on primary location
14. Settings → Checkout → Require customer accounts

After seeding, run an audit from the Launch Doctor dashboard.
Expected: 14 findings matching the codes above.
`);
