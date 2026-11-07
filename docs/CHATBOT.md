# Chatbot knowledge and retrieval

Phase 5a provides local knowledge ingestion, retrieval, and LLM provider foundations. It does not implement the chatbot API, conversation history, or web chat UI; those belong to a later phase.

## Knowledge sources and indexing

Only Markdown files in `knowledge/` and products with `publishedAt` set are indexed. Product chunks contain the current name, character, series, brand, description, integer VND price, preorder status, release date when available, and total available stock (`stock on hand - reserved`). Product citations link to `/products/<slug>`. Unpublished products are removed from the index.

PostgreSQL stores chunk text, normalized text, SHA-256 content hash, source metadata, product relation, and an optional `vector(1024)` embedding. Prisma models the vector column as `Unsupported("vector(1024)")`; inserts and vector similarity searches use parameterized raw SQL. Vietnamese keyword matching uses diacritic normalization and PostgreSQL `pg_trgm` similarity.

Admin create/update/publish/stock operations enqueue indexing jobs. Checkout reservations, payment failure/cancellation, order expiry, order cancellation, and shipment stock consumption also enqueue re-index jobs so indexed availability follows inventory changes. BullMQ retries failed jobs. Re-index all current Markdown and published products with:

```powershell
docker compose build api worker
docker compose run --rm --entrypoint node worker apps/api/dist/knowledge/reindex.js
```

Run this after changing knowledge documents, seeding or migrating the catalog, or recovering from a failed indexing job. The worker container must be able to reach PostgreSQL, Redis, and Ollama. Do not remove the PostgreSQL volume to re-index.

## Retrieval behavior

Search obtains an embedding for the user query, combines cosine vector relevance with normalized PostgreSQL trigram/substring relevance, filters below `KNOWLEDGE_RELEVANCE_THRESHOLD`, sorts by a weighted score, and returns at most `KNOWLEDGE_TOP_K` chunks. Each result includes its document/product source, chunk index, and metadata for citations. Defaults are threshold `0.42` and top-k `5`; adjust only after validating representative Vietnamese questions.

An empty result means the local index did not meet the configured threshold. A later chatbot must clearly say when the local data does not answer a question and must not invent a product, price, inventory count, policy, or authenticity claim. The chatbot must not use web search.

## LLM and environment

- `LLM_PROVIDER=ollama` (default): local Ollama chat, primary model `OLLAMA_CHAT_MODEL` (`qwen2.5:3b-instruct` by default), with the configured smaller fallback model.
- `LLM_PROVIDER=gemini`: optional Gemini chat; requires `GEMINI_API_KEY` and uses `GEMINI_CHAT_MODEL`. The key is passed in the request header and must never be logged or committed.
- Embeddings always use `OLLAMA_EMBEDDING_MODEL` (`bge-m3`) at 1024 dimensions, even when Gemini chat is selected. This keeps stored vectors compatible.
- `LLM_REQUEST_TIMEOUT_MS` and `LLM_RETRY_COUNT` control provider timeout/retries. Streaming does not restart a response after partial text has already been emitted.

Ollama must run on the Windows host and expose `host.docker.internal:11434` to the containers. If connectivity fails, set `OLLAMA_HOST=0.0.0.0` on Windows, allow TCP port 11434 through Windows Firewall on the Private network, and restart Ollama. Do not expose this port on public networks. The API startup check reports an actionable connectivity failure.

## Model benchmark

Run the same knowledge-grounded Vietnamese help question against the configured 3B and 1.5B models from PowerShell on the Windows host:

```powershell
npm.cmd run chatbot:benchmark --workspace apps/api
```

Before each run, the script unloads configured and currently loaded models and confirms Ollama reports none loaded, so a prior model cannot contaminate the baseline. On Windows, it samples both the Ollama service and `llama-server` model-runner process working sets while generating and reports baseline, peak, and peak delta alongside generated tokens per second and the answer text. It unloads each model after its run. The working-set peak is a process-memory measurement, not total system RAM. On other platforms it reports the loaded model allocation from `/api/ps`, not total process RSS or system RAM. If a model is unavailable, process memory cannot be sampled, or the host endpoint cannot be reached, the script reports an error and exits non-zero; it does not download models.

**Local benchmark (2026-11-07, Windows host, CPU inference):**

| Model                   | Generated tokens |     Throughput | Peak Ollama + runner working set | Peak increase over baseline | Answer check                                                                                         |
| ----------------------- | ---------------: | -------------: | -------------------------------: | --------------------------: | ---------------------------------------------------------------------------------------------------- |
| `qwen2.5:3b-instruct`   |               56 |  7.01 tokens/s |   2,293,624,832 bytes (2.14 GiB) |         2,164,686,848 bytes | Correct, with a useful warning not to use strong cleaners or hot water without product instructions. |
| `qwen2.5:1.5b-instruct` |               12 | 10.99 tokens/s |   1,308,491,776 bytes (1.22 GiB) |         1,178,669,056 bytes | Correct but much shorter: recommends a soft brush.                                                   |

Both answers passed this single grounded test. The 1.5B model was faster and used less measured process working set; the 3B answer was more complete. Keep the configured 3B primary and 1.5B fallback for now, and repeat the quality check with a representative question set before making a broader model recommendation. Results are one local run, not a general performance guarantee. Do not treat model-file size as runtime RAM use.

## Scope and safety

This is an educational local simulation, not a real shop. Shipping and payment are simulated; no carrier, bank, or email is contacted; return requests do not cause real refunds. Seeded product names, JAN-like identifiers, prices, dates, and inventory are not proof of authenticity or availability. See the individual `knowledge/*.md` source documents for the customer-facing wording.
