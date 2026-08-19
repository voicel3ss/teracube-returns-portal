# Teracube Device Care

A unit-centric replacement, repair, and refurbishment portal for Teracube.

The application serves parents, customer support, repair technicians, logistics, operations leads, and administrators from one Next.js application backed by PostgreSQL.

## Local development

Requirements: Node.js 20.19+ and npm.

```bash
npm install
npm run db:generate
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the domain model, workflow boundaries, route plan, integration contracts, and build phases.

See [`docs/security.md`](docs/security.md) for authentication, authorization, PII, encryption, and audit guarantees.

See [`docs/parent-journey.md`](docs/parent-journey.md) for the working customer flow, sample device records, and local pricing.

See [`docs/repair-workflow.md`](docs/repair-workflow.md) for the repair-team queue, serial ledger, recorded resolutions, terminal outcomes, and batch-QC flow.

See [`docs/logistics-workflow.md`](docs/logistics-workflow.md) for inbound reconciliation, outbound dispatch, and internal-transfer label handling.

See [`docs/automation-and-webhooks.md`](docs/automation-and-webhooks.md) for signed provider events, idempotency, tracking updates, and scheduled reminders and escalations.

See [`docs/admin-and-oversight.md`](docs/admin-and-oversight.md) for management alerts, oversight reports, and editable workflow policy.

See [`docs/release-readiness.md`](docs/release-readiness.md) for security controls, CI, container deployment, health checks, and the production launch gate.

See [`docs/support-workflow.md`](docs/support-workflow.md) for the protected work queue, claim verification, duplicate-request prevention, deposit refunds, live conversation, and secure-link workflow.

For local checkout testing, use the in-form verification code and the “Use sample address” button. Real delivery and address-provider credentials are connected in the production integrations milestone.

## Production API implementation checklist

The application keeps external services behind provider interfaces. Local development uses deterministic mocks; production must replace each required mock below without changing the order or device workflows.

### Required for the customer replacement flow

| Status | Service / API | Responsibility | Production implementation |
| --- | --- | --- | --- |
| Required | [Postmark Email API](https://postmarkapp.com/developer/user-guide/send-email-with-api) | Deliver customer and staff six-digit verification codes | The adapter activates when its token and sender are configured, and production never returns `verificationCode`. Configure a verified Teracube sending domain, DKIM/SPF/DMARC, delivery and bounce webhooks, and provider-level monitoring before launch. |
| Required | [Google Address Validation API](https://developers.google.com/maps/documentation/address-validation/overview) | Validate, correct, and standardize shipping addresses | Replace `MockAddressValidationProvider`. For US addresses, request USPS CASS processing, evaluate the verdict and component confirmation levels, show suggested corrections to the parent, and sign only the exact accepted standardized address. Address validation establishes deliverability, not residency or ownership. |
| Required | [Shopify Admin GraphQL API](https://shopify.dev/docs/api/admin-graphql) and checkout/payment APIs | Create the uniform `$0` or paid order, capture fee plus deposit, retain the shipping address in Shopify, refund deposits, and create silent outbound fulfillment orders | Replace `MockCommerceProvider`. Store only Shopify references and payment last four when available—never raw card data. Suppress Shopify customer notifications because the portal/Freshdesk owns communication. Use idempotency and verify every Shopify webhook signature before changing order state. |
| Required | [ShipSaving API](https://www.shipsaving.com/) | Create inbound labels and QR codes, purchase postage, and track customer returns and replacements | Replace the shipping mock behind `ShippingProvider`. Persist provider shipment IDs and tracking events. Download label/QR bytes into object storage because provider URLs may expire. Verify signed webhooks where available and run a scheduled tracking poller as a fallback. Confirm the final API contract and webhook documentation with ShipSaving before implementation. |
| Optional | [Freshdesk API](https://developers.freshdesk.com/api/) | Mirror requests into the existing helpdesk for internal continuity | Replace `MockHelpdeskProvider` if Teracube wants helpdesk mirroring. The portal's secure live conversation is the parent communication source of truth, so replies and photo uploads do not depend on email. |
| Required | Thrive device/identity API | Resolve child phone or serial to authoritative serial, ICCID, parent assignment, and later backfill the outbound replacement serial | Replace `MockIdentityProvider`. The exact Thrive base URL, authentication method, schemas, rate limits, and webhook/polling support must be obtained from the internal Thrive owner. Never accept customer-typed model data as authoritative. |
| Required | [Gigs API](https://developers.gigs.com/) | Look up plan state using the ICCID returned by Thrive | Replace `MockPlanProvider`. Store only the fields needed for eligibility and support; define timeout, retry, and unavailable-provider behavior before launch. |
| Required | S3-compatible object-storage API | Durably store label PDFs, QR images, repair photos, and manually uploaded internal-transfer labels | Implement `ObjectStorageProvider` using AWS S3, Cloudflare R2, or Tigris. Store object keys in PostgreSQL, use private buckets, validate upload type/size, encrypt at rest, and issue short-lived signed read URLs. |

### Authentication and trusted entry

| Status | Service / API | Responsibility | Production implementation |
| --- | --- | --- | --- |
| Required | Google Identity / OpenID Connect | Staff Google sign-in | Validate Google ID tokens server-side, restrict access to active staff records, link the stable provider subject to `StaffIdentity`, and then issue the portal's revocable 30-day staff session. |
| Required | Postmark Email API | Staff email OTP fallback | Reuse the email delivery adapter while keeping `staff_login` challenges purpose-isolated from `customer_email` challenges. Apply stricter authentication rate limits and non-enumerating responses. |
| Required | Parent-app signed deep-link API | Let the trusted Parent app open the repair flow already associated with its authenticated parent and device | The portal now validates an expiring server-signed entry claim. Production should use the owning Parent-app team's key exchange and add issuer, audience, nonce, and replay protection. |

Firebase Authentication is optional, not required for the current parent flow. It is useful if parents later receive persistent accounts or passwordless magic-link login. It does not replace postal-address validation, Shopify, shipping, or helpdesk APIs, and Firebase's Trigger Email extension still requires an SMTP delivery service. The present account-free, six-digit-code flow is simpler with Postmark.

### Events, automation, and operations

| Status | Service / API | Responsibility | Production implementation |
| --- | --- | --- | --- |
| Required | Webhook ingress for Shopify, ShipSaving, Freshdesk, and storage/security events | Drive payment, fulfillment, shipment, and communication state changes | Give each provider its own route and signing secret. Verify signatures against the raw request body, reject stale/replayed events, persist provider event IDs, return quickly, and process events idempotently. Never expose a generic unsigned status-update endpoint. |
| Required | Scheduled jobs / worker | Poll tracking when webhooks are unavailable; send day-4 reminders; raise day-6, unidentified, stale-claim, and stuck-unit alerts; backfill outbound serials | Run jobs outside request handlers using the chosen host's scheduler or a dedicated worker. Protect every job with a distributed lock and idempotency key. |
| Required | [Sentry](https://docs.sentry.io/platforms/javascript/guides/nextjs/) | Server/client exception reporting and alerting | Redact email, phone, ICCID, address, tokens, and payment references before transmission. Separate development and production environments and upload source maps securely. |
| Required | Structured application logging | Correlate orders, shipments, provider calls, jobs, and webhooks | Add request and correlation IDs and log provider/event identifiers without logging PII, secrets, verification codes, raw webhook bodies, or customer access tokens. Forward production logs through the selected host. |

### Configuration and secrets

Production credentials must live in the hosting platform's secret manager, never in the repository or browser bundle. Expected server-only configuration includes:

```text
POSTMARK_SERVER_TOKEN
POSTMARK_FROM_EMAIL
GOOGLE_ADDRESS_VALIDATION_API_KEY
SHOPIFY_STORE_DOMAIN
SHOPIFY_ADMIN_ACCESS_TOKEN
SHOPIFY_WEBHOOK_SECRET
SHIPSAVING_API_KEY
SHIPSAVING_WEBHOOK_SECRET
FRESHDESK_DOMAIN
FRESHDESK_API_KEY
THRIVE_API_BASE_URL
THRIVE_API_TOKEN
GIGS_API_BASE_URL
GIGS_API_TOKEN
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_REGION
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY_ID
OBJECT_STORAGE_SECRET_ACCESS_KEY
GOOGLE_STAFF_OAUTH_CLIENT_ID
PARENT_APP_TOKEN_ISSUER
PARENT_APP_TOKEN_AUDIENCE
PARENT_APP_PUBLIC_KEY
SENTRY_DSN
DATABASE_URL
AUTH_TOKEN_SECRET
PII_ENCRYPTION_KEY
```

Exact names may change with the selected adapters, but `.env.example`, runtime validation, deployment secrets, and this checklist must remain synchronized.

### Recommended implementation order

1. Postmark customer/staff OTP delivery and bounce handling.
2. Google Address Validation with USPS CASS and customer correction confirmation.
3. Shopify checkout, `$0` orders, payment/deposit capture, refunds, fulfillment, and signed webhooks.
4. ShipSaving labels, QR codes, tracking webhooks, and polling fallback.
5. Object storage for labels, QR codes, repair photos, and manual uploads.
6. Optional Freshdesk request mirroring for internal continuity.
7. Thrive identity resolution and outbound-serial backfill.
8. Gigs plan lookup by ICCID.
9. Google staff SSO and trusted Parent-app deep links.
10. Scheduled jobs, Sentry, structured logs, replay protection, and production readiness testing.

The authoritative product specification is `../context/New Repair Workflow/PRD_V2.md`.
