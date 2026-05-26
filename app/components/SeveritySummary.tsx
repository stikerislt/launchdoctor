const SEVERITY_KEYS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

interface SeveritySummaryProps {
  counts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

const LABELS: Record<(typeof SEVERITY_KEYS)[number], string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export function SeveritySummary({ counts }: SeveritySummaryProps) {
  return (
    <div className="ld-severity-grid">
      {SEVERITY_KEYS.map((key) => (
        <div key={key} className={`ld-severity-stat ld-severity-stat--${key.toLowerCase()}`}>
          <div className="ld-severity-stat-value">{counts[key]}</div>
          <div className="ld-severity-stat-label">{LABELS[key]}</div>
        </div>
      ))}
    </div>
  );
}
