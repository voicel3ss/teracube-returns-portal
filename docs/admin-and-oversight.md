# Admin and oversight

Ops Lead staff use `ops@myteracube.com` and land on `/staff/oversight`. The page exposes all claimed and snoozed work, highlights claims idle beyond the configured threshold, and reports delivered packages that were never scanned plus units checked in but not repaired. It also shows the customer-resolution outcome mix.

Administrators use `admin@myteracube.com` and land on `/staff/admin`. They can configure return reminder and escalation timing, stale-claim and stuck-repair thresholds, unidentified-order escalation, the deposit refund gate, customer return instructions, every headline/detail used on the secure customer tracking page, and replacement fees and deposits. They can also create staff accounts, change display names, activate or remove access, and assign one or more teams. Removing access revokes active sessions and releases claimed work back to its team queue without deleting assignment or audit history. An administrator cannot remove their own access or the final active Admin account.

Oversight can export the currently filtered active-case list as a CSV containing operational status, device, assignment, issue, and timing fields. Admins also receive an audited protected export containing the parent email and decrypted shipping address. Bulk PII export is unavailable to non-Admin roles.

Every configuration save is audit logged. The scheduled automation job and customer-facing instructions read the persisted configuration rather than hard-coded timing or copy. Support verification records the normal free/paid outcome automatically, while authorized Support staff can explicitly record upgrade, no-replacement, or exception outcomes for the oversight report.
