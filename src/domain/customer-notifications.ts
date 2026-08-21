export function money(amountInCents: number) {
  return `$${(amountInCents / 100).toFixed(2)}`;
}

export function orderSubmittedMessage(amountPaidInCents: number) {
  return `We received your request and recorded a payment of ${money(amountPaidInCents)}. Support will verify the request before releasing the return label or replacement.`;
}

export function identificationHelpMessage() {
  return "We received your request. Support will help identify the device and reply here if anything else is needed.";
}

export function refundIssuedMessage(amountInCents: number) {
  return `A ${money(amountInCents)} deposit refund was issued to the original payment method.`;
}

export function replacementDispatchedMessage(carrier: string, trackingNumber: string) {
  return `Your replacement has shipped with ${carrier}. Tracking number: ${trackingNumber}. Move your SIM card to the replacement when it arrives.`;
}

export function replacementPreparingMessage() {
  return "Your replacement was sent to the warehouse for fulfillment. Its tracking number will appear here once the package is allocated.";
}

export function returnReceivedMessage(input: { discrepancy: boolean; closed: boolean }) {
  if (input.discrepancy) return "We received your package. Support is reviewing the package contents and will update you here.";
  if (input.closed) return "We received your returned device. Your replacement request is now complete.";
  return "We received your returned device.";
}

export function carrierUpdateMessage(input: { description: string; closed: boolean }) {
  return input.closed ? `${input.description} Your replacement request is now complete.` : input.description;
}
