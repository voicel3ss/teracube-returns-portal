# Admin and oversight

Ops Lead staff use `ops@myteracube.com` and land on `/staff/oversight`. The page exposes all claimed and snoozed work, highlights claims idle beyond the configured threshold, and reports delivered packages that were never scanned plus units checked in but not repaired. It also shows the customer-resolution outcome mix.

Administrators use `admin@myteracube.com` and land on `/staff/admin`. They can configure return reminder and escalation timing, stale-claim and stuck-repair thresholds, unidentified-order escalation, the deposit refund gate, customer return instructions, and replacement fees and deposits. Required approval remains visibly disabled and server-rejected because its resumable approval flow is a Phase 2 feature.

Every configuration save is audit logged. The scheduled automation job and customer-facing instructions read the persisted configuration rather than hard-coded timing or copy.
