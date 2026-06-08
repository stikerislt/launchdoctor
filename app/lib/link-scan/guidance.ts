import { redirectsLink } from "../../../audit-engine/utils/deep-link";

/**
 * "Where to go and how to fix it" guidance for each broken link.
 *
 * Phase 1 is read-only: Launch Doctor does not change the store. These steps
 * tell the merchant exactly where in Shopify admin to resolve each issue.
 */

export type LinkKind = "internal_link" | "external_link" | "image";

export interface LinkIssueLike {
  kind: string;
  url: string;
  statusCode: number | null;
  sourceType: string;
  sourceLabel: string;
  sourceAdminUrl: string | null;
}

export interface LinkFixAction {
  label: string;
  url: string;
}

export interface LinkIssueGuidance {
  summary: string;
  steps: string[];
  actions: LinkFixAction[];
}

function pathOf(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return u.pathname + u.search;
  } catch {
    return rawUrl;
  }
}

export function getLinkIssueGuidance(
  issue: LinkIssueLike,
  shopHandle: string,
): LinkIssueGuidance {
  const sourceAction: LinkFixAction[] = issue.sourceAdminUrl
    ? [{ label: `Edit ${issue.sourceLabel}`, url: issue.sourceAdminUrl }]
    : [];

  // Dead link to a path on the merchant's own store → a URL redirect is the
  // correct, SEO-preserving fix (redirects only work for paths returning 404).
  if (issue.kind === "internal_link") {
    const deadPath = pathOf(issue.url);
    return {
      summary:
        "This points to a page on your store that no longer exists. Create a URL redirect so visitors (and search engines) land on a working page instead.",
      steps: [
        "In Shopify admin, go to Content → Menus, then click \"View URL Redirects\" (top right).",
        "Click \"Create URL redirect\".",
        `In \"Redirect from\", enter ${deadPath}`,
        "In \"Redirect to\", enter a live page — a similar product/collection, or / for your homepage.",
        "Click \"Save redirect\". It starts working immediately.",
        `Optionally, edit ${issue.sourceLabel} to update or remove the old link.`,
      ],
      actions: [
        { label: "Open URL Redirects", url: redirectsLink(shopHandle) },
        ...sourceAction,
      ],
    };
  }

  if (issue.kind === "image") {
    return {
      summary:
        "This image fails to load (the file was moved or deleted). Replace or remove it where it's used.",
      steps: [
        `Open ${issue.sourceLabel} in Shopify admin.`,
        "Find the broken image in the content editor.",
        "Re-upload the correct image, or remove the broken image reference.",
        "Save your changes.",
      ],
      actions: sourceAction,
    };
  }

  // External link
  return {
    summary:
      "This links to another website that is no longer reachable. Update it to a working URL or remove the link.",
    steps: [
      `Open ${issue.sourceLabel} in Shopify admin.`,
      "Find the link in the content editor.",
      "Replace it with a working URL, or remove the link if it's no longer relevant.",
      "Save your changes.",
    ],
    actions: sourceAction,
  };
}

export const LINK_KIND_LABELS: Record<string, string> = {
  internal_link: "Dead internal links",
  external_link: "Broken external links",
  image: "Broken images",
};

export const LINK_KIND_ORDER: LinkKind[] = ["internal_link", "image", "external_link"];
