import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

import { APP_ICON_SRC } from "../../lib/assets";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Installs always originate from a Shopify-owned surface and arrive with a
  // `shop` (and host) param — hand those straight off to the embedded app/OAuth.
  // We intentionally do NOT prompt for a myshopify.com domain here (App Store
  // requirement 2.3.1: installation must initiate from a Shopify surface).
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function App() {
  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <img
          src={APP_ICON_SRC}
          alt="Launch Doctor"
          width={72}
          height={72}
          style={{ margin: "0 auto", borderRadius: 16 }}
        />
        <h1 className={styles.heading}>Launch Doctor</h1>
        <p className={styles.text}>
          Scan your store against 50 launch-readiness checks across payments,
          shipping, SEO, trust pages, and checkout — then fix what matters in one click.
        </p>
        <a
          className={styles.button}
          href="https://apps.shopify.com"
          target="_blank"
          rel="noreferrer"
        >
          Install from the Shopify App Store
        </a>
        <ul className={styles.list}>
          <li>
            <strong>50-point store audit</strong>. Find fraud, shipping, SEO, and
            checkout issues before they cost you sales.
          </li>
          <li>
            <strong>Launch Score</strong>. See core readiness and SEO scores with
            issues ranked by severity.
          </li>
          <li>
            <strong>One-click Fix Center</strong>. Apply SEO titles, alt text, and
            catalog fixes without leaving your admin.
          </li>
        </ul>
      </div>
    </div>
  );
}
