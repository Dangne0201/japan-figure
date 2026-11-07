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
