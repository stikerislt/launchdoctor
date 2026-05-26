import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import { buildPublicSnapshot } from "../../collector/snapshot-builder";
import { runAllowlistedRules } from "../../audit-engine/engine";
import { computeLaunchScore } from "../../audit-engine/engine";
import { PerfectScoreCelebration } from "../components/PerfectScoreCelebration";
import { ScoreGauge } from "../components/ScoreGauge";
import { isPerfectLaunchScore } from "../lib/launch-score";
import { FindingCard } from "../components/FindingCard";

const PUBLIC_RULES = [
  "SEO_ROBOTS_BLOCKED",
  "SEO_NO_SITEMAP",
  "SEO_NO_CUSTOM_DOMAIN",
  "TRUST_NO_ABOUT",
  "TRUST_NO_CONTACT",
  "SEO_HEAVY_IMAGES",
  "THM_HEAVY_HERO",
  "THM_LOW_LIGHTHOUSE",
];

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) {
    throw new Response("Shop domain required", { status: 400 });
  }

  const normalized = shopDomain.includes(".")
    ? shopDomain
    : `${shopDomain}.myshopify.com`;

  const snapshot = await buildPublicSnapshot(normalized);
  const findings = runAllowlistedRules(snapshot, PUBLIC_RULES);
  const score = computeLaunchScore(findings);

  return json({ shopDomain: normalized, findings, score });
};

export default function PublicScanner() {
  const { shopDomain, findings, score } = useLoaderData<typeof loader>();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 40, fontFamily: "system-ui" }}>
      <h1>Launch Doctor — Free Store Scan</h1>
      <p style={{ color: "#616161" }}>
        Quick scan of <strong>{shopDomain}</strong> — {findings.length} issues found
      </p>
      <ScoreGauge score={score} />
      {isPerfectLaunchScore(score) && (
        <div style={{ marginTop: 20 }}>
          <PerfectScoreCelebration />
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        {findings.map((f) => (
          <div key={f.ruleCode} style={{ marginBottom: 16 }}>
            <FindingCard
              finding={{ ...f, fixSteps: f.fixSteps }}
              shopHandle={shopDomain.replace(".myshopify.com", "")}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 40, padding: 24, background: "#f6f6f7", borderRadius: 8 }}>
        <h2>Want all 50 checks?</h2>
        <p>Install Launch Doctor to scan fraud risk, shipping, products, checkout, and more.</p>
        <Form method="post" action="/scan/subscribe">
          <input
            type="email"
            name="email"
            placeholder="your@email.com"
            required
            style={{ padding: 8, marginRight: 8, width: 250 }}
          />
          <button type="submit" style={{ padding: "8px 16px", background: "#008060", color: "#fff", border: "none", borderRadius: 4 }}>
            Get full audit
          </button>
        </Form>
      </div>
    </div>
  );
}
