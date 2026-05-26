export function isPerfectLaunchScore(score: number | null | undefined): boolean {
  return score === 100;
}

export const PERFECT_SCORE_TITLE = "Congratulations — Launch Score 100";

export const PERFECT_SCORE_MESSAGE =
  "Your store passed every active check in this audit. Keep monitoring after catalog, theme, or checkout changes — re-run an audit anytime to stay launch-ready.";
