# Admin and oversight

Ops Lead staff use `ops@myteracube.com` and land on `/staff/oversight`. The page exposes all claimed and snoozed work, highlights claims idle beyond the configured threshold, and reports delivered packages that were never scanned plus units checked in but not repaired. It also shows the customer-resolution outcome mix.

Administrators use `admin@myteracube.com` and land on `/staff/admin`. They can configure return reminder and escalation timing, stale-claim and stuck-repair thresholds, unidentified-order escalation, the deposit refund gate, customer return instructions, every headline/detail used on the secure customer tracking page, and replacement fees and deposits. They can also create staff accounts, change display names, activate or deactivate accounts, and assign one or more teams. An administrator cannot deactivate their own account or remove their own Admin membership.

Every configuration save is audit logged. The scheduled automation job and customer-facing instructions read the persisted configuration rather than hard-coded timing or copy. Support verification records the normal free/paid outcome automatically, while authorized Support staff can explicitly record upgrade, no-replacement, or exception outcomes for the oversight report.
