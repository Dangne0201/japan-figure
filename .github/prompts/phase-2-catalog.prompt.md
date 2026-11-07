---
agent: agent
description: Phase 2 - catalog domain, realistic seed data, product UI
---
Follow `.github/copilot-instructions.md`. Branch `phase/2-catalog`; PR to `main` when verified.

Backend:
- Models/APIs: brands, series, categories, products (scale, material, release date, dimensions, JAN-like code, pre-order flag/deposit, stock, price/sale price as integer VND), images.
- Listing with pagination, sorting, filters (series, brand, price range, scale, availability, pre-order) and full-text search that is diacritic-insensitive and typo-tolerant for Vietnamese (`unaccent` + `pg_trgm`).
- Seed: the number of products chosen by the owner, based on REAL popular anime series with accurate series/character names, plausible brands (e.g. Good Smile, Bandai, Banpresto, Kotobukiya), realistic VND prices and release dates, written Vietnamese descriptions, categories, brands, series. Data in versioned TS/JSON files, idempotent seed. Reviews seed data is added in phase 3b.
- Placeholder image generator script: distinct, tasteful SVG per product (series color theme + product name + scale) written to `apps/web/public/products/`. Implement the `local-images/` override and fallback from the instructions, and document how the owner adds real images.

Frontend (mobile-first, Vietnamese UI, brand style from the interview):
- Home (hero banner, featured, new arrivals, pre-order, sale sections), product list with filters (bottom-sheet filters on mobile), product detail (gallery, variants, stock state, related products), search with suggestions, header/footer, loading/empty/error states, SEO metadata, accessibility basics.

Tests for filtering/search logic. Verify on a phone-sized viewport and from a real phone over LAN if possible. Report and stop.
