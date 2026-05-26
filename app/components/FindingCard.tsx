import { Button, Text } from "@shopify/polaris";
import { Link } from "@remix-run/react";
import { SeverityBadge } from "./SeverityBadge";
import { resolveAdminDeepLink } from "../../audit-engine/utils/deep-link";
import { formatEvidence } from "../lib/format-evidence";

const SEVERITY_ACCENT = {
  CRITICAL: "#d72c0d",
  HIGH: "#ed6f05",
  MEDIUM: "#b98900",
  LOW: "#008060",
} as const;

interface FindingCardProps {
  finding: {
    id?: string;
    ruleCode: string;
    severity: string;
    category: string;
    title: string;
    body: string;
    fixSteps: string[] | unknown;
    fixDeepLink: string | null;
    evidence?: Record<string, unknown> | null;
    confidence: number;
    locked?: boolean;
    whyItMatters?: string;
    adminPath?: string;
    actionLabel?: string;
    tips?: string[];
  };
  shopHandle: string;
  unlockUrl?: string;
}

export function FindingCard({ finding, shopHandle, unlockUrl }: FindingCardProps) {
  const locked = finding.locked === true;
  const steps = locked
    ? []
    : Array.isArray(finding.fixSteps)
      ? (finding.fixSteps as string[])
      : [];
  const accent = SEVERITY_ACCENT[finding.severity as keyof typeof SEVERITY_ACCENT] ?? "#616161";
  const actionUrl = locked
    ? null
    : resolveAdminDeepLink(finding.fixDeepLink, finding.ruleCode, shopHandle);
  const isExternalLink =
    (actionUrl?.startsWith("https://search.google.com") ||
      actionUrl?.startsWith("https://apps.shopify.com")) ??
    false;
  const evidenceLines = locked
    ? []
    : formatEvidence(
        finding.ruleCode,
        finding.evidence as Record<string, unknown> | null | undefined,
      );

  const content = (
    <>
      <div className="ld-finding-meta">
        <h3 className="ld-finding-title">{finding.title}</h3>
        <SeverityBadge severity={finding.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"} />
      </div>

      {!locked && finding.confidence < 0.8 && (
        <Text as="p" variant="bodySm" tone="subdued">
          Review recommended — confidence {Math.round(finding.confidence * 100)}%
        </Text>
      )}

      <div className="ld-finding-section">
        <h4 className="ld-finding-section-title">The issue</h4>
        <Text as="p" variant="bodyMd">{finding.body}</Text>
      </div>

      {!locked && finding.whyItMatters && (
        <div className="ld-finding-section ld-finding-section--impact">
          <h4 className="ld-finding-section-title">Why this matters</h4>
          <Text as="p" variant="bodyMd">{finding.whyItMatters}</Text>
        </div>
      )}

      {evidenceLines.length > 0 && (
        <div className="ld-finding-section">
          <h4 className="ld-finding-section-title">What we detected</h4>
          <ul className="ld-evidence-list">
            {evidenceLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {!locked && steps.length > 0 && finding.adminPath && (
        <div className="ld-fix-steps">
          <h4>How to fix</h4>
          <div className="ld-admin-path">
            <span className="ld-admin-path-label">Go to</span>
            <span className="ld-admin-path-value">{finding.adminPath}</span>
          </div>
          <ol>
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {!locked && finding.tips && finding.tips.length > 0 && (
        <div className="ld-tip-callout">
          <strong>Pro tip:</strong> {finding.tips[0]}
        </div>
      )}

      {actionUrl && (
        <div className="ld-finding-actions">
          <Button url={actionUrl} target="_blank" variant="primary">
            {finding.actionLabel ?? "Open in Shopify admin"} →
          </Button>
            <Text as="span" variant="bodySm" tone="subdued">
              {isExternalLink
                ? "Opens an external site in a new tab"
                : "Opens Shopify admin in a new tab"}
            </Text>
        </div>
      )}
    </>
  );

  return (
    <div
      className={`ld-finding-card${locked ? " ld-finding-card--locked" : ""}`}
      style={{ borderLeftColor: accent }}
    >
      <div className={`ld-finding-card-inner${locked ? " ld-finding-card-blurred" : ""}`}>
        {content}
      </div>

      {locked && unlockUrl && (
        <div className="ld-finding-unlock-overlay">
          <div className="ld-finding-unlock-panel">
            <Text as="p" variant="bodyMd" alignment="center">
              Fix steps, evidence, and admin shortcuts are included in the full report.
            </Text>
            <Link to={unlockUrl} style={{ textDecoration: "none" }}>
              <Button variant="primary">Unlock full report — $19</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
