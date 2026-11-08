# Contributing

Japan Figure is a learning project and local educational simulation. Keep changes focused, documented, and testable.

## Development setup

Follow the Windows/Docker Desktop setup in [README.md](./README.md). Copy `.env.example` to `.env`; do not commit real credentials. Use the existing npm workspaces and keep the repository's Node.js 22 baseline.

## Change workflow

- Read [project progress](./docs/PROGRESS.md) and [technical decisions](./docs/DECISIONS.md) before starting.
- Use a focused branch named `phase/<number>-<part>` for phase work and open a pull request after verification.
- Use Conventional Commit messages and small, reviewable changes.
- Write code, identifiers, comments, and documentation in English. Storefront, chatbot, and seed text should be Vietnamese; currency is integer VND.
- Update relevant documentation and `docs/PROGRESS.md` when a phase milestone or verification result changes.

## Data, privacy, and simulated integrations

- Change PostgreSQL schema only through Prisma migrations. Prisma models do not support pgvector natively; keep `Unsupported("vector(1024)")` and parameterized raw SQL for vector operations.
- Keep account, order, and chat data owner-scoped. Do not send customer data to external LLMs or add web retrieval to the chatbot.
- Payments, shipping, returns, and email remain explicit simulations. Never add real payment or email credentials.
- Use only self-made/generated placeholder images in Git. Real images belong in the ignored `local-images/` folder or the untracked product-upload volume.

## Verification

Run the relevant checks before requesting review:

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run format:check
docker compose config --quiet
```

API unit tests generate an LCOV report under `apps/api/coverage/`; CI uploads this as an `api-coverage` artifact. The initial global coverage floors (20% branches, 25% functions, 34% statements, and 35% lines) are regression guardrails, not coverage goals.

The API end-to-end suite requires Compose PostgreSQL, Redis, and a seeded catalog:

```powershell
docker compose up -d postgres redis mailpit
docker compose run --rm migrate
docker compose --profile tools run --rm seed
docker compose run --rm --no-deps api npm run test:e2e --workspace apps/api
```

The suite creates and deletes a unique test customer. It does not reset the database. `.\scripts\reset-demo.ps1` is destructive and must only be run after its explicit confirmation when all local demo data can be discarded.
