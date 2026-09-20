# Security

Report vulnerabilities privately through GitHub Security Advisories. Do not include credentials or customer data in a public issue.

## Automated controls

- Gitleaks scans the complete Git history on every pull request and push to `main`.
- CI blocks critical runtime dependency advisories in each deployable service.
- PostgreSQL RLS and authenticated tenant context are exercised against real Postgres in integration tests.
- Provider callbacks require HMAC signatures and are transactionally deduplicated.
- Generated build artifacts and local environment files are not accepted into source control.

## Accepted upstream risk

The backend audit currently reports high-severity advisories through the Prisma CLI's `deepmerge-ts` and MySQL driver dependencies. GrowthOS uses PostgreSQL, neither dependency is bundled into the API or worker, and the CLI only runs trusted repository migrations during deployment. Prisma 7 has no patched release yet; CI still blocks any critical advisory and this exception should be removed when Prisma publishes a compatible fix.
