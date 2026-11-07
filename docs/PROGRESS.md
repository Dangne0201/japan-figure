# Progress

## Current phase

Phase 3b — orders and payment simulation is complete and merged to `main` as `174383a`. Phase 4 is next.

## Completed

- Phase 1 foundation and Phase 2 catalog/storefront are complete. Phase 2 was self-reviewed, CI-verified, and merged to `main`.
- Phase 3a is complete, self-reviewed, committed as `d324597`, and merged to `main`. The only self-review finding (expired access-cookie handling) was fixed and regression-tested before publication.
- Phase 3a authentication: registration, verification/resend and password reset via Mailpit, login/logout, refresh-token rotation and reuse revocation, profile updates, role guard, validation, throttling, and HttpOnly cookie authentication.
- Phase 3a addresses and cart: bundled current two-level Vietnam address reference (34 province/city units and 3,321 commune-level units); address CRUD/default selection; Redis guest carts; stock validation; idempotent guest-to-user merge; responsive address, cart, and add-to-cart UI.
- Phase 3a checkout: regional simulated shipping, voucher validation/limits, integer-VND totals, points earning/redemption, atomic simulated-order creation, stock decrement, and cart clearing. No real payment or carrier request is made.
- Added Prisma migrations for authentication, addresses/cart, and checkout/loyalty; the demo seed includes voucher defaults and can restore catalog stock without deleting order history.
- Phase 3b data model is in place: payment outcomes, order lifecycle/history, stock reservations, returns, wishlist, and buyer reviews. The migration backfills timestamps for the existing simulated order and adds database checks for stock, payment amounts, reservation quantities, and review ratings.
- Phase 3b API and worker: owner-scoped order history/details and simulated invoice, idempotent transfer outcomes, COD, cancellation/return requests, wishlist, verified-buyer reviews, reservation release/consumption, fulfillment/tracking, and Mailpit status notifications.
- Phase 3b storefront: simulated payment choices, order detail/history with payment and return actions, printable invoice view, review submission, wishlist controls/pages, and an installable static-only PWA.
- Final self-review fixed checkout omitting the selected payment method when placing an order; raw SQL stock reservations also update the variant's `updated_at` timestamp.
- Nginx now refreshes Docker service DNS for API/web upstreams; verified the API remains reachable through Nginx after recreating its container.
- Documented the address snapshot, commerce policies, and local run instructions in `README.md`, `DECISIONS.md`, and `ROADMAP.md`.
- Started Phase 3b on a dedicated branch after publishing Phase 3a.
- Phase 3b was self-reviewed, fully verified, published on `phase/3b-orders`, and fast-forward merged to `main` without a pull request.

## Verification

- Phase 3a: `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run build`, and `npm.cmd run format:check` passed. The test run includes 34 API tests and 4 web tests, including access-token refresh/retry behavior.
- `git diff --check` and `docker compose config --quiet` passed.
- All seven long-running Compose services (PostgreSQL, Redis, Mailpit, API, worker, web, and Nginx) are healthy; the one-shot migration service completed successfully. Prisma reports eight applied Phase 1–3b migrations with no pending changes.
- Ran the idempotent seed twice successfully, then once more after checkout to restore demo stock.
- Through Nginx, verified API health, Swagger, cart and checkout pages, and the static address API (34 provinces/cities and 3,321 communes).
- Exercised a runtime flow: guest adds a product, registers and verifies through Mailpit, logs in and merges the guest cart, saves an address, quotes three simulated carriers with `FIGURE10`, places a `SIMULATED` order, earns points, and receives an empty cart afterward.
- Existing authentication workflows were previously exercised through Mailpit, including profile update, refresh rotation, password reset, and login with the reset password.
- Phase 3b schema: generated Prisma Client, validated the schema, applied all eight ordered migrations, and confirmed the existing `SIMULATED` order remained intact with its required timestamp columns backfilled.
- Local Phase 3b runtime flow passed through Compose: registered and verified a test account via Mailpit; created an address; placed and paid a reserved-stock transfer order; replayed the same payment event; observed worker processing, tracking, delivery and notification emails; submitted a pending verified-buyer review and return request; added/removed a wishlist item; and verified payment failure, COD cancellation, and worker expiry release commitments.
- PWA endpoints return the manifest and service worker successfully. The optimized web build includes the account order and wishlist routes.
- Final verification passed: formatting, lint, 12 API suites/41 tests, 4 web tests, API and web production builds, eight applied Prisma migrations, Compose health, and API-health/manifest/service-worker requests through the configured reverse proxy.

## Known issues and limits

- Commerce pages build and return HTTP 200, but an integrated-browser CDP timeout prevented a fresh phone-width visual check. The owner should complete the manual phone checklist before review.
- Ollama is offline; this is non-fatal and does not affect Phase 3a or 3b.
- Catalog prices, stock, JAN-like identifiers, and release dates are fictional demo data. `npm audit` has reported three high-severity issues through Prisma's `deepmerge-ts`; its automatic fix requires a breaking Prisma major upgrade and was not applied.
- Integrated-browser CDP timed out again, so a fresh phone-width visual check could not be completed.
- A fresh phone-width visual check remains a manual owner checklist item because the integrated browser could not connect.

## Next step

Begin Phase 4 — Admin on `phase/4-admin`; start with the role-protected admin foundation and product/stock management, then continue through the remaining roadmap scope.
