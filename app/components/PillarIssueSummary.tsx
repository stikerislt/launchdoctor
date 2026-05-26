import { SeveritySummary } from "./SeveritySummary";

type Counts = {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
};

interface PillarIssueSummaryProps {
  title: string;
  subtitle: string;
  counts: Counts;
  issueCount: number;
  lockedHint?: string;
  variant?: "default" | "seo";
}

export function PillarIssueSummary({
  title,
  subtitle,
  counts,
  issueCount,
  lockedHint,
  variant = "default",
}: PillarIssueSummaryProps) {
  return (
    <div
      className={`ld-pillar-summary ${variant === "seo" ? "ld-pillar-summary--seo" : ""}`}
    >
      <h3 className="ld-pillar-summary-title">{title}</h3>
      <p className="ld-pillar-summary-subtitle">{subtitle}</p>
      <p className="ld-pillar-summary-count">
        {issueCount} issue{issueCount === 1 ? "" : "s"} detected
      </p>
      <div className="ld-pillar-summary-hint-slot">
        {lockedHint ? (
          <p className="ld-pillar-summary-lock">{lockedHint}</p>
        ) : null}
      </div>
      <div className="ld-pillar-summary-stats">
        <SeveritySummary counts={counts} />
      </div>
    </div>
  );
}
