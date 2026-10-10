---
name: Serverpulse scope
description: Persistent scope boundary for the Serverpulse product.
---

**Rule:** Serverpulse remains a frontend-only demo backed by local mock data and browser storage; the user will add a backend later.

**Why:** the user explicitly asked for the frontend only and said they will add the backend later.

**How to apply:** Do not modify the API server, OpenAPI spec, database schema, or backend routes, and do not wire the frontend to them unless the user later asks.
