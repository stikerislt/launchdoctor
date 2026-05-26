const TIMEOUT_MS = 5000;

export interface SitemapBreakdown {
  total: number;
  products: number;
  collections: number;
  pages: number;
}

export interface PublicFetchResult {
  robotsTxtBlocksAll: boolean;
  storefrontPasswordProtected: boolean;
  sitemapStatus: number;
  sitemapUrlCount: number;
  sitemap: SitemapBreakdown;
  gscVerified: boolean;
  homepageSeo: { title: string | null; description: string | null };
  pages: {
    about: boolean;
    aboutBodyLength: number;
    contact: boolean;
    faq: boolean;
  };
}

export function parseSitemapBreakdown(sitemapText: string): SitemapBreakdown {
  const locs = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(
    (match) => match[1]?.trim() ?? "",
  );

  let products = 0;
  let collections = 0;
  let pages = 0;

  for (const loc of locs) {
    if (/\/products\//i.test(loc)) products++;
    else if (/\/collections\//i.test(loc)) collections++;
    else if (/\/pages\//i.test(loc)) pages++;
  }

  return {
    total: locs.length,
    products,
    collections,
    pages,
  };
}

export async function fetchPublicData(
  shopDomain: string,
): Promise<PublicFetchResult> {
  const baseUrl = shopDomain.startsWith("http")
    ? shopDomain
    : `https://${shopDomain}`;

  const [robots, sitemap, about, contact, faq, homepage] = await Promise.all([
    fetchWithTimeout(`${baseUrl}/robots.txt`),
    fetchWithTimeout(`${baseUrl}/sitemap.xml`),
    fetchWithTimeout(`${baseUrl}/pages/about`),
    fetchWithTimeout(`${baseUrl}/pages/contact`),
    fetchWithTimeout(`${baseUrl}/pages/faq`),
    fetchWithTimeout(`${baseUrl}?_ld=${Date.now()}`),
  ]);

  const robotsText = robots.ok ? await robots.text() : "";
  const sitemapText = sitemap.ok ? await sitemap.text() : "";
  const homepageHtml = homepage.ok ? await homepage.text() : "";
  const aboutHtml = about.ok ? await about.text() : "";
  const robotsTxtBlocksAll = /User-agent:\s*\*[\s\S]*?Disallow:\s*\//i.test(robotsText);
  const sitemapBreakdown = parseSitemapBreakdown(sitemapText);

  return {
    robotsTxtBlocksAll,
    storefrontPasswordProtected: isStorefrontPasswordProtected(homepageHtml),
    sitemapStatus: sitemap.status,
    sitemapUrlCount: sitemapBreakdown.total,
    sitemap: sitemapBreakdown,
    gscVerified:
      homepageHtml.includes("google-site-verification") ||
      homepageHtml.includes("google-site-verification"),
    homepageSeo: parseHomepageSeo(homepageHtml),
    pages: {
      about: about.ok,
      aboutBodyLength: stripHtml(aboutHtml).length,
      contact: contact.ok,
      faq: faq.ok,
    },
  };
}

export async function headCheck(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function parseHomepageSeo(html: string): {
  title: string | null;
  description: string | null;
} {
  if (!html) return { title: null, description: null };

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const metaMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);

  return {
    title: titleMatch?.[1]?.replace(/\s+/g, " ").trim() || null,
    description: metaMatch?.[1]?.replace(/\s+/g, " ").trim() || null,
  };
}

function isStorefrontPasswordProtected(html: string): boolean {
  if (!html) return false;

  return (
    /password-page|site-password|storefront-password|Enter store using password|Opening soon/i.test(
      html,
    ) ||
    (html.includes('name="password"') && html.includes("/password"))
  );
}
