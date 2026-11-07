---
agent: agent
description: Phase 4 - admin panel
---
Follow `.github/copilot-instructions.md`. Branch `phase/4-admin`; PR to `main` when verified.

Admin area under `/admin` (responsive, role-protected, audit-logged):
- Dashboard: revenue, orders by status, top products, low stock, charts with time ranges.
- Products CRUD with image upload (stored in a local volume, validated type/size), variants, stock adjustments with movement history, bulk actions.
- Orders: list/filter, detail, status transitions (respecting the state machine), refund/cancel handling, printable invoice.
- Vouchers/promotions CRUD, banners management, reviews moderation, customers list, audit log viewer.
- Chatbot management page as a placeholder (filled in phase 5b): knowledge docs list, re-index button, chat logs viewer.
- Seed an admin account from env (never hardcoded in code).

Authorization tests (normal users and guests must not reach admin APIs or pages). Report and stop.
