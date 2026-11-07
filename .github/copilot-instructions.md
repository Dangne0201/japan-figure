# Project: Anime figure e-commerce simulation (learning project)

## Context
A realistic local simulation of a Vietnamese online shop selling anime figures. It runs only on the owner's Windows laptop (Docker Desktop + WSL2; 16GB RAM, GTX 1050 class GPU, effectively CPU-only for LLMs) and is accessed from the laptop and from phones on the same WiFi. The repo is PUBLIC and is a portfolio piece. The owner is a developer with 3 years of experience, new to professional web projects, comfortable with Docker. You act as a senior full-stack/DevOps engineer (10 years): you implement the work yourself, the owner reviews. The goal is learning the whole professional workflow, so follow real-world practice.

## Language rules
- Code, identifiers, comments, commit messages, README, docs: English.
- UI text, seed content, chatbot replies: Vietnamese. Currency: VND, stored as integer (never float), displayed like "1.250.000 ₫".
- Talk to the owner in Vietnamese; keep technical terms in English.

## Stack (do not change without asking)
- Frontend: Next.js (App Router) + TypeScript + Tailwind CSS. Mobile-first responsive, ONE UI for all devices. Admin lives in the same app under `/admin`.
- Backend: NestJS + TypeScript + Prisma, REST API with OpenAPI/Swagger. Background jobs: BullMQ on Redis.
- DB: PostgreSQL with extensions `vector` (pgvector), `unaccent`, `pg_trgm`. Redis for cache/session/rate-limit/queues. Nginx as reverse proxy (default host port 8080, configurable via env, because port 80 often conflicts on Windows).
- Fake mailbox: Mailpit container. Never send real email.
- LLM: Ollama running on the Windows HOST (not in Docker), reached via host.docker.internal:11434. Models via env: chat `qwen2.5:3b-instruct` (fallback `qwen2.5:1.5b-instruct`), embedding `bge-m3` (1024 dimensions). Provider swappable via env (LLM_PROVIDER=ollama|gemini). The chatbot answers only from local data (DB + `knowledge/` docs); no web access or web search.
- Everything starts with `docker compose up`. Keep total container memory modest; set memory limits per service.

## Engineering standards
- Monorepo: `apps/web`, `apps/api`, `infra/`, `docs/`, `knowledge/` (chatbot source docs), `scripts/`.
- Docker: multi-stage builds, healthchecks, named volumes, `depends_on` with `condition: service_healthy`, non-root users.
- Config: `.env.example` committed and fully documented; real `.env` never committed. No secrets in code or git history. Validate env at startup (fail fast).
- DB changes only via Prisma migrations. Idempotent seed script.
- Prisma has no native pgvector type: use `Unsupported("vector(1024)")` plus raw SQL for embedding writes and similarity queries; document it.
- Vietnamese search: use `unaccent` + `pg_trgm`; document how.
- Validate all input (class-validator or zod), consistent error format, structured logging with request IDs, rate limiting, hashed passwords (argon2 or bcrypt), CORS configured, HTTP security headers.
- Tests: unit tests for business logic (pricing, voucher, shipping, order state machine), e2e tests for critical API flows. ESLint + Prettier. GitHub Actions CI: lint, test, build.
- Windows specifics: `.gitattributes` with `* text=auto eol=lf`; shell scripts, Dockerfiles and config files must use LF. Recommend keeping the repo inside the WSL2 filesystem (e.g. `~/projects`) for fast file watching and installs; document in README. Suggest `.wslconfig` memory limit of about 6GB (Ollama on the host also needs RAM).
- If containers cannot reach Ollama via host.docker.internal:11434, document the fix (setting OLLAMA_HOST=0.0.0.0 on Windows and allowing it through the firewall) and add a startup check in the API that logs a clear, actionable error.
- Vietnam address data (province/district/ward) must be bundled as a static dataset (app runs offline). Check which administrative structure is current when implementing, and record the choice in DECISIONS.md.
- `.gitignore` must NOT exclude `.github/` or `docs/`.
- Git: Conventional Commits, small focused commits. Phase 0 commits directly to `main` (repo does not exist yet). From phase 1 on: one branch per phase/part (`phase/N-name`), open a PR with `gh`, merge to `main` only after verification. Never force-push `main`.

## Image policy (public repo)
- Commit ONLY self-made placeholder images (SVG/generated). Never download or commit copyrighted figure or anime images.
- Real product names/series may be used in seed data. README must carry a disclaimer: educational demo, not affiliated with any brand or studio, no real transactions.
- Product images are served from `apps/web/public/products/`: placeholders are committed. A gitignored folder `local-images/` overrides them by filename (`<slug>.webp`), so the owner adds real images locally without committing. Fallback to placeholder when a file is missing.

## How to work (the owner has a limited Copilot quota)
1. At the start of every session read `docs/PROGRESS.md` (and `docs/DECISIONS.md`) to know the current state. Update PROGRESS.md after every meaningful step: done / in progress / decisions / known issues / next step.
2. Work autonomously through the phase prompt. If a phase is too large to finish well in one run, split it at a natural boundary, record the split in PROGRESS.md, finish and verify the first part fully, then stop and report so the owner can continue (the `/resume` prompt exists for this). Never rush or stub to fit a run. Ask only when a decision is truly ambiguous and blocking; otherwise decide, record it in DECISIONS.md, move on.
3. Verify yourself before reporting: run build, lint, tests, `docker compose up`, hit health endpoints. Fix failures. Never claim something works without having run it; if you could not run something, say so explicitly.
4. Quality over speed. No stubs, no fake implementations, no hardcoded demo shortcuts presented as real features. Anything intentionally mocked (payments, shipping carriers, email, SMS) must be labeled as mock in the UI where relevant and in docs.
5. End each phase/part with a short Vietnamese report: what was built, how to run and test it, a manual checklist for the owner (including on a phone), known issues, and 2-3 optional exercises.
6. Do not start the next phase until the owner says so.
