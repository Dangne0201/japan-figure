# Japan Figure

[![CI](https://github.com/Dangne0201/japan-figure/actions/workflows/ci.yml/badge.svg)](https://github.com/Dangne0201/japan-figure/actions/workflows/ci.yml)

A learning project simulating a Vietnamese anime-figure e-commerce shop. The intended brand is premium yet friendly to young anime fans, with a bright pastel visual direction. The catalog includes Prize Figure, Scale Figure, Action Figure, and Chibi Figure products, including Nendoroid.

> **Educational demo only.** This project is not affiliated with any brand, anime, or studio. Checkout creates local simulated orders and changes demo inventory only; no real payment or delivery is processed. Payment, shipping, and email integrations are simulated.

## Features

- Mobile-first catalog with Vietnamese search, typo tolerance, filters, product detail, and wishlist.
- Customer accounts, addresses, cart, order history, and verified-buyer reviews.
- Integer-VND checkout with explicitly simulated shipping, vouchers, loyalty points, and payment outcomes.
- Role-protected admin tools for catalog, order, voucher, banner, review, customer, and chatbot operations.
- Vietnamese chatbot grounded only in the local knowledge corpus and published catalog, with source citations and owner-scoped conversations.
- NestJS REST API and Swagger, PostgreSQL/pgvector, Prisma 7 with the PostgreSQL driver adapter, Redis/BullMQ, Mailpit, and Nginx.

## Screenshots

> Screenshot/GIF placeholders: add self-captured desktop storefront, phone storefront, and chatbot screenshots after the local demo is running. Do not commit copyrighted figure or anime imagery.

## Project status

The Phase 1–6 implementation is published on `main`; see [progress](docs/PROGRESS.md) for verified scope and remaining manual checks. See the [documentation index](docs/README.md), [decisions](docs/DECISIONS.md), [architecture](docs/ARCHITECTURE.md), [data model](docs/DATA_MODEL.md), [roadmap](docs/ROADMAP.md), [chatbot guide](docs/CHATBOT.md), and [security review](docs/SECURITY.md).

## Technology stack

- Web: Next.js App Router, TypeScript, Tailwind CSS.
- API: NestJS, TypeScript, Prisma 7 with `@prisma/adapter-pg`, REST, Swagger/OpenAPI.
- Data/services: PostgreSQL with pgvector, unaccent and pg_trgm; Redis and BullMQ; Nginx; Mailpit.
- Local AI: Ollama on the Windows host, configurable through environment variables. The chatbot uses only the local knowledge corpus and published catalog, with authenticated owner-scoped chat and admin quality review; it does not use web search.

## Windows development notes

For faster file watching and dependency installation, place the repository in the WSL2 Linux filesystem (for example `~/projects`) rather than under `/mnt/c` or a Windows drive. Docker Desktop should use its WSL2 backend. An initial `.wslconfig` memory limit around 6 GB is suggested for this 16 GB laptop; tune it after checking actual Docker and host Ollama usage.

1. Copy `.env.example` to `.env`, set a local PostgreSQL password, and replace `JWT_ACCESS_SECRET` with a random value of at least 32 characters. Generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Never commit `.env`. `DATABASE_URL` and `REDIS_URL` refer to internal Compose service names and are intended for containers.
2. From PowerShell in the repository directory, run `docker compose up --build`. The development override enables hot reload. The first run downloads/builds images and may take several minutes. When running project npm commands directly in Windows PowerShell, use `npm.cmd` if the system blocks the `npm.ps1` script.
3. Compose applies pending Prisma migrations automatically. Seed the 50-product learning catalog, demo vouchers, and default stock values with `docker compose --profile tools run --rm seed`. The seed is idempotent and can be rerun to restore the versioned demo data.
4. To provision the local admin account, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `.env` file and run the same seed command. Both values are required together; without them, seeding does not create or promote an admin. There are no built-in credentials.
5. Open `http://localhost:8081` for the storefront. Create a customer account at `/register`, then open Mailpit at `http://localhost:8025` to use the verification or password-reset link. Sign in at `/login` and manage the profile at `/account`. If an admin was provisioned, sign in with that account and open `/admin`. Save delivery addresses at `/account/addresses`, add products to `/cart`, and try the explicitly simulated checkout at `/checkout`. Review orders at `/account/orders` and saved products at `/account/wishlist`. Browse products at `/products`. Swagger is at `http://localhost:8081/api/docs`.
   The admin dashboard includes order cancellation and return moderation, voucher and storefront-banner management, review moderation, customer account controls, and an audit log. Payment, delivery, and returns are local simulations; no real refunds or transactions occur.
6. To stop the stack, use `Ctrl+C`, then run `docker compose down`. To preserve the database, do not add `-v`.

### Tests, reset, and metrics

- Run unit tests, lint, and production builds with `npm test`, `npm run lint`, and `npm run build`.
- With the Compose database, Redis, and catalog seeded, run the API end-to-end checks with `docker compose run --rm --no-deps api npm run test:e2e --workspace apps/api`. CI provisions isolated PostgreSQL/Redis services, applies migrations, seeds the catalog, and runs these checks.
- The Prometheus text endpoint is available at `/api/metrics`; it exports bounded method/status request counts, request-duration totals, process uptime, and resident memory.
- Evaluate chatbot retrieval and answer quality with the commands in [docs/CHATBOT.md](docs/CHATBOT.md); answer evaluation uses the configured local LLM and checks a small deterministic rubric.
- To wipe demo users, orders, and database records, run `.\scripts\reset-demo.ps1` in PowerShell and type `RESET` at the confirmation prompt. The script re-applies migrations, seeds catalog/admin values from `.env`, re-indexes knowledge (Ollama must be reachable), and restarts Compose. It does not remove uploaded images or Mailpit messages. **This is destructive; never use it for data you need to keep.**

The web app is exposed on all host interfaces at port 8081 by default to avoid a known local project port collision. For phone testing, use the laptop's LAN IP on the same trusted private Wi-Fi and allow only the chosen web port through Windows Firewall on the Private profile. Local HTTP is not encrypted; do not use it on a public or untrusted network. API, database, and Redis ports are not published to the host/LAN. Mailpit UI is bound to localhost.
Set the optional `SITE_URL` in `.env` to the LAN origin when product pages are shared from a phone; it controls absolute SEO/Open Graph URLs, auth email links, and the API's allowed browser origin. Compose defaults it to `http://localhost:${APP_PORT}`. `COOKIE_SECURE=false` is for local HTTP only; production requires an HTTPS `SITE_URL` and `COOKIE_SECURE=true`.

### Commerce simulation (Phases 3a–3b)

- The bundled address picker uses the General Statistics Office's two-level reference snapshot retrieved on 2026-11-07: 34 province/city units and 3,321 commune-level units. Delivery street details remain free text; no live address service is required.
- Guest carts are stored in Redis for up to 30 days and merge into the account cart on login. Products that are no longer available remain visible so they can be removed instead of silently disappearing.
- Checkout offers simulated GHN, GHTK, and Viettel Post options. The estimated fees use the selected province region and package weight; shipping is free from 1,500,000 ₫ after voucher discounts or with the `FREESHIP` voucher. No carrier is contacted.
- The seed includes `FIGURE10` (10% off, 500,000 ₫ minimum, 200,000 ₫ maximum discount) and `FREESHIP` (300,000 ₫ minimum). Both are demo vouchers with usage limits and expiry dates enforced by the API.
- Loyalty earns 1 point per 10,000 ₫ of eligible merchandise after discounts; 100 points redeem for 10,000 ₫. Points never discount shipping.
- New checkout orders reserve stock and clear the account cart. Public availability subtracts reservations; on-hand stock is decremented when the simulated order ships. A pending transfer expires after 15 minutes; failure, cancellation, or expiry releases its stock, voucher use, and redeemed points.
- Supported payment choices are fake bank transfer and fake COD. Transfer success/failure/cancel is selected on the order page. COD is marked paid only when the worker simulates delivery. There is no card form, payment provider, real charge, carrier request, or refund.
- The BullMQ worker checks expiry and fulfillment every 15 seconds. After payment, demo orders move to preparation after 15 seconds, shipment after 30 more seconds, and delivery after another 30 seconds; generated tracking numbers and Mailpit order-status messages are fictional. Earned points are credited only on simulated delivery. A return request is available for seven days after delivery and does not issue a real refund.
- The Phase 5a knowledge base uses local Markdown documents and published products only. It does not search the web. Ollama runs on the Windows host; if containers cannot reach it, set `OLLAMA_HOST=0.0.0.0` on Windows and allow port 11434 through Windows Firewall on the Private network. See [docs/CHATBOT.md](docs/CHATBOT.md) for indexing, retrieval, provider configuration, and benchmark instructions.
- The signed-in chatbot at `/chat` answers from local documents and published product data, shows citations, and supports feedback. Admins can review transcripts at `/admin/chat`. Run the retrieval evaluation with `docker compose exec -T api npm run chatbot:evaluate --workspace apps/api`; it checks source retrieval, not answer quality.
- Public catalog home, product detail, and filter facets use short-lived Redis caches; checkout still revalidates live prices and stock. Catalog lists and free-form suggestions are deliberately not cached to avoid unbounded cache-key growth.
- Reviews require a delivered purchase and remain pending moderation; only approved reviews appear publicly. Wishlist and order data require authentication and are always scoped to the signed-in customer.
- The PWA caches only versioned same-origin static assets and a static offline page. It never caches API responses, storefront pages, or account/order data. On localhost, browsers permit service workers over HTTP; installing from another device on the LAN requires HTTPS. Plain-HTTP LAN access remains available for regular browsing but is not installable as a PWA.
- Rerunning the seed restores versioned catalog stock when doing so will not violate active reservations; it keeps order history and does not clear active reservations.

### Windows and WSL2

For faster installs and file watching, keep the repository inside the WSL2 Linux filesystem (for example `~/projects/japan-figure`) rather than under `/mnt/f`. Limit WSL2 memory to about 6 GB in `%UserProfile%\.wslconfig` so Docker and host-side Ollama retain RAM. Configure service workers for LAN installation only after setting up HTTPS and enabling `COOKIE_SECURE=true`.

### Troubleshooting

- **Docker Engine is unavailable / HTTP 500:** start Docker Desktop and wait for its engine to become ready. In Docker Desktop settings, confirm the WSL2 engine is enabled. Check `docker info`, then `docker run --rm hello-world`; if these fail, restart Docker Desktop before running Compose.
- **Worker reports Redis eviction policy warnings:** the Compose configuration sets `noeviction` for BullMQ. Recreate containers with `docker compose up --build -d` after changing Compose settings; do not override the Redis policy with an eviction mode.
- **Port 8081 is already in use:** set `APP_PORT` in `.env` to another unused host port, then run Compose again and open that port. For phone access, update the matching private-network firewall rule.
- **A newly added package cannot be found in the development container:** development `node_modules` are kept in named volumes. Refresh the relevant volume after changing dependencies with `docker compose run --rm --no-deps api npm install --workspace apps/api` (or use the web workspace for web-only packages), then run `docker compose up --build` again.
- **Database/Redis health check fails:** inspect `docker compose logs postgres redis migrate api`. Keep the `.env` password consistent with a fresh database volume. After changing the database password for an already-initialized local volume, either use the original password or deliberately reset the demo database volume (this deletes local database data).
- **Ollama is unavailable:** this is a non-fatal warning; Ollama is only needed in later chatbot phases. If containers cannot reach the Windows host, set host Ollama to listen on `0.0.0.0` and allow port 11434 through Windows Firewall on the Private network.
- **Catalog is empty:** run `docker compose exec api npm run db:seed --workspace apps/api`. It is idempotent and can be safely rerun to restore the versioned demo catalog.
- **File watching is slow on a Windows drive:** the current `F:\WebFigure` path is supported. Moving/cloning into a WSL2 Linux filesystem is an optional performance improvement, not a Docker prerequisite.

## Local images

Only self-made/generated placeholder images are committed under `apps/web/public/products/`; regenerate them with `npm run generate:placeholders`. Locally supplied images override admin uploads and placeholders from the gitignored `local-images/` directory by matching product slug and `.webp` extension, for example `local-images/frieren-prize-figure.webp`. Admin uploads accept WebP files up to 5 MiB and persist in the untracked `product_uploads` Docker volume. Keep local override filenames aligned with product slugs. Missing images fall back to the generic generated SVG. Do not commit copyrighted figure/anime images.

## Environment checklist

- Install Docker Desktop and enable the WSL2 backend. Start Docker Desktop and wait for its engine to become ready before using Compose.
- Install Node.js LTS and Git. GitHub CLI (`winget install --id GitHub.cli -e`) is optional; SourceTree or GitHub's website can be used to manage and publish the repository.
- Optional performance tuning: create or edit `%UserProfile%\.wslconfig` with:

  ```ini
  [wsl2]
  memory=6GB
  ```

  Apply changes by running `wsl --shutdown`, then restart Docker Desktop. This is optional tuning for the 16 GB laptop, not a requirement; installing a separate Ubuntu distribution is not required for Docker Desktop.

- Install Ollama for Windows from its official installer. In PowerShell, download the planned models (this can require substantial disk space and time):

  ```powershell
  ollama pull qwen2.5:3b-instruct
  ollama pull qwen2.5:1.5b-instruct
  ollama pull bge-m3
  ```

- If containers cannot reach Ollama at `host.docker.internal:11434`, configure host Ollama to listen on `0.0.0.0` and allow it through Windows Firewall only as appropriate for the private network.
- Find the laptop LAN IPv4 address with `ipconfig`, under the Wi-Fi adapter's IPv4 Address. For phone testing, create a Windows Defender Firewall inbound rule for TCP port 8081, allow the connection on the Private profile only, and use `http://<LAN-IP>:8081` on the same Wi-Fi. Do not expose database, Redis, or API ports to the LAN.

## License

MIT. See [LICENSE](LICENSE).
