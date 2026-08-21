# Logistics workflow

Logistics staff sign in with `logistics@myteracube.com` and land on `/staff/logistics`.

The workspace supports three physical handoffs:

1. Inbound package receipt by carrier tracking number, including empty-package handling and expected-versus-observed serial reconciliation. Missing or mismatched devices create a support discrepancy.
2. Outbound replacement dispatch from new or refurbished inventory. The workspace shows the customer's request tenure, prior request count, returned serial, and repair history before allocation. Manual fulfillment requires a serial and tracking number. Shopify fulfillment can be created before either is known, then completed from the pending-allocation queue when Shopify supplies the physical package details.
3. Warehouse receipt for serial-exact transfers released by Repair. Logistics scans the devices that arrived and confirms the batch; the screen compares the expected and observed lists and leaves mismatches visible for correction. The unit remains **in transfer** and cannot be allocated as replacement stock until this receipt matches the expected serial list. A carrier label and warehouse note can be added when useful, but neither is required. Local development stores uploaded labels in PostgreSQL; production replaces this storage step with the private object-storage adapter listed in the README.

Carrier events are monotonic: delayed events cannot move a delivered or physically received package backward. A newer movement event can recover a carrier exception automatically, close its fulfillment-block work item, and resume the order from the physical progress already recorded. Labels can only be attached while an internal transfer is still waiting for one.

All three actions append audit events. Logistics never receives child phone, ICCID, parent email, or payment data. A shipping address stays masked until an authorized staff member explicitly reveals it; every reveal is audited before plaintext is returned.
