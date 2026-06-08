/** Human-readable guidance when Shopify rejects inventory mutations. */
export function isInventoryAccessError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("write_inventory") ||
    lower.includes("inventoryitemupdate") ||
    (lower.includes("access denied") && lower.includes("inventory")) ||
    lower.includes("permission to update an inventory item")
  );
}

export function formatInventoryFixError(raw: string): string {
  if (!isInventoryAccessError(raw)) return raw;
  return (
    `${raw} To fix this: re-open Launch Doctor from Shopify Admin → Apps and approve ` +
    `updated permissions if prompted, and sign in with a staff account that can manage ` +
    `inventory (Settings → Users → Permissions).`
  );
}

export function sessionHasScope(scope: string | undefined, required: string): boolean {
  if (!scope?.trim()) return false;
  return scope.split(",").map((s) => s.trim()).includes(required);
}
