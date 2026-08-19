export function emailDeliveryConfigured(): boolean {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  return Boolean(token && from && !token.startsWith("replace-with"));
}

export async function deliverVerificationCode(input: { to: string; code: string; expiresAt: Date; purpose: "customer" | "staff" }): Promise<void> {
  const token = process.env.POSTMARK_SERVER_TOKEN?.trim();
  const from = process.env.POSTMARK_FROM_EMAIL?.trim();
  if (!emailDeliveryConfigured() || !token || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured.");
    return;
  }
  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "x-postmark-server-token": token },
    body: JSON.stringify({
      From: from,
      To: input.to,
      Subject: input.purpose === "staff" ? "Your Teracube staff sign-in code" : "Verify your Teracube repair request",
      TextBody: `Your Teracube verification code is ${input.code}. It expires at ${input.expiresAt.toISOString()}. If you did not request this code, you can ignore this message.`,
      MessageStream: "outbound",
    }),
  });
  if (!response.ok) throw new Error("The verification email could not be delivered.");
}
