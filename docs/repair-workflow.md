# Repair workflow and serial ledger

## Local entry

- Sign in at `/staff/login` with `repair@myteracube.com` and the displayed local OTP.
- Open `/staff/repair` or use the **Repair** staff navigation item.

## Workflow

1. Scan a known-format serial. Invalid formats and unknown model codes are rejected before a device can be created.
2. The scan creates or matches the permanent `Device` ledger and opens one active `Repair` record.
3. Begin diagnosis, record the structured resolution category, authoritative repair-team resolution, detailed notes, and up to three photos.
4. Completing a successful repair records the resolution, completes QC, marks the unit as **in transfer**, and creates a serial-exact transfer to the warehouse in one action. Older `qc_pass` records can be released from their repair page without scanning the serial again.
5. A terminal failure requires a disposition and reason, closes the repair, and retires the device. A beyond-economic-repair disposition additionally requires the technician to record whether the device has water damage or is destroyed.
6. Logistics confirms the transferred serial when the repaired device reaches the warehouse. The older batch-QC API remains available for compatibility, but it is no longer part of the normal staff interface.

The serial-ledger page shows all repair outcomes, photos, circulation state, grade, and the count of orders where the unit was returned or dispatched. It exposes no parent email, address, child phone, ICCID, or payment information.

Repair photos use data URLs in the local mock. Production must move binary content to S3-compatible object storage and retain only object keys in PostgreSQL.
