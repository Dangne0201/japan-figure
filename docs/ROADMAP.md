# Roadmap

Work is phase-based. The storefront and core buying experience take priority; chatbot development comes only after the web shop and admin foundation are in place.

## Phase 1 — Foundation

- Monorepo with `apps/web` and `apps/api`, shared TypeScript/formatting standards, and a working Docker Compose development environment.
- PostgreSQL migrations enable pgvector, unaccent, and pg_trgm; Redis, Mailpit, health checks, Swagger, request IDs, and startup environment validation are wired.
- A mobile-friendly web page proves web → API → database connectivity.
- CI runs lint, tests, builds, and Docker image builds. README covers Windows/WSL2 and LAN access.

## Phase 2 — Catalog and storefront

- Catalog domain includes brands, series, categories, products, variants/stock, and product images.
- Search supports Vietnamese diacritics and typo tolerance; listing filters and pagination work.
- Seed contains the owner-selected number of products (initial working assumption: 50) across Prize Figure, Scale Figure, Action Figure, and Chibi Figure/Nendoroid.
- Home, search, product listing/detail, responsive filters, placeholder images and local image overrides, SEO metadata, and accessible loading/empty/error states are complete.
- Catalog filtering/search tests pass, and the UI has been checked at phone width.

## Phase 3a — Accounts, cart, shipping, vouchers

- Registration/login/logout, refresh-token rotation, email verification/reset via Mailpit, roles, profile, and address book work.
- Guest cart merges on login and checks stock; shipping is a clearly labeled simulation.
- Voucher and loyalty rules are implemented with integer VND pricing and documented rounding.
- A minimum simulated checkout records an order and applies stock, voucher-usage, and point changes atomically; it never charges money or calls a carrier.
- Unit tests cover pricing, shipping, voucher behavior, auth, cart, and checkout conflict handling.

## Phase 3b — Checkout and orders

- Clearly labeled fake payment methods support success/failure/cancel and idempotent callbacks; no real payment or card data processing.
- Expand the Phase 3a simulated order into the full order lifecycle: status history, reservations, expiry/release, worker progression, fake email, tracking, invoice, cancel/return, wishlist, and verified-buyer reviews.
- PWA behavior is implemented with honest HTTPS requirements for LAN installation.
- State-machine/payment tests and a full purchase-flow e2e test pass.

## Phase 4 — Admin

- **Part 1 complete:** role-protected `/admin` dashboard and product/stock management; WebP uploads validate type/size and use a local volume; admin credentials are provisioned only from environment configuration.
- **Part 2 remaining:** order handling, vouchers, banners, review moderation, customer controls, and remaining audit-log coverage.
- Authorization tests prove unauthenticated requests are denied and only admins can use the dashboard.

## Phase 5a — Chatbot knowledge and retrieval

- Vietnamese policy and shop knowledge documents match implemented behavior.
- Document/product ingestion, embeddings, pgvector storage, source metadata, hybrid retrieval, relevance threshold, and re-index jobs work locally.
- Ollama is the default provider with configurable Gemini fallback; provider errors and benchmark limitations are documented.
- Chunking and retrieval tests pass.

## Phase 5b — Chatbot experience

- Vietnamese assistant answers grounded in local knowledge and deterministic live lookups; it declines unknown/off-topic questions and cannot expose other users' data.
- Streaming UI, persistence, rate limiting, feedback, admin management, and evaluation harness are complete.
- At least 40 evaluation questions cover normal, trick, off-topic, injection, and cross-user cases; pass rate and limitations are documented.

## Phase 6 — Polish

- Security, performance, coverage, e2e, and observability checks are completed; findings are addressed and documented.
- Reset-demo workflow, polished docs, contribution guide, CI badge, and release checklist are complete.
- No secrets are tracked; license, disclaimer, image policy, and repository metadata are verified.
