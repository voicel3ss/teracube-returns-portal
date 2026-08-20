# Logistics workflow

Logistics staff sign in with `logistics@myteracube.com` and land on `/staff/logistics`.

The workspace supports three physical handoffs:

1. Inbound package receipt by carrier tracking number, including empty-package handling and expected-versus-observed serial reconciliation. Missing or mismatched devices create a support discrepancy.
2. Outbound replacement dispatch from new or refurbished inventory. The workspace shows the customer's request tenure, prior request count, returned serial, and repair history before allocation. Manual fulfillment requires a serial and tracking number. Shopify fulfillment can be created before either is known, then completed from the pending-allocation queue when Shopify supplies the physical package details.
3. Internal transfer label upload and warehouse receipt for serial-exact batches released by Repair. Receiving compares the full expected serial list with the observed list, closes exact matches, and leaves mismatches visible as exceptions for correction. Local development stores validated labels in PostgreSQL; production replaces this storage step with the private object-storage adapter listed in the README.

All three actions append audit events. Logistics never receives child phone, ICCID, parent email, or payment data. A shipping address stays masked until an authorized staff member explicitly reveals it; every reveal is audited before plaintext is returned.
