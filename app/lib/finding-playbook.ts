import {
  FINDING_GUIDANCE,
  getFindingGuidance,
  type FindingGuidanceEntry,
} from "../../audit-engine/utils/finding-guidance";

export type FindingPlaybookEntry = FindingGuidanceEntry;

export const FINDING_PLAYBOOK = FINDING_GUIDANCE;

export function getPlaybookEntry(ruleCode: string): FindingPlaybookEntry {
  return getFindingGuidance(ruleCode);
}
