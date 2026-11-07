---
agent: agent
description: Phase 3b - checkout, fake payments, orders, worker, reviews, PWA
---
Follow `.github/copilot-instructions.md`. Branch `phase/3b-checkout-orders`; PR to `main` when verified. Phase 3a must be merged first.

- Checkout and payments, ALL mocked through an internal fake payment gateway module (clearly documented and labeled "mock" in UI): COD, bank transfer with generated fake VietQR + countdown, e-wallets (MoMo, ZaloPay, VNPay style redirect pages with success/fail/cancel), credit/debit card form (fake test card numbers only, no card data stored), pre-order deposit payment. Webhook-style callbacks to update payment state, idempotency keys, expiry of unpaid orders, stock reservation and release.
- Orders: state machine (pending -> paid -> packing -> shipped -> delivered / cancelled / returned) with history table; BullMQ worker advances statuses over simulated time and sends fake emails via Mailpit; order tracking page with timeline; cancel and return request flows; invoice view.
- Wishlist, reviews (verified buyers only, with rating distribution), recently viewed. Add review seed data now.
- PWA: web manifest, icons, offline fallback page. Optional: mkcert HTTPS setup guide for installing the PWA on phones over LAN (document honestly that browsers require HTTPS to install PWAs except on localhost).

Unit tests for the state machine and payment callbacks; e2e test for the full purchase flow (guest -> register -> cart -> voucher -> pay -> track). Report and stop.
