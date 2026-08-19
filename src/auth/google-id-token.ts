type GoogleJwtHeader = { alg?: string; kid?: string };
type GoogleJwtClaims = { aud?: string | string[]; email?: string; email_verified?: boolean; exp?: number; iss?: string; sub?: string };
type GoogleJwk = JsonWebKey & { kid?: string };
type GoogleKeySet = { keys?: GoogleJwk[] };

function decodeSegment<T>(segment: string): T {
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
}

export async function verifyGoogleIdToken(idToken: string, clientId: string, now = new Date()): Promise<{ email: string; subject: string } | null> {
  const [encodedHeader, encodedPayload, encodedSignature, extra] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature || extra || !clientId) return null;
  try {
    const header = decodeSegment<GoogleJwtHeader>(encodedHeader);
    const claims = decodeSegment<GoogleJwtClaims>(encodedPayload);
    if (header.alg !== "RS256" || !header.kid) return null;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audience.includes(clientId)) return null;
    if (!claims.email || claims.email_verified !== true || !claims.sub || !claims.exp || claims.exp * 1000 <= now.getTime()) return null;
    if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;

    const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const keySet = (await response.json()) as GoogleKeySet;
    const jwk = keySet.keys?.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      Buffer.from(encodedSignature, "base64url"),
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
    );
    return valid ? { email: claims.email.toLowerCase(), subject: claims.sub } : null;
  } catch {
    return null;
  }
}
