import type { Category, Severity } from "@prisma/client";
import prisma from "./prisma.server";
import { hasAuditPlus, isDevBillingBypassEnabled } from "./billing.server";
import { getFindingGuidance } from "../../audit-engine/utils/finding-guidance";
import {
  PREVIEW_FINDING_COUNT,
  serializeFindingForClient,
  type SerializedFinding,
} from "../../audit-engine/utils/audit-serialize";
import { computeAllScores, type ScoreFinding } from "../../audit-engine/engine";
import { filterFindingsByDismissals, getDismissedRuleCodes } from "./fixes/dismissals.server";
import { pickPreviewFindingIds } from "./finding-summary";

export { PREVIEW_FINDING_COUNT };

export function resolveScoresFromFindings(
  findings: ReadonlyArray<ScoreFinding>,
  storedLaunchScore: number | null = null,
  dismissedRuleCodes: ReadonlySet<string> = new Set(),
) {
  if (findings.length === 0) {
    return {
      launchScore: storedLaunchScore,
      coreScore: null as number | null,
      seoScore: null as number | null,
    };
  }

  const activeFindings = filterFindingsByDismissals(findings, dismissedRuleCodes);
  return computeAllScores(activeFindings);
}

/** Rules with fix steps that depend on runtime evidence at audit time. */
const STORED_FIX_STEPS_RULES = new Set([
  "SEO_ROBOTS_BLOCKED",
  "SEO_NO_SITEMAP",
  "LOC_MISSING",
]);

export type ClientFinding = SerializedFinding & {
  whyItMatters?: string;
  adminPath?: string;
  actionLabel?: string;
  tips?: string[];
};

export type ClientAudit = {
  id: string;
  status: string;
  launchScore: number | null;
  coreScore: number | null;
  seoScore: number | null;
  completedAt: Date | null;
  isUnlocked: boolean;
  pdfUrl: string | null;
  errorMessage: string | null;
  findings: ClientFinding[];
  store: { shopDomain: string };
};

export async function isAuditContentUnlocked(audit: {
  isUnlocked: boolean;
  storeId: string;
}): Promise<boolean> {
  if (isDevBillingBypassEnabled()) return true;
  if (audit.isUnlocked) return true;
  return hasAuditPlus(audit.storeId);
}

export async function loadAuditForShop(auditId: string, shopDomain: string) {
  return prisma.audit.findFirst({
    where: {
      id: auditId,
      store: { shopDomain },
    },
    include: {
      findings: { orderBy: [{ severity: "asc" }, { ruleId: "asc" }] },
      store: true,
    },
  });
}

function enrichWithPlaybook(finding: SerializedFinding): ClientFinding {
  if (finding.locked) return finding;

  const guidance = getFindingGuidance(finding.ruleCode);
  const fixSteps = STORED_FIX_STEPS_RULES.has(finding.ruleCode)
    ? finding.fixSteps
    : guidance.fixSteps;

  return {
    ...finding,
    severity: finding.severity as Severity,
    category: finding.category as Category,
    fixSteps,
    whyItMatters: guidance.whyItMatters,
    adminPath: guidance.adminPath,
    actionLabel: guidance.actionLabel,
    tips: guidance.tips,
  };
}

export async function serializeAuditForClient(
  audit: NonNullable<Awaited<ReturnType<typeof loadAuditForShop>>>,
): Promise<ClientAudit> {
  const contentUnlocked = await isAuditContentUnlocked(audit);
  const dismissedRuleCodes = await getDismissedRuleCodes(audit.storeId);
  const activeFindings = filterFindingsByDismissals(audit.findings, dismissedRuleCodes);
  const scores =
    audit.findings.length > 0
      ? computeAllScores(activeFindings)
      : resolveScoresFromFindings([], audit.launchScore, dismissedRuleCodes);

  const previewUnlockedIds = contentUnlocked
    ? null
    : new Set(
        pickPreviewFindingIds(
          activeFindings.map((finding) => ({
            id: finding.id,
            ruleCode: finding.ruleCode,
            severity: finding.severity,
          })),
        ),
      );

  return {
    id: audit.id,
    status: audit.status,
    launchScore: scores.launchScore,
    coreScore: scores.coreScore,
    seoScore: scores.seoScore,
    completedAt: audit.completedAt,
    isUnlocked: contentUnlocked,
    pdfUrl: contentUnlocked ? audit.pdfUrl : null,
    errorMessage: audit.errorMessage,
    store: { shopDomain: audit.store.shopDomain },
    findings: activeFindings.map((finding, index) =>
      enrichWithPlaybook(
        serializeFindingForClient(finding, contentUnlocked, previewUnlockedIds, index),
      ),
    ),
  };
}
