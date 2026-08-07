# Support workflow

Major Step 4 adds the authenticated Support workspace at `/staff/support`.

## Local sign-in

Open `/staff/login`, enter `support@myteracube.com`, and submit the one-time code shown on the page in mock mode. The seeded admin account is `admin@myteracube.com`.

## Queue behavior

- Personal claimed work appears above the open team queue.
- A support agent must claim an item before reviewing it.
- Claimed work can be snoozed for 1, 3, or 7 days with a note.
- Reassigning another agent's item requires a note and is audited.
- Search accepts replacement order number, device serial, or customer email; list results mask email addresses.

## Claim verification

The review state is the shipping-label gate. Support records its verified fault and confirms warranty versus accidental coverage. A coverage change is blocked because it requires repricing. Every zero-dollar warranty result requires an internal reason. A clarification request remains attached to the order's communication ticket.

## Customer records

Customer merge is preview-then-confirm. Support chooses the surviving record and primary email. Emails, devices, replacement orders, and access tokens move to the survivor; the source record is retained as merged, not deleted. Serial conflicts are called out during preview and every merge is audited.

## Refunds and customer links

Advance-replacement deposits become refundable when the return is in transit or received. The amount may be reduced but cannot exceed the captured deposit remaining. Local mode uses a mock commerce refund; production uses the Shopify adapter described in the README.

Support can issue a new 30-day preauthenticated tracking link from an order. The raw token is shown once and only its hash is stored. Link issuance is audited.
