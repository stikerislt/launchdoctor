import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { graphqlWithRetry } from "./graphql";

/**
 * Broken Link Finder crawler (Audit Plus, Phase 1 — read-only).
 *
 * Discovers links/images embedded in the merchant's own content (products,
 * pages, blog articles) plus the storefront homepage, then checks each unique
 * target's HTTP status. It does NOT modify the store — results guide the
 * merchant to the fix (see app/lib/link-scan/guidance.ts).
 */

const MAX_SOURCES = 500; // source documents (products + pages + articles)
const MAX_LINKS = 3000; // unique URLs to status-check
const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;
const MAX_REDIRECT_HOPS = 5;

export type LinkKind = "internal_link" | "external_link" | "image";
export type LinkSourceType = "product" | "page" | "blog_article" | "homepage";

export interface DiscoveredLink {
  url: string; // absolute, normalized
  kind: LinkKind;
  sourceType: LinkSourceType;
  sourceRef: string | null; // GID / handle
  sourceLabel: string;
  sourceAdminUrl: string | null;
}

export interface BrokenLink extends DiscoveredLink {
  statusCode: number | null; // null/0 = unreachable
  redirectChain: number;
  detail: string | null;
}

export interface LinkScanResult {
  pagesScanned: number;
  linksChecked: number;
  truncated: boolean;
  issues: BrokenLink[];
}

export interface LinkScanProgress {
  pagesScanned?: number;
  linksChecked?: number;
}

const SHOP_QUERY = `#graphql
  query LinkScanShop {
    shop { myshopifyDomain primaryDomain { host url } }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query LinkScanProducts($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          media(first: 20) {
            edges { node { ... on MediaImage { image { url } } } }
          }
        }
      }
    }
  }
`;

const PAGES_QUERY = `#graphql
  query LinkScanPages($cursor: String) {
    pages(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title handle body } }
    }
  }
`;

const BLOGS_QUERY = `#graphql
  query LinkScanBlogs($cursor: String) {
    blogs(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          articles(first: 50) {
            edges { node { id title handle body } }
          }
        }
      }
    }
  }
`;

interface Connection<T> {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: Array<{ node: T }>;
}

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string | null;
  media: Connection<{ image?: { url?: string | null } | null }>;
}

interface PageNode {
  id: string;
  title: string;
  handle: string;
  body: string | null;
}

interface BlogNode {
  id: string;
  title: string;
  handle: string;
  articles: Connection<{ id: string; title: string; handle: string; body: string | null }>;
}

function numericId(gid: string): string | null {
  const match = gid.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1]! : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function extractRawLinks(html: string): { hrefs: string[]; imgs: string[] } {
  const hrefs: string[] = [];
  const imgs: string[] = [];
  if (!html) return { hrefs, imgs };

  for (const m of html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    hrefs.push(decodeEntities(m[1]!.trim()));
  }
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    imgs.push(decodeEntities(m[1]!.trim()));
  }
  return { hrefs, imgs };
}

const SKIP_PREFIXES = ["mailto:", "tel:", "javascript:", "data:", "sms:", "#"];

function shouldSkip(raw: string): boolean {
  const lower = raw.toLowerCase();
  return raw === "" || SKIP_PREFIXES.some((p) => lower.startsWith(p));
}

function resolveUrl(raw: string, base: string): string | null {
  try {
    const resolved = raw.startsWith("//") ? `https:${raw}` : raw;
    const url = new URL(resolved, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function runLinkScan(
  admin: AdminApiContext,
  shopDomain: string,
  onProgress?: (p: LinkScanProgress) => Promise<void> | void,
): Promise<LinkScanResult> {
  const shopData = await graphqlWithRetry<{
    shop: { myshopifyDomain: string; primaryDomain: { host: string; url: string } };
  }>(admin, SHOP_QUERY).catch(() => null);

  const primaryUrl = shopData?.shop.primaryDomain.url ?? `https://${shopDomain}`;
  const internalHosts = new Set<string>(
    [shopData?.shop.primaryDomain.host, shopData?.shop.myshopifyDomain, shopDomain].filter(
      (h): h is string => Boolean(h),
    ),
  );
  const shopHandle = shopDomain.replace(".myshopify.com", "");

  // url -> first source that referenced it (dedupe; we report one source).
  const linkMap = new Map<string, DiscoveredLink>();
  let pagesScanned = 0;
  let truncated = false;

  const addLinks = (
    html: string,
    source: Omit<DiscoveredLink, "url" | "kind">,
  ) => {
    if (linkMap.size >= MAX_LINKS) {
      truncated = true;
      return;
    }
    const { hrefs, imgs } = extractRawLinks(html ?? "");

    const consider = (raw: string, isImage: boolean) => {
      if (linkMap.size >= MAX_LINKS) {
        truncated = true;
        return;
      }
      if (shouldSkip(raw)) return;
      const abs = resolveUrl(raw, primaryUrl);
      if (!abs) return;
      if (linkMap.has(abs)) return;
      let host: string;
      try {
        host = new URL(abs).host;
      } catch {
        return;
      }
      const internal = internalHosts.has(host);
      // Skip checking the merchant's own Shopify CDN assets that are images on
      // their own domain is still useful, but third-party trackers as anchors
      // are in scope. Classify kind for grouping + guidance.
      const kind: LinkKind = isImage
        ? "image"
        : internal
          ? "internal_link"
          : "external_link";
      linkMap.set(abs, { ...source, url: abs, kind });
    };

    for (const raw of hrefs) consider(raw, false);
    for (const raw of imgs) consider(raw, true);
  };

  // --- Homepage ---
  try {
    const res = await fetchWithTimeout(`${primaryUrl}?_ld=${Date.now()}`);
    if (res.ok) {
      const html = await res.text();
      addLinks(html, {
        sourceType: "homepage",
        sourceRef: null,
        sourceLabel: "Storefront homepage",
        sourceAdminUrl: `https://admin.shopify.com/store/${shopHandle}/online_store/preferences`,
      });
      pagesScanned += 1;
    }
  } catch {
    // homepage optional
  }

  // --- Products ---
  await paginate<ProductNode>(
    (cursor) =>
      graphqlWithRetry<{ products: Connection<ProductNode> }>(admin, PRODUCTS_QUERY, {
        cursor,
      }).then((d) => d.products),
    async (product) => {
      const mediaHtml = product.media.edges
        .map((e) => (e.node.image?.url ? `<img src="${e.node.image.url}">` : ""))
        .join("");
      addLinks((product.descriptionHtml ?? "") + mediaHtml, {
        sourceType: "product",
        sourceRef: product.id,
        sourceLabel: `Product: ${product.title}`,
        sourceAdminUrl: numericId(product.id)
          ? `https://admin.shopify.com/store/${shopHandle}/products/${numericId(product.id)}`
          : null,
      });
      pagesScanned += 1;
      await onProgress?.({ pagesScanned });
    },
  );

  // --- Pages ---
  if (pagesScanned < MAX_SOURCES && !truncated) {
    await paginate<PageNode>(
      (cursor) =>
        graphqlWithRetry<{ pages: Connection<PageNode> }>(admin, PAGES_QUERY, { cursor }).then(
          (d) => d.pages,
        ),
      async (page) => {
        addLinks(page.body ?? "", {
          sourceType: "page",
          sourceRef: page.id,
          sourceLabel: `Page: ${page.title}`,
          sourceAdminUrl: numericId(page.id)
            ? `https://admin.shopify.com/store/${shopHandle}/pages/${numericId(page.id)}`
            : null,
        });
        pagesScanned += 1;
        await onProgress?.({ pagesScanned });
      },
    );
  }

  // --- Blog articles ---
  if (pagesScanned < MAX_SOURCES && !truncated) {
    await paginate<BlogNode>(
      (cursor) =>
        graphqlWithRetry<{ blogs: Connection<BlogNode> }>(admin, BLOGS_QUERY, { cursor }).then(
          (d) => d.blogs,
        ),
      async (blog) => {
        for (const edge of blog.articles.edges) {
          const article = edge.node;
          addLinks(article.body ?? "", {
            sourceType: "blog_article",
            sourceRef: article.id,
            sourceLabel: `Blog post: ${article.title}`,
            sourceAdminUrl: numericId(blog.id)
              ? `https://admin.shopify.com/store/${shopHandle}/blogs/${numericId(blog.id)}/articles/${numericId(article.id) ?? ""}`
              : null,
          });
          pagesScanned += 1;
        }
        await onProgress?.({ pagesScanned });
      },
    );
  }

  const links = [...linkMap.values()];
  await onProgress?.({ linksChecked: 0 });

  const checked = await mapLimit(links, CONCURRENCY, async (link) => {
    const { status, chain } = await checkUrl(link.url);
    return { link, status, chain };
  });

  const issues: BrokenLink[] = [];
  for (const { link, status, chain } of checked) {
    const broken = status === null || status === 0 || status >= 400;
    if (!broken) continue;
    issues.push({
      ...link,
      statusCode: status,
      redirectChain: chain,
      detail:
        status === null || status === 0
          ? "Unreachable (timeout, DNS, or too many redirects)"
          : `HTTP ${status}`,
    });
  }

  return {
    pagesScanned,
    linksChecked: links.length,
    truncated,
    issues,
  };
}

async function paginate<T>(
  fetchPage: (cursor: string | null) => Promise<Connection<T>>,
  onNode: (node: T) => Promise<void>,
): Promise<void> {
  let cursor: string | null = null;
  for (let guard = 0; guard < 50; guard++) {
    const conn: Connection<T> | null = await fetchPage(cursor).catch(() => null);
    if (!conn) return;
    for (const edge of conn.edges) {
      await onNode(edge.node);
    }
    if (!conn.pageInfo.hasNextPage || !conn.pageInfo.endCursor) return;
    cursor = conn.pageInfo.endCursor;
  }
}

async function checkUrl(url: string): Promise<{ status: number | null; chain: number }> {
  let current = url;
  let chain = 0;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    let res: Response;
    try {
      res = await fetchWithTimeout(current, { method: "HEAD", redirect: "manual" });
      // Some servers don't implement HEAD — retry once with GET.
      if (res.status === 405 || res.status === 501) {
        res = await fetchWithTimeout(current, { method: "GET", redirect: "manual" });
      }
    } catch {
      return { status: 0, chain };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { status: res.status, chain };
      const next = resolveUrl(location, current);
      if (!next) return { status: res.status, chain };
      current = next;
      chain += 1;
      continue;
    }

    return { status: res.status, chain };
  }

  // Exceeded redirect budget → treat as a broken (loop) link.
  return { status: 0, chain };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": "LaunchDoctor-LinkChecker/1.0 (+https://launch-doctor.fly.dev)",
        ...(init?.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
