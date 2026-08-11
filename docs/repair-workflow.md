# Repair workflow and serial ledger

## Local entry

- Sign in at `/staff/login` with `repair@myteracube.com` and the displayed local OTP.
- Open `/staff/repair` or use the **Repair** staff navigation item.

## Workflow

1. Scan a known-format serial. Invalid formats and unknown model codes are rejected before a device can be created.
2. The scan creates or matches the permanent `Device` ledger and opens one active `Repair` record.
3. Begin diagnosis, record the structured resolution category, authoritative repair-team resolution, detailed notes, and up to three photos.
4. Passing self-QC closes the repair, marks the unit refurbished, clears its owner, and returns it to `in_stock`.
5. A terminal failure requires a disposition and reason, closes the repair, and retires the device.
6. Batch QC accepts one serial per line and returns resolved active repairs to stock together.

The serial-ledger page shows all repair outcomes, photos, circulation state, grade, and the count of orders where the unit was returned or dispatched. It exposes no parent email, address, child phone, ICCID, or payment information.

Repair photos use data URLs in the local mock. Production must move binary content to S3-compatible object storage and retain only object keys in PostgreSQL.
