export function canPayOutstandingBalance(input: { status: string; reviewState: string; balanceInCents: number }) {
  return input.balanceInCents > 0 && input.status === "submitted" && input.reviewState === "needs_clarification";
}
