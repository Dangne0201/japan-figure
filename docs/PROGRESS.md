# Progress

## Current phase

Phase 2 — catalog and storefront.

## Completed

Phase 1 foundation and Phase 2 catalog/storefront implementation, including the database migration, idempotent demo seed, catalog API, responsive storefront, and generated image placeholders. Phase 2 is verified on `phase/2-catalog`; final publishing and merge remain.

## In progress

Final self-review, then publish and merge Phase 2 into `main`.

## Decisions

See `docs/DECISIONS.md`.

## Verification

- Applied the catalog migration and ran the seed twice; the database contains 50 published products, 50 variants, 50 images, and 9 pre-orders.
- Verified catalog facets/home/list/detail/suggestions through the API and Nginx. Diacritic-insensitive and typo-tolerant search, brand/pre-order/sale/availability filters, sorting, pagination, and related products returned expected results.
- Verified storefront home/list/search/detail, Swagger, health endpoint, all 50 placeholder image routes, local WebP override precedence, and SVG fallback.
- Built and ran production API and web images; API health/search/detail and storefront home/list/detail/image routes returned HTTP 200.
- Checked product listing/detail at a phone-sized viewport: no horizontal overflow or broken images.
- `npm.cmd run lint`, `npm.cmd test` (7 API tests and 1 web test), `npm.cmd run build`, Prettier check, `git diff --check`, and `docker compose config` passed.
- All Compose services, including PostgreSQL, Redis, migration, API, worker, web, and Nginx, were healthy during the final runtime check.

## Known issues and limits

Ollama is offline and remains optional until chatbot phases. Catalog prices, stock, JAN-like identifiers, and release dates are fictional demo data, not official product availability or transaction promises. The storefront defaults to host port `8081`; set `SITE_URL` in `.env` to the LAN origin when generating shareable SEO/Open Graph URLs for phone access.

## Next step

Complete the final self-review, merge the verified branch to `main`, and wait for owner approval before starting Phase 3.
