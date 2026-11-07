---
agent: agent
description: Phase 3a - auth, addresses, cart, shipping, vouchers, loyalty
---
Follow `.github/copilot-instructions.md`. Branch `phase/3a-accounts-cart`; PR to `main` when verified.

- Auth: register/login/logout, JWT access + refresh (httpOnly cookies, rotation), roles user/admin, password reset flow using Mailpit, email verification (fake), profile page.
- Address book with the bundled static Vietnam province/district/ward dataset (see instructions).
- Cart: guest cart (Redis/cookie) merged on login; stock checks; price snapshotting; cart UI optimized for mobile.
- Shipping: fee by province/region and weight, estimated delivery date, free-ship threshold, several carrier options (mock GHN/GHTK/Viettel Post style, clearly labeled mock).
- Vouchers: percent/fixed/free-ship, min order, usage limits per user/global, expiry, stackability rules; loyalty points earn/redeem rules. All pricing logic in one well-tested module (integer VND, rounding rules documented).

Unit tests for pricing, voucher, shipping; e2e tests for auth and cart flows; authorization tests. Report and stop.
