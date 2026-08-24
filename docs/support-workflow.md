# Support workflow

Major Step 4 adds the authenticated Support workspace at `/staff/support`.

## Local sign-in

Open `/staff/login`, enter `support@myteracube.com`, and submit the one-time code shown on the page in mock mode. The seeded admin account is `admin@myteracube.com`.

## Queue behavior

- Personal claimed work appears above the open team queue.
- A support agent must claim an item before reviewing it.
- Claimed work can be paused for one of two explicit reasons: **waiting for customer approval** or **waiting for admin review**. Customer replies automatically resume only the customer-wait state; admin-review waits remain locked until an Admin resumes them. An optional internal note records context without exposing it to the customer.
- Reassigning another agent's item requires a note and is audited.
- Search accepts replacement order number, device serial, or customer email. Results and customer records show masked parent emails; Repair and Logistics never receive parent email data.
- Unsolicited parent replies appear as **Customer message** work. Sending a normal reply completes that item. Asking for a reply pauses the current task, and the same task reopens automatically when the parent answers; unrelated work is not discarded.

## Claim verification

The review state is the shipping-label gate. Support records its verified fault and confirms warranty versus accidental coverage. Paid accidental damage must use the configured paid process. A zero-dollar accidental-damage outcome requires a valid protection-plan or courtesy exception; it cannot be released accidentally. Clarification is handled in the order's live secure conversation, where the parent can answer and attach photos.

Unidentified requests have a dedicated **Identify device** action. Support attaches a known serial, selects its coverage and replacement path, and the request then moves into the normal verification gate. If the parent could not supply a shipping address during intake, the secure tracking page asks for it before Support can release the request.

When Logistics records a returned serial that differs from the expected device, Support receives a dedicated **Resolve return discrepancy** action. Support can continue with a free, paid, or upgrade replacement, or close the request without a replacement. Resolving it completes the discrepancy work item and records the decision in the customer conversation and audit trail.

Inventory and carrier failures create a separate **Resolve fulfillment block** action. Support can retry the current replacement, choose a different customer outcome, or close the request. Resolution resumes from the physical shipment progress already recorded and completes the blocked-work item.

## Customer records

Support can search customer records by email or device serial, including devices associated through previous or current orders even when the device has no current owner assigned. The device is the identity anchor: if another email tries to start a second active request for the same serial, intake stops immediately and explains that a request is already in progress. Any verified alternate email association is handled automatically; there is no manual merge control.

## Refunds and customer links

Advance-replacement deposits become refundable when the return is in transit or received. The amount may be reduced but cannot exceed the captured deposit remaining. Local mode uses a mock commerce refund; production uses the Shopify adapter described in the README.

Support can create a signed seven-day intake link from a parent email and device serial or child phone. The link pre-identifies the device and verifies its claims server-side. Support can also issue a new 30-day tracking link from an existing order. Raw tracking tokens are shown once and only their hashes are stored; issuance is audited.
