# Chatbot knowledge, retrieval, and API

Phase 5a provides local knowledge ingestion, retrieval, and LLM provider foundations. Phase 5b adds the authenticated conversation API, grounded streaming answers, storefront chat, feedback, admin transcript review, and a retrieval evaluation harness.

## Knowledge sources and indexing

Only Markdown files in `knowledge/` and products with `publishedAt` set are indexed. The Markdown corpus documents shop identity, policies, catalog fields, account/cart/checkout workflows, order lifecycle, reviews/wishlist, and privacy boundaries. Product chunks contain the current name, character, series, brand, description, integer VND price, preorder status, release date when available, and total available stock (`stock on hand - reserved`). Product citations link to `/products/<slug>`. Unpublished products are removed from the index.

PostgreSQL stores chunk text, normalized text, SHA-256 content hash, source metadata, product relation, and an optional `vector(1024)` embedding. Prisma models the vector column as `Unsupported("vector(1024)")`; inserts and vector similarity searches use parameterized raw SQL. Vietnamese keyword matching uses diacritic normalization and PostgreSQL `pg_trgm` similarity.

Admin create/update/publish/stock operations enqueue indexing jobs. Checkout reservations, payment failure/cancellation, order expiry, order cancellation, and shipment stock consumption also enqueue re-index jobs so indexed availability follows inventory changes. BullMQ retries failed jobs. Re-index all current Markdown and published products with:

```powershell
docker compose build api worker
docker compose run --rm --entrypoint node worker apps/api/dist/knowledge/reindex.js
```

Run this after changing knowledge documents, seeding or migrating the catalog, or recovering from a failed indexing job. The worker container must be able to reach PostgreSQL, Redis, and Ollama. Do not remove the PostgreSQL volume to re-index.

## Retrieval behavior

Search obtains an embedding for the user query, combines cosine vector relevance with normalized PostgreSQL trigram/substring relevance, filters below `KNOWLEDGE_RELEVANCE_THRESHOLD`, sorts by a weighted score, and returns at most `KNOWLEDGE_TOP_K` chunks. Each result includes its document/product source, chunk index, and metadata for citations. Defaults are threshold `0.42` and top-k `5`; adjust only after validating representative Vietnamese questions.

An empty result means the local index did not meet the configured threshold. The chatbot clearly says when the local data does not answer a question and must not invent a product, price, inventory count, policy, or authenticity claim. The chatbot must not use web search.

## Conversation API

All `/api/chat` endpoints require an authenticated, verified account. Conversations and messages are private to their owner; a conversation belonging to another account is reported as not found. Deleting a conversation cascades to its messages. Conversations remain stored until deleted by the owner.

- `POST /api/chat/conversations` creates a conversation.
- `GET /api/chat/conversations?page=1&limit=20` lists the owner’s conversations.
- `GET /api/chat/conversations/:conversationId` returns at most the 50 newest messages in chronological order.
- `DELETE /api/chat/conversations/:conversationId` deletes an owned conversation.
- `POST /api/chat/conversations/:conversationId/messages` accepts `{ "content": "..." }` (1–500 characters) and streams Server-Sent Events.

The streaming endpoint emits `start`, `sources`, `token`, and `done` events. If retrieval or generation fails after the stream starts, it emits an `error` event; once the user message has been persisted, it remains saved, while an incomplete assistant answer is never stored. Requests are limited to six messages per minute by the API throttler. Generation stops when the client disconnects.

The assistant is instructed to answer only in Vietnamese, using retrieved local documents and current database values for retrieved products. Product prices and available stock are loaded from currently published catalog records, not copied from potentially stale indexed text. If retrieval yields no usable source, the API returns a deterministic Vietnamese refusal without invoking the LLM. Retrieved content and conversation history are treated as untrusted context; they cannot authorize access to private order/account data or override the system instructions.

The chatbot API does not expose order history, shipping addresses, or any other customer’s data. Users can review and delete their own conversations; admins can review transcripts for quality purposes. The UI warns users not to submit sensitive information in chat.

## Knowledge corpus authoring

Write customer-facing guidance in Vietnamese in `knowledge/*.md`. Keep each document focused on one related topic with descriptive headings and concrete question-answer language so semantic and keyword retrieval can find the right section. Document only behavior verified against the storefront, API, seed data, or an explicitly recorded project policy. Clearly label simulations, limitations, and data that can change.

Do not put secrets, real customer records, credentials, or unsupported business promises in the knowledge directory. Avoid fixed product price/stock claims in policy documents; live published-product data is indexed separately and refreshed when inventory changes. After an edit, run the retrieval evaluation and re-index the documents; never reset PostgreSQL just to refresh embeddings.

## LLM and environment

- `LLM_PROVIDER=ollama` (default): local Ollama chat, primary model `OLLAMA_CHAT_MODEL` (`qwen2.5:3b-instruct` by default), with the configured smaller fallback model.
- `LLM_PROVIDER=gemini`: optional Gemini chat; requires `GEMINI_API_KEY` and uses `GEMINI_CHAT_MODEL`. The key is passed in the request header and must never be logged or committed.
- Embeddings always use `OLLAMA_EMBEDDING_MODEL` (`bge-m3`) at 1024 dimensions, even when Gemini chat is selected. This keeps stored vectors compatible.
- `LLM_REQUEST_TIMEOUT_MS` (default `120000`) and `LLM_RETRY_COUNT` control provider timeout/retries. Ollama generation is capped at 256 new tokens and the Vietnamese prompt requests concise answers, avoiding unbounded CPU generation. The longer default accommodates local inference; streaming does not restart a response after partial text has already been emitted. Lower the timeout only after measuring the configured model and representative grounded prompts.

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

## Retrieval evaluation

The committed 50-case Vietnamese dataset covers ordinary store questions, tricky claims, off-topic requests, prompt-injection attempts, and cross-user/private-data requests. Expected sources are local Markdown filenames; off-topic cases expect no evidence, while cross-user cases verify retrieval remains limited to public knowledge/catalog sources.

Run the evaluation against the current local index from the API container:

```powershell
docker compose exec -T api npm run chatbot:evaluate --workspace apps/api
```

The harness reports whether each expected document appears in the configured top-k retrieval results, whether an off-topic query returns no evidence, or whether cross-user queries retrieve only public knowledge/catalog source types. It also reports a pass rate by category and exits non-zero when an expectation fails. This is a deterministic retrieval metric, **not** an automated judgment of generated answer correctness, citation quality, or prompt-injection resistance. Review generated responses manually before relying on chatbot behavior; the separate model benchmark currently covers only a single grounded answer.

## Scope and safety

This is an educational local simulation, not a real shop. Shipping and payment are simulated; no carrier, bank, or email is contacted; return requests do not cause real refunds. Seeded product names, JAN-like identifiers, prices, dates, and inventory are not proof of authenticity or availability. See the individual `knowledge/*.md` source documents for the customer-facing wording.
