/**
 * OAuth scopes for Launch Doctor (audit collector + Fix Center).
 * Keep in sync with shopify.app.toml, .env.example, and docs/FIX_SCOPES.md.
 */
export const LAUNCH_DOCTOR_READ_SCOPES = [
  "read_content",
  "read_files",
  "read_inventory",
  "read_legal_policies",
  "read_locations",
  "read_online_store_pages",
  "read_orders",
  "read_products",
  "read_shipping",
  "read_themes",
] as const;

/** Required for automated Fix Center actions (see docs/FIX_SCOPES.md). */
export const LAUNCH_DOCTOR_WRITE_SCOPES = [
  "write_content",
  "write_files",
  "write_inventory",
  "write_products",
] as const;

export const LAUNCH_DOCTOR_SCOPES = [
  ...LAUNCH_DOCTOR_READ_SCOPES,
  ...LAUNCH_DOCTOR_WRITE_SCOPES,
] as const;

export const LAUNCH_DOCTOR_SCOPES_CSV = LAUNCH_DOCTOR_SCOPES.join(",");
