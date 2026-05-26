import { Badge } from "@shopify/polaris";

const SEVERITY_CONFIG = {
  CRITICAL: { tone: "critical" as const, label: "Critical" },
  HIGH: { tone: "warning" as const, label: "High" },
  MEDIUM: { tone: "attention" as const, label: "Medium" },
  LOW: { tone: "info" as const, label: "Low" },
};

interface SeverityBadgeProps {
  severity: keyof typeof SEVERITY_CONFIG;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function severityCounts(findings: Array<{ severity: string }>) {
  return {
    CRITICAL: findings.filter((f) => f.severity === "CRITICAL").length,
    HIGH: findings.filter((f) => f.severity === "HIGH").length,
    MEDIUM: findings.filter((f) => f.severity === "MEDIUM").length,
    LOW: findings.filter((f) => f.severity === "LOW").length,
  };
}
