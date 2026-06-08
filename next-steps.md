# Launch Doctor — Next Steps (v1.1 candidates)

## Auto-fixes (Audit Plus tier)
- One-click deep-links are v1; v1.1 could add guided fix wizards
- Safe auto-fixes for low-risk items (enable lazy loading meta, bulk alt text suggestions)

## Multi-language support
- Localized fix steps and report PDFs
- Market-specific rule thresholds (EU vs US shipping)

## Agency multi-store dashboard
- Partner API integration for agencies managing multiple merchant stores
- Bulk audit scheduling and white-label PDF reports

## API limitations noted in v1
- `PAY_AUTO_CAPTURE`: infers capture mode from recent order financial status (API 2025-10 has no `paymentSettings.autoCapture`)
- `PAY_NO_3DS_EU`: 3DS configuration not fully exposed via Admin API — collector uses defaults
- `CHK_VISIBLE_DISCOUNT_FIELD`: confidence 0.6 — checkout UI settings partially inferred
- `THM_*` mobile rules: skipped with confidence 0 when Playwright times out
- Theme section detection (reviews, upsell, delivery date): heuristic-based from theme files

## Performance
- Cache StoreSnapshot fragments between weekly rescans
- Incremental product collection for stores with 500+ products

## Billing
- Bundle pricing for agencies (10 audits/month)
- Annual Audit Plus discount
