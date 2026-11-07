---
agent: agent
description: Phase 1 - monorepo, Docker Compose, DB, CI
---
Follow `.github/copilot-instructions.md`. Branch `phase/1-foundation`; PR to `main` when verified.

Build the runnable foundation:
- `apps/api` (NestJS) and `apps/web` (Next.js) scaffolds, TypeScript strict, ESLint, Prettier, shared config. Apply the style/brand decisions from DECISIONS.md to a Tailwind theme (design tokens).
- `docker-compose.yml` (+ `docker-compose.override.yml` for dev with hot reload): nginx, web, api, worker (BullMQ, can share the api image), postgres (pgvector image), redis, mailpit. Healthchecks, named volumes, memory limits, healthy-start ordering. Nginx publishes the web port on 0.0.0.0 (default 8080) so phones on LAN can reach it; API, DB, Redis are not exposed to the host/LAN (Mailpit UI exposed on localhost only).
- Prisma setup; first migration enabling `vector`, `unaccent`, `pg_trgm`; `/api/health` checking DB, Redis and (non-fatally) Ollama; Swagger at `/api/docs`.
- Logging with request IDs, global exception filter, env validation at startup.
- `.env.example` fully documented.
- GitHub Actions CI: install, lint, test, build, docker build (cache enabled).
- A web landing page proving web -> api -> db connectivity, mobile layout checked.
- README: run from zero on Windows (WSL2 repo location), phone access over LAN, troubleshooting section.

Verify with a clean `docker compose up --build` and confirm access from the LAN IP. Report and stop.
