# Support workflow

Major Step 4 adds the authenticated Support workspace at `/staff/support`.

## Local sign-in

Open `/staff/login`, enter `support@myteracube.com`, and submit the one-time code shown on the page in mock mode. The seeded admin account is `admin@myteracube.com`.

## Queue behavior

- Personal claimed work appears above the open team queue.
- A support agent must claim an item before reviewing it.
- Claimed work can be snoozed for 1, 3, or 7 days with a note.
- Reassigning another agent's item requires a note and is audited.
- Search accepts replacement order number, device serial, or customer email. Results and customer records show masked parent emails; Repair and Logistics never receive parent email data.

## Claim verification

The review state is the shipping-label gate. Support records its verified fault and confirms warranty versus accidental coverage. Paid accidental damage must use the configured paid process. A zero-dollar accidental-damage outcome requires a valid protection-plan or courtesy exception; it cannot be released accidentally. Clarification is handled in the order's live secure conversation, where the parent can answer and attach photos.

## Customer records

Support can search customer records by email or device serial. The device is the identity anchor: if another email tries to start a second active request for the same serial, intake stops immediately and explains that a request is already in progress. Any verified alternate email association is handled automatically; there is no manual merge control.

## Refunds and customer links

Advance-replacement deposits become refundable when the return is in transit or received. The amount may be reduced but cannot exceed the captured deposit remaining. Local mode uses a mock commerce refund; production uses the Shopify adapter described in the README.

Support can create a signed seven-day intake link from a parent email and device serial or child phone. The link pre-identifies the device and verifies its claims server-side. Support can also issue a new 30-day tracking link from an existing order. Raw tracking tokens are shown once and only their hashes are stored; issuance is audited.
