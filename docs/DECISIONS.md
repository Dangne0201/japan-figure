# Decisions

Append one entry per decision: date, decision, reason, alternatives considered.

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
