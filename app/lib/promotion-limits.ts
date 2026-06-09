/** Max manual full-store audits per store per rolling 7 days while promotion is active. */
export const PROMOTION_WEEKLY_MANUAL_AUDIT_LIMIT = 3;

export const PROMOTION_LIMIT_MESSAGE =
  "During the free promotion, each store is limited to 3 full audits per week.";

export type PromotionAuditLimit = {
  limited: boolean;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  exempt?: boolean;
  resetsAt: string | null;
};
