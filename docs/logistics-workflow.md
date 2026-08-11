# Logistics workflow

Logistics staff sign in with `logistics@myteracube.com` and land on `/staff/logistics`.

The workspace supports three physical handoffs:

1. Inbound package receipt by carrier tracking number, including empty-package handling and expected-versus-observed serial reconciliation. Missing or mismatched devices create a support discrepancy.
2. Outbound replacement dispatch from refurbished inventory. The selected device becomes deployed, is assigned to the order's customer, and is permanently linked to the order and shipment.
3. Internal transfer label upload for serial-exact batches released by Repair. Local development stores the validated PDF or image in PostgreSQL; production replaces this storage step with the private object-storage adapter listed in the README.

All three actions append audit events. Logistics never receives child phone, ICCID, parent email, or payment data.
