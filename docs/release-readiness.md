# Release readiness

The application ships as a non-root, standalone Node container. Every response receives a content security policy, clickjacking protection, MIME sniffing protection, a restrictive permissions policy, and a privacy-preserving referrer policy. Health checks are uncached and disclose no credentials or infrastructure details.

OTP issuance is limited to one request per minute and five per fifteen minutes for each normalized email and purpose. Provider webhooks remain raw-body signed and idempotent. Structured logging recursively redacts email, phone, ICCID, address, tokens, secrets, codes, and payment fields.

Keyboard focus is visible throughout the application and reduced-motion preferences are honored. Customer failures render a recoverable, plain-language error screen.

`npm run verify` runs type checking, linting, tests, database integrity verification, and the production build. CI runs the same command against PostgreSQL. `npm run production:check` intentionally fails until every required production integration credential has replaced its local value.

Before launch, the selected host must run database migrations as a release command, serve the container over HTTPS, invoke the automation endpoint on schedule, route provider webhooks to the public application, retain encrypted backups, and supply all secrets through its secret manager.
