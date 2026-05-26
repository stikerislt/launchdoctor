const GENERIC_PRODUCT_TITLE_PATTERNS = [
  /^product\s*\d*$/i,
  /^product\s+\d+$/i,
  /^new product\s*\d*$/i,
  /^untitled( product)?\s*\d*$/i,
  /^default title$/i,
  /^item\s+\d+$/i,
  /^test product\s*\d*$/i,
  /^sample\s*\d*$/i,
  /^draft\s*\d*$/i,
  /^placeholder\s*\d*$/i,
  /^copy of .+$/i,
];

export function isGenericProductTitle(title: string | null | undefined): boolean {
  const normalized = title?.trim() ?? "";
  if (!normalized) return true;
  return GENERIC_PRODUCT_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function humanizeProductHandle(handle: string): string {
  return handle
    .replace(/-\d{5,}$/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function suggestProductTitle(
  currentTitle: string,
  handle: string,
): string {
  if (!isGenericProductTitle(currentTitle)) {
    return currentTitle.trim();
  }

  const fromHandle = humanizeProductHandle(handle);
  if (fromHandle.length >= 3 && !isGenericProductTitle(fromHandle)) {
    return fromHandle;
  }

  return currentTitle.trim();
}
