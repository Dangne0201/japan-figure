---
agent: agent
description: Phase 6 - hardening, docs, portfolio polish
---
Follow `.github/copilot-instructions.md`. Branch `phase/6-polish`; PR to `main` when verified.

- Security review: OWASP Top 10 pass over the codebase (auth, injection, XSS, CSRF, rate limits, headers, uploads, dependency audit). Fix findings and document them in `docs/SECURITY.md`.
- Performance: DB indexes reviewed with EXPLAIN, Redis caching, image optimization, Lighthouse mobile pass, bundle size check.
- Quality: coverage report, e2e suite green, lint clean, dead code removed, `scripts/reset-demo` (reset DB + reseed + reindex).
- Observability: structured logs, request IDs, simple metrics endpoint.
- Docs: polished README (screenshot/GIF placeholders, architecture diagram, feature list, Windows quick start, LAN/phone access, chatbot notes, honest limitations), CONTRIBUTING, docs index, CI badge, tagged release v1.0.0.
- Final portfolio checklist: no secrets in git history, `.gitignore` covers local images, disclaimer present, license present, repo description and topics set via `gh`.
Report and stop.
