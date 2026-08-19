# Automation and webhook foundation

Major Step 7 adds a provider-neutral event boundary while production credentials remain intentionally unconfigured.

## Shipping webhook

`POST /api/webhooks/shipping` accepts signed tracking events. The raw body is verified with HMAC-SHA256 using `WEBHOOK_SIGNING_SECRET` and the `x-teracube-signature` header. Provider event IDs are stored once, making retries idempotent. Valid events update the shipment, append tracking history, advance the replacement order, add a customer-visible update, and write an audit event.

## Scheduled automation

`POST /api/jobs/automation` requires `Authorization: Bearer <AUTOMATION_JOB_SECRET>`. Each run polls provider tracking for nonterminal shipments, advances shipment/order state only forward, opens Support work for carrier exceptions, attempts a validated outbound-serial backfill, and then evaluates return reminders, return escalations, unidentified-order escalation, and stale claimed work. Durable markers prevent duplicate reminders and escalations if a scheduler retries the job.

Local providers now generate deterministic inbound labels, tracking identifiers, helpdesk replies, commerce references, and object-storage keys. Production adapters retain the same interfaces and replace these local implementations without changing the workflows.
