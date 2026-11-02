# Serverpulse

Serverpulse is a frontend-only API management and monitoring workspace for developer teams. This implementation runs entirely in the browser: services return realistic sample data asynchronously, mutations persist in `localStorage`, and the API tester sends real browser HTTP requests through Axios. No API server, database, OpenAPI backend, or external credentials are required.

## Run locally

From the repository root:

```bash
cd artifacts/serverpulse
pnpm install
pnpm dev
```

Build and type-check:

```bash
pnpm build
pnpm typecheck
```

The default route is a product landing page. Create a local demo workspace or sign in with the prefilled demo form. Demo auth is browser-local and is not an account service. Protected workspace pages redirect to `/login` until demo auth is active.

## Features

- Responsive product landing page, local demo login/register/recovery screens, public status page, and not-found page.
- Protected workspace shell, role preview (Owner, Admin, Developer, Viewer), workspace switching, dark/light appearance, and persistent browser preferences.
- Overview dashboard with request traffic charts, API health, current alerts, and recent log activity.
- API inventory with search/status filters, create/edit/delete/clone/favorite actions, JSON OpenAPI/Postman-compatible import, JSON OpenAPI export, details, endpoint examples, and docs.
- API tester with method, URL, query params, headers, bearer auth, body, real Axios requests, response timing/status, failure/CORS feedback, cURL copy, and browser-local history.
- Request logs with search, status/method filters, simulated live status, pause/resume, request details, replay-to-tester, and JSON export.
- Analytics charts, date range selection, CSV export; monitoring health checks and interval controls.
- Access keys with scopes, one-time key display, rotate/revoke actions; alert acknowledgement; team invitations and role updates; webhook retry/remove; docs, audit, billing usage, and settings.
- Async mock service delays, generated in-code seed data, local CRUD state, loading/error/empty states, and demo reset.

## Folder structure

```text
artifacts/serverpulse/
├── README.md
├── package.json
└── src/
    ├── App.tsx                 # React Router routes, auth provider, app shell, landing, dashboard, inventory, logs
    ├── app.css                 # Inventory, table, shared component and responsive layout styling
    ├── app-extra.css           # Product landing, tester, settings and secondary-page styling
    ├── index.css               # Design tokens, font setup, base/reset and dark/light palettes
    ├── main.tsx                # React entry point
    ├── components/ui/          # Existing scaffold UI primitives
    ├── hooks/
    │   └── useResource.ts      # Async loading/error/refresh hook for mock service data
    ├── pages/
    │   ├── ExtraPages.tsx      # Analytics, monitoring, keys, alerts, team, webhooks, docs/billing/settings, tester/status
    │   └── not-found.tsx       # Unknown-route experience
    ├── services/
    │   └── mock.ts             # Typed async local-first data access and demo seed data
    └── types/
        └── index.ts            # Shared workspace/API/log/team/monitoring domain types
```

## Data and backend connection

All product-domain data access belongs in `src/services/`. The current `src/services/mock.ts` implements typed mock functions with realistic latency and local-storage persistence. UI components call those service functions directly or through `src/hooks/useResource.ts`; no backend routes are called.

To connect a backend later:

1. Keep the exported service function signatures as the UI-facing contract, or introduce typed API service implementations alongside the mock adapter.
2. Replace the mock implementations in `src/services/mock.ts` with Axios calls to your backend and configure the API base URL via a `VITE_API_BASE_URL` environment variable.
3. Normalize backend responses into the domain types in `src/types/index.ts`; keep auth/session and workspace scoping in the service boundary.
4. Replace local-only mutations and demo auth when the server endpoints are ready. The existing demo-only flows should not be mistaken for server-side security.
5. Configure CORS on the API server for the frontend origin. The API tester calls its selected destination directly from the browser, so target APIs must permit that origin.

No backend/API-server, database, or OpenAPI-spec files are part of this frontend implementation.
