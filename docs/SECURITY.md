# Security review

This is a local educational simulation, not a production storefront. The following review covers the Phase 6 codebase and its intended Windows/Docker Compose deployment. It is not a formal penetration test or a certification.

## Findings and remediation

| ID     | Severity | Finding                                                                                                                                                                               | Status                                                                                                                                                                                                                                                              |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-01 | Medium   | Cookie-authenticated state-changing requests did not require a same-origin `Origin`; a same-site sibling could submit a cross-origin form and trigger an eligible order cancellation. | Fixed: the API now requires the configured browser origin for unsafe requests that carry an auth cookie.                                                                                                                                                            |
| SEC-02 | Medium   | The default local setup uses plain HTTP and `COOKIE_SECURE=false`; credentials and cookies can be observed on an untrusted network.                                                   | Mitigated for production: startup now requires `COOKIE_SECURE=true` and an HTTPS `WEB_ORIGIN`. Local HTTP remains available only for the intended development/trusted-private-network setup; do not treat HTTP on Wi-Fi as safe against other network participants. |
| SEC-03 | High     | `deepmerge-ts` recursive-graph stack exhaustion was reported through Prisma configuration; npm's remediation required a breaking Prisma major upgrade.                                | Fixed in Part 2: upgraded Prisma and `@prisma/client` to 7.10.1, adopted the supported PostgreSQL driver adapter, and ran migrations, API tests, production builds, and Compose health checks. `npm audit --omit=dev` reports zero vulnerabilities.                 |

## Security controls reviewed

- **Authentication and authorization:** password hashes, rotating refresh sessions, HttpOnly/SameSite cookies, account ownership checks, and admin role guards are in place. The same-origin guard protects cookie-authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests.
- **Injection:** request DTOs are validated, Prisma queries are parameterized, and raw PostgreSQL vector/search SQL uses parameterized template values. No actionable SQL injection issue was identified.
- **XSS:** React renders user/catalog content as escaped text; no unsafe HTML rendering sink was identified.
- **CORS and browser headers:** CORS is restricted to the configured web origin, credentials are explicit, Helmet and Nginx browser-security headers are enabled.
- **Rate limiting:** a global API limit and tighter authentication/chat limits are configured.
- **Uploads:** product image uploads require admin authorization, enforce size/type constraints, verify WebP content, and store files outside the web source tree.
- **Secrets and container exposure:** no committed credentials were identified in the reviewed tree. PostgreSQL and Redis are not host-published; the Mailpit interface is loopback-bound by the development override.
- **Dependencies:** upgrading Prisma 7.10.1 removed the `deepmerge-ts` high-severity advisory from the production dependency audit. The complete development dependency audit may still report low/moderate transitive advisories; re-run `npm audit` before release and review newly introduced findings.

## Deployment guidance

- Use the default HTTP configuration only on the local machine or a trusted private Wi-Fi network. Do not expose port 8081 or Ollama port 11434 to public networks.
- For a TLS-terminated deployment, set `SITE_URL`/`WEB_ORIGIN` to the HTTPS origin and `COOKIE_SECURE=true`. Production API startup fails fast if either HTTPS or secure cookies are missing.
- Keep `.env` and local product images untracked. Rotate any credentials that have ever been exposed; do not paste secrets into chatbot messages.
- This review does not certify third-party package safety, the Windows host, Docker Desktop, or the LAN router.
