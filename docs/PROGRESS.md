# Progress

## Current phase

Phase 3a — accounts and core commerce is implemented, self-reviewed, and verified on `phase/3a-accounts-cart`; publishing it before starting Phase 3b.

## Completed

- Phase 1 foundation and Phase 2 catalog/storefront are complete. Phase 2 was self-reviewed, CI-verified, and merged to `main`.
- Phase 3a authentication: registration, verification/resend and password reset via Mailpit, login/logout, refresh-token rotation and reuse revocation, profile updates, role guard, validation, throttling, and HttpOnly cookie authentication.
- Phase 3a addresses and cart: bundled current two-level Vietnam address reference (34 province/city units and 3,321 commune-level units); address CRUD/default selection; Redis guest carts; stock validation; idempotent guest-to-user merge; responsive address, cart, and add-to-cart UI.
- Phase 3a checkout: regional simulated shipping, voucher validation/limits, integer-VND totals, points earning/redemption, atomic simulated-order creation, stock decrement, and cart clearing. No real payment or carrier request is made.
- Added Prisma migrations for authentication, addresses/cart, and checkout/loyalty; the demo seed includes voucher defaults and can restore catalog stock without deleting order history.
- Documented the address snapshot, commerce policies, and local run instructions in `README.md`, `DECISIONS.md`, and `ROADMAP.md`.
- Self-review found that an expired access cookie caused commerce pages to fail despite a valid refresh session. Added a shared authenticated API client that refreshes and retries once, coalesces concurrent refreshes, and has regression tests.

## Verification

- `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run format:check` passed. The test run includes 34 API tests and 4 web tests, including access-token refresh/retry behavior.
- `git diff --check` and `docker compose config --quiet` passed.
- All seven long-running Compose services (PostgreSQL, Redis, Mailpit, API, worker, web, and Nginx) are healthy; the one-shot migration service completed successfully. Prisma reports five migrations and no pending changes.
- Ran the idempotent seed twice successfully, then once more after checkout to restore demo stock.
- Through Nginx, verified API health, Swagger, cart and checkout pages, and the static address API (34 provinces/cities and 3,321 communes).
- Exercised a runtime flow: guest adds a product, registers and verifies through Mailpit, logs in and merges the guest cart, saves an address, quotes three simulated carriers with `FIGURE10`, places a `SIMULATED` order, earns points, and receives an empty cart afterward.
- Existing authentication workflows were previously exercised through Mailpit, including profile update, refresh rotation, password reset, and login with the reset password.

## Known issues and limits

- Commerce pages build and return HTTP 200, but an integrated-browser CDP timeout prevented a fresh phone-width visual check for this slice. The owner should complete the manual phone checklist before review.
- Ollama is offline; this is non-fatal and does not affect Phase 3a.
- Catalog prices, stock, JAN-like identifiers, and release dates are fictional demo data. `npm audit` has reported three high-severity issues through Prisma's `deepmerge-ts`; its automatic fix requires a breaking Prisma major upgrade and was not applied.
- Phase 3a is ready to publish after the self-review fix. Phase 3b work has not started.

## Next step

Publish and merge the verified Phase 3a branch, then create `phase/3b-orders` and implement the full order/payment simulation lifecycle.
