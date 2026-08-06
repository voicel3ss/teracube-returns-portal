# Security foundation

## Authentication

- Staff can authenticate through Google identity or a six-digit email OTP. Both providers sit behind testable interfaces; development uses deterministic mocks until real credentials are supplied.
- OTP codes expire after 10 minutes, are HMAC-hashed at rest, are single-use, and lock after five failures.
- OTP challenges are purpose-scoped: a customer email code cannot be reused for staff login, or vice versa.
- Customer email and address confirmations become short-lived, HMAC-signed assertions bound to the exact normalized value. Order APIs verify both assertions rather than trusting browser state.
- Staff sessions use 256-bit opaque tokens. Only SHA-256 token hashes are stored. Sessions expire after 30 days and can be revoked.
- Customer links use separate 256-bit tokens scoped to exactly one customer and one replacement order. Parent-app-issued tokens are marked explicitly.
- Unknown and inactive staff OTP requests return the same response as valid requests to prevent account enumeration.

## Authorization

- Staff can hold multiple team memberships.
- Every protected operation checks a named permission.
- PII access is evaluated under the staff member's active team context. This prevents someone operating as Repair from inheriting unrelated PII access through another membership.
- Repair is hard-blocked from child phone, ICCID, parent email, parent address, and payment references.
- Logistics is hard-blocked from every listed PII field except an audited, on-demand address reveal.

## PII

- UI values are masked by default.
- Shipping addresses have an authenticated AES-256-GCM encryption helper for application-layer encryption before persistence.
- Every successful reveal must persist an audit event before plaintext is returned. If audit persistence fails, the reveal fails closed.
- Audit metadata records the field and active team, never the revealed value.

## Audit integrity

- The application exposes append-only audit repository methods.
- PostgreSQL independently rejects every `UPDATE` and `DELETE` against `audit_events` through database triggers.
- Actor, action, affected entity, timestamp, metadata, and optional IP address are captured.

## Database guarantees

- Fees, deposits, payments, and refunds cannot be negative.
- Refund totals cannot exceed the corresponding payment total.
- A customer cannot have more than one primary email.
- Normalized customer email values must be lowercase.
- OTP failure counts cannot exceed the lockout threshold.
