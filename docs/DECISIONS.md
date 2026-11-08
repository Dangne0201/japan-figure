# Decisions

Append one entry per decision: date, decision, reason, alternatives considered.

## 2026-11-08 — Support keyboard navigation throughout the storefront

- Add a global skip link to the main landmark, visible focus indicators, and reduced-motion handling. Keep page headers outside the main landmark so the skip action actually bypasses navigation.
- Keep search suggestions within the combobox keyboard model: arrow keys move the active option, Enter selects it, and Escape closes the list. Trap focus in the mobile filter dialog, close it on Escape, and restore focus to its trigger.
- Alternatives considered: rely only on native tab order or add bespoke keyboard handlers to every control. Prefer native links/forms for ordinary controls and add custom key handling only for the combobox and modal.

## 2026-11-08 — Do not cache Next.js chunks in the service worker

- Keep the service worker cache limited to offline/static assets and icons; let the browser and Next.js manage framework chunks.
- Next.js development chunk URLs can remain stable while their contents change. Caching them by URL caused the client to load stale JavaScript and report a hydration mismatch.
- Bump the static cache version so activation removes entries cached by the previous worker.
- Alternatives considered: preserve stale-while-revalidate for chunks or disable the PWA in development. Avoid caching Next.js internals in all environments so production updates also cannot serve outdated bundles.

## 2026-11-08 — Reduce chatbot prompt size without tightening relevance

- Return at most four knowledge chunks (the 50-case retrieval evaluation still passes 50/50) and keep the latest three conversation exchanges. Exclude product records unless a question refers to a product or asks to browse/recommend products.
- Keep the relevance threshold at 0.42: raising it to 0.55 reduced retrieval coverage to 45/50, including valid catalog and care questions.
- Cap Ollama output at 128 tokens. Keep the 3B model as the default because it passed the five-case answer evaluation, while the 1.5B model was faster but returned an overly generic privacy answer (4/5).
- Alternatives considered: make the faster 1.5B model the default or raise the retrieval threshold. Keep the quality-first model and improve latency by reducing irrelevant prompt context instead.

## 2026-11-07 — Phase 5b implementation split

- Split Phase 5b at the backend/API boundary because its persisted chat, streaming, user interface, admin, and evaluation scope is too large to implement and verify reliably as one change.
- Part 1 covers owner-scoped conversation persistence, grounded streaming responses, safe public catalog lookups, and API tests. Part 2 covers the web chat experience, feedback, admin management, and the 40-question evaluation harness.
- Keep chat conversations private to their authenticated owner; do not add anonymous or cross-user conversation access.
- Alternatives considered: implement all Phase 5b features in one pass, or split by frontend/backend feature. The backend/API boundary provides a testable foundation before exposing the user interface.

## 2026-11-07 — Local chat generation timeout

- Set the default LLM provider request timeout to 120 seconds for the local CPU-only setup; the original 30-second default aborted a grounded chat stream after partial output.
- Keep the timeout configurable, capped at 120 seconds, and below Nginx's 180-second stream timeout.
- Alternatives considered: reduce the configured model size or increase proxy timeouts. The existing benchmark showed the configured 3B model produced a grounded answer, so allow adequate time before changing model quality or proxy behavior.

## 2026-11-08 — Bound local chatbot response length

- Cap Ollama chat generation at 256 new tokens and ask the assistant to answer concisely in 2–5 sentences.
- A browser smoke test on CPU produced retrieval citations but did not complete before the 120-second request timeout; unbounded generation was the controllable cost driver.
- Keep Gemini generation behavior unchanged; its provider currently uses the provider defaults.

## 2026-11-08 — Keep generated chat answers in Vietnamese

- Require the assistant to use Vietnamese throughout and paraphrase foreign-language terms rather than mixing languages.
- A grounded UI smoke test returned an otherwise relevant answer with one Indonesian word; after strengthening the system instruction, a follow-up answer used Vietnamese and cited its source.
- Alternatives considered: leave the general language instruction unchanged or add output post-processing. Prefer a prompt-level instruction because it preserves streaming and does not risk changing meaning with an automatic translation step.

## 2026-11-08 — Expand the local chatbot knowledge corpus

- Add focused Vietnamese documents for catalog interpretation, account/cart/checkout, order lifecycle, reviews/wishlist, and privacy boundaries, and add retrieval cases that assert these documents are found.
- Base statements on current storefront behavior, API business logic, seed data, and already documented simulation policies; label all money, shipping, inventory, and delivery activity as simulated.
- Keep current product price and stock out of policy documents because published-product context is indexed separately and refreshed from live database values.

## 2026-11-08 — Upgrade Prisma to resolve dependency advisory

- Upgrade `prisma`, `@prisma/client`, and the PostgreSQL driver adapter to 7.10.1. Use the new `prisma-client` generator, a generated TypeScript client under the API source tree, and `@prisma/adapter-pg`.
- Configure the PostgreSQL pool with a maximum of 10 connections and a 5-second connection timeout to preserve bounded resource use and the previous timeout behavior.
- Keep database schema changes migration-only. Existing pgvector `Unsupported` fields and parameterized raw SQL remain unchanged.
- Alternatives considered: leave the high-severity advisory unresolved or force an unverified `deepmerge-ts` override. Prefer the upstream supported Prisma major upgrade; API tests/builds, Prisma schema validation, migrations, production audit, and Compose runtime were used as regression checks.

## 2026-11-08 — Bound public catalog caching and metrics

- Cache only the public catalog home, known product details, and filter facets in Redis. Use 10-second TTLs for home/details and 60 seconds for facets; log cache failures and fall back to PostgreSQL.
- Do not cache arbitrary catalog searches or suggestion strings because unbounded cache-key cardinality could consume the no-eviction Redis budget used by BullMQ.
- Expose process and HTTP metrics at `/api/metrics` using method/status-only labels; do not export request paths or user identifiers.

## 2026-11-08 — Split Phase 6 polish work

- Work on `phase/6-polish` and split Phase 6 into Part 1 (knowledge corpus, security review/remediation, quality/coverage/e2e verification) and Part 2 (performance, observability, reset-demo, portfolio docs, and release readiness).
- Phase 5b was complete but still uncommitted when Phase 6 was approved. Preserve its changes on the new branch rather than staging, committing, or discarding them without explicit direction; flag this combined worktree for review before publication.
- Alternatives considered: attempt the entire security, performance, quality, reset, and release checklist in one pass, or publish Phase 5b before any Phase 6 work. The bounded split avoids rushing the broad polish phase while preserving all current changes.

## 2026-11-07 — Brand and experience

- Shop name: Japan Figure.
- Brand direction: premium, anime-inspired, and approachable to young customers.
- Visual direction: bright and pastel, mobile-first.
- Alternatives considered: otaku-friendly energetic, kawaii, or minimal Japanese styling; owner chose premium yet friendly and anime-inspired.

## 2026-11-07 — Catalog scope

- Include Prize Figure, Scale Figure, Action Figure, and Chibi Figure products, including Nendoroid. Use a varied catalog rather than limiting the shop to a single figure type.
- Initial seed count: 50 products as a working assumption, consistent with the discovery prompt suggestion; product prices should be plausible per type in integer VND. A single fixed price range was not specified.
- Copyright policy: commit only self-made/generated placeholders; locally supplied real images remain untracked.

## 2026-11-07 — Feature priorities and assistant persona

- Complete the storefront and core e-commerce experience before implementing the chatbot; chatbot is the last major feature area. This fits the planned sequence of catalog and commerce phases before chatbot phases.
- Chatbot working name: Sakura (さくら), a Japanese-inspired suggestion pending owner confirmation. Tone: humorous, polite, friendly; use “bạn” and “tôi”.

## 2026-11-07 — Policies and implementation assumptions

- Use realistic Vietnamese-market defaults for simulated shipping, returns, warranty, and pre-orders; document exact policy values when implemented.
- Currency is integer VND. Do not assume one price band for all figure types.
- Store-specific price range and exact chatbot name have not been confirmed.

## 2026-11-07 — Development environment

- Recommend moving the repository from Windows drive `F:` into the WSL2 Linux filesystem for faster dependency installs and file watching.
- WSL reports only the `docker-desktop` distribution, currently stopped; a user development distribution has not been verified.
- Node.js, npm, Docker CLI, Docker Compose, and Git are installed. GitHub CLI is missing but optional; authenticated Git push worked. Ollama is not responding at `localhost:11434`.
- Docker Desktop engine returned HTTP 500 for the Docker Desktop Linux engine during `docker info`.
- Vietnam administrative address dataset and current province/district/ward structure must be verified when implementing the address feature.

## 2026-11-07 — Phase 1 development defaults

- Use npm workspaces for the TypeScript monorepo and Node.js 22 images for containers and CI.
- The Compose development override enables hot reload and publishes only the Nginx web entry point plus Mailpit on loopback; API, PostgreSQL, and Redis remain internal to the Docker network.
- Redis uses `noeviction`, as required for reliable BullMQ queue semantics. Prisma migrations run in a one-shot service before the API starts.
- A separate Ubuntu distribution is optional; Docker Desktop's WSL2 backend is sufficient.

## 2026-11-07 — Local web port

- Set Japan Figure's default host web port to `8081` (still configurable with `APP_PORT`).
- Reason: an existing stopped `booknest-app-1` container is configured to publish `127.0.0.1:8080`; running both projects simultaneously would conflict on port `8080`. No other active listener was using the new port during verification.
- Nginx continues listening on container port `8080`; only the host-facing port changes.

## 2026-11-07 — Branch review and publishing workflow

- For phase work, use a dedicated branch, perform self-review and verification, then merge into `main` only after checks pass. Do not create a pull request unless the owner asks for one.
- Publish branches and `main` through the owner's SourceTree setup. Do not start the next phase until the owner explicitly approves it.

## 2026-11-07 — Phase 2 catalog seed assumptions

- Use the roadmap's initial working assumption of 50 catalog products; the owner did not specify a different count before implementation.
- Seed prices, stock, JAN-like identifiers, and release dates are fictional demo data for the learning simulation, not official product availability, manufacturer codes, or transaction promises.
- Catalog image placeholders are generated original SVG artwork. Locally supplied `<slug>.webp` files override the placeholder and stay gitignored.

## 2026-11-07 — Storefront metadata origin

- Use the optional `SITE_URL` environment variable as the origin for absolute SEO/Open Graph URLs; default to `http://localhost:${APP_PORT}` in Compose.
- Set `SITE_URL` to the laptop's LAN origin when sharing product pages from a phone, so generated image URLs do not point to the Next.js development port.

## 2026-11-07 — Phase 3a implementation split and account security

- Implement Phase 3a in domain slices (authentication; addresses/cart; shipping/promotions/loyalty), but complete and verify the full phase before pausing for owner review.
- Store passwords using bcrypt hashes. Sign short-lived access JWTs with the configured `JWT_ACCESS_SECRET`; store only hashes of opaque, rotating refresh tokens and one-time email action tokens.
- Keep auth cookies HttpOnly and SameSite=Lax, scoped to `/api` so authentication is sent to every same-origin API module; Secure is controlled by `COOKIE_SECURE` so local HTTP works while HTTPS deployments can enable it.
- Send verification and password-reset links only through the configured fake SMTP server (Mailpit); never expose one-time tokens in API responses.
- Use `SITE_URL` as the browser origin accepted by API CORS and as the origin embedded in auth emails, so LAN users receive links that resolve on their phone as well as on the laptop.

## 2026-11-07 — Vietnam address reference and cart sessions

- Bundle the current two-level administrative hierarchy (province/city and commune-level units; no district field) from the General Statistics Office directory as retrieved on 2026-11-07: 34 province/city units and 3,321 commune-level units. Preserve the source URL and retrieval date in the data file and UI; do not claim a data license that the source does not publish.
- Store administrative codes and display-name snapshots with each address; the detailed-address field remains free text for street, neighborhood, hamlet, or other delivery detail.
- Store guest carts in Redis behind a server-generated 256-bit opaque HttpOnly cookie. Merge the guest cart into the authenticated user's database cart during login and record a one-time merge receipt to make retries idempotent.
- Store product weights as integer grams; seed variants use a clearly documented 1,000 g default until more realistic package weights are supplied.

## 2026-11-07 — Phase 3a shipping, vouchers, loyalty, and simulated checkout

- Keep all prices, discounts, shipping fees, and totals as integer VND. The bundled address dataset retrieved from `https://danhmuchanhchinh.nso.gov.vn/Default.aspx` on 2026-11-07 contains 34 province/city units and 3,321 commune-level units under the two-level structure. No district is stored. The source does not publish an open-data license in the retrieved material, so the project records attribution without making a license claim.
- Guest carts live in Redis for 30 days. A cart supports at most 50 distinct variants and 99 units per line. Login merge is idempotent; if a line cannot be merged safely, keep the guest cart and report an actionable conflict rather than silently discarding it.
- Shipping is a local simulation, not a carrier integration. Seeded variant weights default to 1,000 g. Packages must weigh 1–30,000 g; each additional 500 g above the first 1,000 g adds one rate step. The three simulated options are:

  | Region  | Carrier      | Base (first 1,000 g) | Each extra 500 g | Estimate |
  | ------- | ------------ | -------------------: | ---------------: | -------- |
  | North   | GHN          |             26,000 ₫ |          4,000 ₫ | 1–2 days |
  | North   | GHTK         |             24,000 ₫ |          5,000 ₫ | 2–3 days |
  | North   | Viettel Post |             28,000 ₫ |          4,000 ₫ | 2–3 days |
  | Central | GHN          |             32,000 ₫ |          6,000 ₫ | 2–3 days |
  | Central | GHTK         |             30,000 ₫ |          6,000 ₫ | 3–4 days |
  | Central | Viettel Post |             34,000 ₫ |          5,000 ₫ | 2–4 days |
  | South   | GHN          |             25,000 ₫ |          4,000 ₫ | 1–2 days |
  | South   | GHTK         |             23,000 ₫ |          5,000 ₫ | 2–3 days |
  | South   | Viettel Post |             27,000 ₫ |          4,000 ₫ | 2–3 days |

- Shipping is free when merchandise after voucher discounts is at least 1,500,000 ₫, or when an eligible free-shipping voucher is applied. These thresholds and regional rates are demo assumptions, not actual carrier quotes.
- Seed voucher `FIGURE10`: 10% discount, minimum 500,000 ₫, maximum discount 200,000 ₫; 500 total redemptions, one per user, starts at 2026-01-01 00:00 UTC and expires at 2027-01-01 00:00 UTC, stackable with points. Seed voucher `FREESHIP`: free simulated shipping, minimum 300,000 ₫; 500 total redemptions, one per user, same validity window, stackable with points. Limits are checked inside the serializable order transaction.
- Loyalty earns one point per 10,000 ₫ of merchandise after voucher and point discounts, excluding shipping. Each point redeems for 100 ₫, limited by the account balance and remaining merchandise total.
- The Phase 3a checkout records a `SIMULATED` order and decrements demo stock atomically, then clears the cart. It does not charge, contact a carrier, or send an order email. Seed reruns restore catalog values and stock but do not delete order history.

## 2026-11-07 — Phase completion and Git workflow

- At the owner's request, finish each phase, run a self-review and verification, then publish the phase branch and merge it to `main` if no actionable issues remain. Start the next phase on its own branch without waiting for another approval. Do not create a pull request unless explicitly requested.
- Keep phase-end updates concise: report whether the phase is complete and whether checks are passing; summarize any remaining blocker when a phase cannot be fully verified.

## 2026-11-07 — Phase 3b simulated order lifecycle

- Reserve stock at checkout and decrement on-hand stock only when a simulated transfer order ships. Failed, cancelled, or expired pending payments release reservations, voucher usage, and redeemed points atomically.
- Support simulated bank transfer and cash-on-delivery only; never collect card details or contact a payment provider. Transfer orders require a fake success/failure/cancel result, while COD remains unpaid until simulated delivery.
- Credit earned loyalty points on simulated delivery. Accept return requests within seven days of simulated delivery; record them for delivered orders but never issue a real refund.
- Run expiry, fulfillment, and fake Mailpit notification jobs through BullMQ. The worker advances demo fulfillment quickly for local testing; all statuses and tracking identifiers are fictional.
- Split new PostgreSQL enum values into a preceding migration because a newly added enum value cannot be used as a column default before its transaction commits. Keep migration timestamps after the existing checkout migration.
- Cache only same-origin static assets and the static offline page in the PWA service worker; do not cache pages, APIs, or account/order data. Installation on a phone over LAN requires HTTPS; localhost is browser-trusted for local development.

## 2026-11-07 — Phase 4 admin foundation and product images

- Provision an admin account only when the seed command receives both `ADMIN_EMAIL` and `ADMIN_PASSWORD`; no built-in credentials or admin registration path are provided.
- Restrict admin image uploads to validated WebP files up to 5 MiB and store them in a named local volume shared read-only with the web service. Product images remain local and untracked.
- Generate Prisma Client in the non-production seed/migration image before switching to its non-root runtime user, so the profile-based seed command can construct PrismaClient.
- Split Phase 4 after product/stock management and uploads; order operations, voucher/banner management, review moderation, customer controls, and remaining audit-log coverage form Part 2.
- Re-resolve Docker service names from Nginx rather than pinning API/web container IPs, so replacing an application container does not require restarting the reverse proxy.

## 2026-11-07 — Phase 4 admin operations

- Admin cancellation is limited to pending simulated bank-transfer orders and COD orders still in preparation; use the existing order transition and commitment-release helpers so inventory reservations, redeemed points, and voucher redemptions stay consistent.
- Admins may complete or reject a pending return request. Rejection returns the order to `DELIVERED` without resetting the original delivery timestamp or the seven-day request window. Return and payment outcomes remain simulations; no real refund is initiated.
- A disabled customer cannot authenticate; revoke all active refresh sessions when disabling the account. Restrict customer administration to `USER` accounts.
- Storefront banners accept same-origin relative image and destination paths only. Public output includes active banners only while their configured time window is open.
- Keep the new `ReturnStatus.REJECTED` enum value in its own migration before any migration that may depend on it, following the repository's PostgreSQL enum migration convention.
- Record each Part 2 administrative mutation together with its audit log in the same database transaction.

## 2026-11-07 — Phase 5a chatbot knowledge and retrieval

- Keep chat-answer sources limited to committed `knowledge/` documents and currently published catalog data. Do not fetch web content, infer unavailable product facts, or expose unpublished products.
- Store document and product chunks in PostgreSQL with `vector(1024)` embeddings from the configured Ollama embedding model; retain source type, source ID/path, title, chunk number, content hash, and product metadata for citations and re-indexing.
- Use combined vector/trigram ranking with configurable top-k and relevance threshold. An empty or below-threshold result means no matching local knowledge; the later chat phase must not invent an answer.
- Default chat generation to local Ollama. Gemini is an explicitly selected optional chat provider requiring `GEMINI_API_KEY`; embeddings remain local Ollama `bge-m3` so provider changes do not alter the database vector dimension.
- The host Ollama service was unavailable during Phase 5a implementation. Do not download large models or claim measured benchmark figures without real results; record this verification limit and provide a reproducible local benchmark command.
- Knowledge describes the implemented simulation only: shipping estimates and vouchers are demo rules; payment, carrier, returns/refunds, and order notifications are not real integrations. Returns are requests only and no real refund occurs. Seed JAN-like values are fictional and do not establish product authenticity.

## 2026-11-07 — Phase 5a local model benchmark

- After Ollama was installed on the Windows host, indexed 9 knowledge documents and 50 published products, then verified embedding-backed Vietnamese retrieval and benchmarked both configured Qwen chat models with a grounded answer prompt.
- One local CPU run measured Qwen 2.5 3B at 7.01 tokens/s and 2.14 GiB peak combined Ollama/runner working set; the 1.5B fallback measured 10.99 tokens/s and 1.22 GiB. Both answers were factually consistent with the supplied care document; the 3B answer was more complete and the 1.5B answer more concise.
- Keep the configured 3B primary and 1.5B fallback; these results cover only one short question and do not justify a general quality recommendation. Preserve the runner process in Windows memory sampling; measuring only processes named `ollama*` misses `llama-server.exe`.
