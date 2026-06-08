import { isGenericProductTitle } from "./product-naming";
import type { ProductSeoDraft } from "./types";

export type ProductSeoEditState = {
  productTitle: string;
  seoTitle: string;
  seoDescription: string;
};

export function productSeoInitialEditState(draft: ProductSeoDraft): ProductSeoEditState {
  return {
    productTitle: draft.productTitle,
    seoTitle: draft.currentSeoTitle,
    seoDescription: draft.currentSeoDescription,
  };
}

export function productSeoEditTouched(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): boolean {
  const initial = productSeoInitialEditState(draft);
  return (
    edit.productTitle.trim() !== initial.productTitle.trim() ||
    edit.seoTitle.trim() !== initial.seoTitle.trim() ||
    edit.seoDescription.trim() !== initial.seoDescription.trim()
  );
}

export function productSeoHasChanges(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): boolean {
  return describeProductSeoChanges(draft, edit).length > 0;
}

/** Ready to include in a partial save (valid fields + differs from store). */
export function productSeoSavable(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): boolean {
  return productSeoDraftReady(draft, edit) && productSeoHasChanges(draft, edit);
}

export function productSeoDraftReady(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): boolean {
  const seoTitle = edit.seoTitle.trim();
  const seoDescription = edit.seoDescription.trim();
  if (!seoTitle || !seoDescription) return false;
  if (draft.hasBadProductTitle) {
    const productTitle = edit.productTitle.trim();
    return Boolean(productTitle && !isGenericProductTitle(productTitle));
  }
  return true;
}

/** Why a touched product cannot be saved yet (omit untouched products). */
export function productSeoSaveBlockedReason(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): string | null {
  if (!productSeoEditTouched(draft, edit)) {
    return null;
  }
  if (!edit.seoTitle.trim()) {
    return `${draft.productTitle}: add an SEO title.`;
  }
  if (!edit.seoDescription.trim()) {
    return `${draft.productTitle}: add a meta description.`;
  }
  if (draft.hasBadProductTitle) {
    const name = edit.productTitle.trim();
    if (!name) {
      return `${draft.productTitle}: add a product name.`;
    }
    if (isGenericProductTitle(name)) {
      return `${draft.productTitle}: replace the generic name (e.g. “Product 2”) with a descriptive name.`;
    }
  }
  return null;
}

export function productSeoSuggestionsApplied(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): boolean {
  const titleOk = draft.hasBadProductTitle
    ? edit.productTitle.trim() === draft.suggestedProductTitle &&
      !isGenericProductTitle(edit.productTitle.trim())
    : true;
  return (
    titleOk &&
    edit.seoTitle.trim() === draft.suggestedSeoTitle &&
    edit.seoDescription.trim() === draft.suggestedSeoDescription
  );
}

export function describeProductSeoChanges(
  draft: ProductSeoDraft,
  edit: ProductSeoEditState,
): string[] {
  const lines: string[] = [];
  if (draft.hasBadProductTitle && edit.productTitle.trim() !== draft.productTitle.trim()) {
    lines.push(`Product name → ${edit.productTitle.trim() || draft.suggestedProductTitle}`);
  }
  if (edit.seoTitle.trim() && edit.seoTitle.trim() !== draft.currentSeoTitle) {
    lines.push(`SEO title → ${edit.seoTitle.trim()}`);
  }
  if (edit.seoDescription.trim() && edit.seoDescription.trim() !== draft.currentSeoDescription) {
    const preview =
      edit.seoDescription.trim().length > 72
        ? `${edit.seoDescription.trim().slice(0, 72)}…`
        : edit.seoDescription.trim();
    lines.push(`Meta description → ${preview}`);
  }
  return lines;
}
