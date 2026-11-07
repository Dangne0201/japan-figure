---
agent: agent
description: Phase 0 - interview the owner, design docs, repo skeleton, GitHub
---
Follow `.github/copilot-instructions.md`. Phase 0 works directly on `main`.

## Step 1: Interview (ONE round only, to save quota)
Ask the owner, in Vietnamese, ALL of the following in a single message, each with 3-4 suggested options so they can answer briefly (e.g. "1-B, 2-A"). Then END YOUR TURN and wait; continue only after the owner replies. Do not ask further questions unless blocked.
- Shop name and brand personality (otaku-friendly, premium collector, kawaii, minimal Japanese...). Offer to propose names.
- Visual style: color palette, light/dark/both, vibe references.
- Product focus: scale figures, Nendoroid, prize figures, model kits, or a mix; price range in VND; number of products to seed (suggest 40-60).
- Feature priorities (rank): chatbot quality, admin panel, promotions/vouchers, reviews, loyalty points, wishlist, order tracking.
- Chatbot persona: name, tone (friendly/polite/playful), how it addresses customers.
- Shop policies to simulate (shipping times, return policy, warranty, pre-order deposit rules), or "you propose realistic Vietnamese-market defaults".

## Step 2: Check the owner's tools
Run in the terminal and report: `node -v`, `npm -v`, `docker --version`, `docker compose version`, `git --version`, `gh --version`, `gh auth status`, `wsl -l -v`, and whether Ollama responds (`curl http://localhost:11434/api/tags`). Also check whether the repo is inside the WSL2 filesystem or on a Windows drive and warn about slowness if on a Windows drive. For anything missing, give exact Windows install steps, wait for the owner if it blocks progress.

## Step 3: Design docs (in `docs/`)
- `ARCHITECTURE.md`: system diagram (Mermaid), services, networking (host Ollama, LAN access), data flow, chatbot RAG flow, memory budget for a 16GB machine.
- `DATA_MODEL.md`: ERD (Mermaid) covering users, addresses, products, categories, series, brands, variants/stock and stock movements, images, carts, orders, order items, order status history, payments, vouchers, loyalty points, reviews, wishlist, banners, audit logs, chat sessions/messages/feedback, knowledge documents/chunks (pgvector 1024).
- `ROADMAP.md`: phases 1, 2, 3a, 3b, 4, 5a, 5b, 6 with acceptance criteria per phase.
- Fill `DECISIONS.md` with the initial decisions and the interview answers.

## Step 4: Repo skeleton and GitHub
- `git init` (branch `main`), `.gitignore` (include `.env`, `local-images/`, node_modules, build output, uploads; do NOT ignore `.github/` or `docs/`), `.gitattributes`, `.dockerignore`, `.editorconfig`, MIT `LICENSE`, `README.md` skeleton with the educational disclaimer, `.env.example` stub.
- Commit everything (including the existing `.github/` files and `docs/`) with Conventional Commits.
- Create a PUBLIC GitHub repo with `gh repo create` (suitable name from the shop name), push `main`. If `gh` is not ready, give exact steps and wait.
- Enable sensible defaults you can set via `gh` (e.g. delete branch on merge); suggest branch protection steps for the owner if not settable.

## Step 5: Environment checklist for the owner (Windows)
Docker Desktop with WSL2 backend, `.wslconfig` memory limit (~6GB), Ollama install, `ollama pull qwen2.5:3b-instruct`, `ollama pull qwen2.5:1.5b-instruct`, `ollama pull bge-m3`, how to find the laptop's LAN IP, how to open Windows Firewall for the web port (8081) on the private network only.

Update PROGRESS.md. End with the phase report and ask for approval to start phase 1.
