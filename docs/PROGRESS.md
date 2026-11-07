# Progress

## Current phase

Phase 5a — Chatbot knowledge and retrieval is complete, verified, and merged to `main` from `phase/5a-chatbot-knowledge`. Phase 4 is also complete and merged.

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
- Phase 4 is split at the admin product boundary: Part 1 covers role-protected admin foundation, dashboard, product/stock management, and validated local image uploads. Part 2 covers order operations, vouchers/banners, review moderation, customer controls, and the remaining audit-log coverage.
- Phase 4 Part 1: added `/admin` dashboard and product editor, role-protected admin APIs, environment-only admin provisioning, reservation-safe stock updates, a persistent local WebP upload volume, generic placeholder fallback, and audit records for product/stock/image changes.
- Added the admin audit migration and applied it without resetting or dropping existing local data. The seed container now generates Prisma Client before running the TypeScript seed.
- Phase 4 Part 2 implementation: added admin order search, eligible-order cancellation with stock/points/voucher commitment release, return-request approval/rejection, voucher CRUD, banner management and public storefront display, review moderation, customer disable/enable, and paginated audit-log search. All mutations write audit records transactionally.
- Added narrow migrations for the `REJECTED` return status and banner table, ordered after the existing admin audit migration.
- Added an operations panel to `/admin` for these workflows and explicit messaging that simulated payment, delivery, and returns do not perform real transactions or refunds.
- Phase 4 was self-reviewed, verified, published, and fast-forward merged to `main`; the owner approved continuing to Phase 5a.
- Phase 5a scope is the offline Vietnamese knowledge base, product/document indexing, hybrid retrieval, provider abstraction, and benchmark. The chatbot conversation API/UI remains outside this phase.
- Added the initial pgvector-backed knowledge-chunk schema/migration, environment configuration for Ollama/Gemini and retrieval, Markdown chunking/normalization, Ollama embedding client, and Ollama/Gemini chat provider with retry and streaming support.
- Added document/product indexing, hybrid vector/trigram retrieval, BullMQ re-indexing hooks for catalog and stock changes, CLI re-indexing, and nine committed Vietnamese knowledge documents.
- Added provider, chunking, retrieval, indexing, env-validation, and streaming tests. The Windows benchmark measures Ollama's process working set while generation runs; it unloads models after each benchmark.

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
- Phase 3b verification at completion: formatting, lint, 12 API suites/41 tests, 4 web tests, API and web production builds, eight applied migrations, Compose health, and API-health/manifest/service-worker requests through the configured reverse proxy.
- Phase 4 Part 1 verification passed: formatting, lint, 14 API suites/46 tests, 4 web tests, API and web production builds, nine applied Prisma migrations, and all Compose services healthy.
- Exercised the admin flow against Compose: environment-seeded temporary admin login, unauthenticated API denial, dashboard access, product creation, stock update, WebP upload and serving, product publish/pricing update, and public catalog visibility. Removed the temporary account and test product afterward.
- Through the reverse proxy, `/admin`, `/api/health`, and `/manifest.webmanifest` returned HTTP 200.
- Phase 4 Part 2 verification passed: formatting, lint, 15 API suites/50 tests, 4 web tests, API and web production builds, and 11 applied Prisma migrations.
- Compose verified all seven long-running services healthy and the migration service exited successfully. Through Nginx, verified the storefront/admin page, catalog banner response, API health, and guest denial (401) for every new admin endpoint.
- Authenticated local runtime smoke tests passed for admin order/voucher/banner/review/customer/audit listing; voucher create/update; banner create/update/public display/delete; customer disable/enable and disabled-session rejection; and audit-log browsing. Temporary admin, customer, voucher, banner, and audit data were removed and verified absent.
- Phase 5a migration/runtime verification: Prisma reports 12 repository migrations with no pending changes; PostgreSQL contains the `knowledge_chunks` table. Reindexed 9 knowledge documents and 50 published products, all with embeddings. Compose API, worker, and supporting services are healthy.
- A real embedding-backed retrieval smoke test for “Làm thế nào để bảo quản figure khỏi bụi?” returned the relevant `figure-care.md` source. The test exposed punctuation-sensitive normalization and candidate filtering; fixed both and reran retrieval successfully.
- Ran the grounded chat benchmark for both configured models. On this Windows host with CPU inference, 3B measured 7.01 tokens/s and 2.14 GiB peak combined process working set; 1.5B measured 10.99 tokens/s and 1.22 GiB. Both produced a correct answer from the supplied source; 3B was more complete. The benchmark now unloads existing models, includes `llama-server` process memory, uses `/api/chat`, and prints the answer.
- Initial whole-model sampling omitted `llama-server.exe`, producing invalid low memory figures. Fixed the sampler and reran from an unloaded baseline; only the corrected results are documented.
- Final API verification passed: build, lint, all 18 suites/62 tests, and Prettier. Compose configuration and `git diff --check` passed. `/api/health` returned HTTP 200 with database, Redis, and Ollama all up.
- Phase 5a code self-review found and fixed the live retrieval issue; no other actionable issue found in indexing lifecycle, provider retry/streaming, queue wiring, or stock-change hooks.

## Known issues and limits

- Commerce pages build and return HTTP 200, but an integrated-browser CDP timeout prevented a fresh phone-width visual check. The owner should complete the manual phone checklist before review.
- Model quality results cover one short grounded question only; expand the answer-quality evaluation before relying on either model for general customer support.
- Catalog prices, stock, JAN-like identifiers, and release dates are fictional demo data. `npm audit` has reported three high-severity issues through Prisma's `deepmerge-ts`; its automatic fix requires a breaking Prisma major upgrade and was not applied.
- A fresh phone-width visual review remains a manual owner checklist item; the admin API and route were runtime-verified, but no phone screenshot was captured.
- The repository does not provision default admin credentials. The owner must set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `.env` and run `docker compose --profile tools run --rm seed`.
- The model-quality check covers one grounded question per model only; evaluate a representative Vietnamese FAQ set before exposing general chatbot answers.

## Next step

Stop for owner review. Do not start Phase 5b until the owner explicitly asks.
