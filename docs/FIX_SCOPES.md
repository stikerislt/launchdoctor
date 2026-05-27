# Fix Center & audit scopes

Launch Doctor requests the minimum scopes needed to **read** store data for audits and **write** data for one-click fixes.

Canonical list: [`app/lib/shopify-scopes.ts`](../app/lib/shopify-scopes.ts).

After changing scopes, run `shopify app deploy` and **reinstall / re-approve** the app on each store.

## Read scopes (audits)

| Scope | Used for |
|-------|----------|
| `read_products` | Catalog, variants, media, SEO fields |
| `read_inventory` | Tracking status, inventory items |
| `read_orders` | Order stats |
| `read_locations` | Fulfillment locations |
| `read_shipping` | Delivery profiles & rates |
| `read_themes` | Theme / OS 2.0 checks |
| `read_content` | Pages, blogs (trust page detection) |
| `read_online_store_pages` | Online store pages |
| `read_legal_policies` | Refund, privacy, terms, shipping policies |
| `read_payment_terms` | Payment terms |
| `read_shopify_payments_payouts` | Payout / payments context |
| `read_customers` | Customer-related audit signals |
| `read_files` | File / image metadata |

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
