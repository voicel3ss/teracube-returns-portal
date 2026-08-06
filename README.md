# Teracube Device Care

A unit-centric replacement, repair, and refurbishment portal for Teracube.

The application serves parents, customer support, repair technicians, logistics, operations leads, and administrators from one Next.js application backed by PostgreSQL.

## Local development

Requirements: Node.js 20.19+ and npm.

```bash
npm install
npm run db:generate
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run db:verify
npm run build
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the domain model, workflow boundaries, route plan, integration contracts, and build phases.

See [`docs/security.md`](docs/security.md) for authentication, authorization, PII, encryption, and audit guarantees.

See [`docs/parent-journey.md`](docs/parent-journey.md) for the working customer flow, demo device records, and mock pricing.

For local checkout testing, use the in-form mock email code and the “Use demo address” button. Real delivery and address-provider credentials are connected in the production integrations milestone.

The authoritative product specification is `../context/New Repair Workflow/PRD_V2.md`.
