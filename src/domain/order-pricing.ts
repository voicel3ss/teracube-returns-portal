export function quotedTotalInCents(input: { quotedFeeInCents: number; quotedDepositInCents: number }) {
  return Math.max(0, input.quotedFeeInCents) + Math.max(0, input.quotedDepositInCents);
}

export function outstandingBalanceInCents(input: {
  quotedFeeInCents: number;
  quotedDepositInCents: number;
  amountPaidInCents: number;
}) {
  return Math.max(0, quotedTotalInCents(input) - Math.max(0, input.amountPaidInCents));
}

export function refundableDepositInCents(input: {
  quotedDepositInCents: number;
  amountPaidInCents: number;
  depositRefundedInCents: number;
}) {
  return Math.max(
    0,
    Math.min(Math.max(0, input.quotedDepositInCents), Math.max(0, input.amountPaidInCents))
      - Math.max(0, input.depositRefundedInCents),
  );
}
