---
agent: agent
description: Phase 5a - chatbot knowledge base, ingestion, retrieval, LLM provider
---
Follow `.github/copilot-instructions.md`. Branch `phase/5a-chatbot-knowledge`; PR to `main` when verified.

Goal: foundation of a Vietnamese shop consultant that answers using ONLY local data. No internet access, no invented products.

- `knowledge/*.md`: realistic Vietnamese docs (shipping, returns/warranty, payment methods, pre-order rules, vouchers/loyalty, authenticity guide, figure care, FAQ, store info). They MUST match the behavior actually implemented in phases 2-4; read the code and the DECISIONS.md interview answers to stay consistent.
- Ingestion pipeline: chunk docs + product data (name, series, description, price, stock, status) -> embeddings via Ollama `bge-m3` -> pgvector (1024) with raw SQL. CLI re-index command; automatic re-index of a product when it changes (via queue).
- Retrieval: hybrid (vector + keyword/trigram), top-k with a relevance threshold, source tracking per chunk.
- LLM provider abstraction (Ollama default, Gemini optional via env), with timeouts, retries, streaming support, and the Ollama connectivity check/error handling from the instructions.
- Benchmark script: tokens/s and memory use of `qwen2.5:3b-instruct` vs `qwen2.5:1.5b-instruct` on this machine; record numbers in `docs/CHATBOT.md` with a recommendation.

Tests for chunking and retrieval (with a small fixed fixture). Report and stop.
