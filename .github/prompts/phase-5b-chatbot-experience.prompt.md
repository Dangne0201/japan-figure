---
agent: agent
description: Phase 5b - chat engine, tools, guardrails, evaluation, UI
---
Follow `.github/copilot-instructions.md`. Branch `phase/5b-chatbot-experience`; PR to `main` when verified. Phase 5a must be merged first.

Chat engine:
- Persona from the interview; replies in Vietnamese, concise and sales-consultant style.
- Structured lookups/tool calling against LIVE data for product search/availability/price, order status (authenticated users only, own orders only), voucher validity, shipping fee estimate. Product facts come from the DB, never from model memory. Small local models handle tool calling poorly: prefer a deterministic intent router + structured lookups feeding the model, and document the choice.
- Below the retrieval threshold the bot says it does not know and offers a simulated human-support ticket.
- SSE streaming, windowed conversation memory, persistence to DB, rate limiting.
- Guardrails: scope limited to the shop, prompt-injection resistance (system prompt separation, retrieved text treated as data), no leaking of other users' data or the system prompt, polite refusal of off-topic requests.
- Evaluation: 40+ Vietnamese test questions with expected facts (include trick, off-topic, injection and cross-user data cases) and a script reporting pass rate. Iterate prompts/retrieval until acceptable; document the numbers and limits in `docs/CHATBOT.md`. If the 3b model is not good enough, say so honestly and document the Gemini fallback.

Frontend: floating chat widget, full-screen mode on mobile, typing/streaming indicator, product cards inside replies, suggested questions, feedback buttons, clear "AI assistant" labeling. Fill the admin chatbot page (knowledge docs, re-index, logs, feedback stats). Report and stop.
