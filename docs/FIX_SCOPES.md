# Fix Center & audit scopes

Launch Doctor requests the minimum scopes needed to **read** store data for audits and **write** data for one-click fixes.

Canonical list: [`app/lib/shopify-scopes.ts`](../app/lib/shopify-scopes.ts).

After changing scopes, run `shopify app deploy` and **reinstall / re-approve** the app on each store.

## Read scopes (audits)

| Scope | Used for |
|-------|----------|
| `read_products` | Catalog, variants, media, SEO fields |
| `read_inventory` | Tracking status, inventory items |
| `read_orders` | Order stats (see [Protected customer data](#protected-customer-data-level-1)) |
| `read_locations` | Fulfillment locations |
| `read_shipping` | Delivery profiles & rates |
| `read_themes` | Theme / OS 2.0 checks |
| `read_content` | Pages, blogs (trust page detection) |
| `read_online_store_pages` | Online store pages |
| `read_legal_policies` | Refund, privacy, terms, shipping policies |
| `read_files` | File / image metadata |

## Protected customer data (Level 1)

`read_orders` accesses the Shopify `orders` connection, which Shopify classifies as
**protected customer data**. Non-development stores return `ACCESS_DENIED` (HTTP 200
with an `errors` entry) until the app is approved for protected customer data in the
Partner Dashboard. Order queries degrade gracefully (empty data) until then, so audits
still complete — see `collector/snapshot-builder.ts` (`collectOrders`, `loadCaptureHintOrders`).

**Access level required: Level 1 only.** The order queries
(`collector/queries/shop.ts` → `ORDERS_STATS_QUERY`, `ORDERS_CAPTURE_HINT_QUERY`) read
only `totalPriceSet`, `test`, and `displayFinancialStatus`. They do **not** read any
protected customer *fields* (name, address, email, phone), so **Level 2 is not required**
and those fields must **not** be selected in the access request.

| What we read | Why |
|--------------|-----|
| 30-day order count + average order value | Recommend a free-shipping threshold (`rules/11-no-free-threshold.ts`) |
| `displayFinancialStatus` (`AUTHORIZED` / `PAID`) | Detect manual payment-capture risk (`rules/01-auto-capture.ts`) |
| `test` flag | Exclude test orders from the above |

**Request access:** Partner Dashboard → app → **API access requests** → **Protected
customer data access** → **Request access** → select **Protected customer data** (Level 1
only) → provide the justification above → complete **Data protection details** → submit.
Dev stores work as soon as the data is selected; live stores work after approval.

> App listing / review questionnaire: because of `read_orders`, the app **does** use
> protected customer data at **Level 1** (orders, no PII fields). Answer "yes" accordingly.

## Write scopes (Fix Center)

| Scope | Fixes |
|-------|--------|
| `write_products` | Alt text, product SEO, thin descriptions, variant bulk updates (SKUs via `inventoryItem`) |
| `write_files` | Staged uploads for **Optimize images** (WebP) |
| `write_content` | **Trust pages** (About, Contact, FAQ) via `pageCreate` |
| `write_inventory` | **Enable inventory tracking**; SKU on inventory items |

## Fix → API → scope

| Fix | GraphQL (summary) | Scopes |
|-----|-------------------|--------|
| Alt text | `productUpdateMedia` | `write_products` |
| Optimize images | `stagedUploadsCreate`, `productCreateMedia`, `productDeleteMedia`, `productReorderMedia` | `write_files`, `write_products` |
| Homepage SEO | `metafieldsSet` on shop (`global.title_tag`, `description_tag`) | `write_products` (shop owner) |
| Product SEO | `productUpdate` | `write_products` |
| Thin descriptions | `productUpdate` | `write_products` |
| Assign SKUs | `productVariantsBulkUpdate` + `inventoryItem.sku` | `write_products`, `write_inventory` |
| Enable inventory tracking | `inventoryItemUpdate` (`tracked: true`) | `write_inventory` |
| Trust pages | `pageCreate` | `write_content` |

## Manual guidance (no extra scopes today)

Audit findings that only show **deep links** or in-admin steps (e.g. enable capture, shipping zones, app installs) do not need additional write scopes until we add automation for them.

## Deploy checklist

```bash
# shopify.app.toml + .env SCOPES must match shopify-scopes.ts
shopify app deploy --allow-updates
```

Reinstall on dev stores after deploy so new scopes take effect.
