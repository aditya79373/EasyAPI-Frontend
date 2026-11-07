# EasyAPI Frontend

The web app for **EasyAPI**, an API operations workspace. Keep an inventory of the services your team depends on, test endpoints with real HTTP requests, watch request logs and analytics, monitor uptime, and share a workspace with teammates as view-only.

The server lives in a separate repository: **EasyAPI-Backend**.

## Features

- **Overview dashboard**: request traffic, latency and health at a glance.
- **API inventory**: add, edit, clone, favourite, import and export your APIs.
- **API tester**: send real requests (GET, POST, PUT, PATCH, DELETE) with params, headers, bearer auth and a JSON body. History is kept per browser.
- **Request logs**: live request stream with search and filters, pause/resume, export, and replay in the tester.
- **Analytics**: traffic over time, top services, response-code distribution, p95 latency, CSV export.
- **Monitoring**: uptime checks with a configurable interval (15 / 30 / 60 sec) and pause/resume.
- **Alerts**: live alerts raised from failed checks and requests.
- **Team and workspace sharing**: invite people by email. An invited person can open your workspace in a fully **view-only** mode and sees your complete dashboard, never their own data. Invite statuses: Pending, Active, Rejected.
- **Authentication**: email + password, Google sign-in, password reset with a 6-digit email code.
- **Profile and settings**: profile photo upload, workspace name, change password, monitoring and log preferences, delete request logs.
- **Dark and light themes**, responsive down to Android / mobile browsers.

## Tech stack

React, TypeScript, Vite, framer-motion, lucide-react, axios, recharts, Google Sign-In (`@react-oauth/google`). Package manager: **pnpm**.

## Getting started

### Prerequisites

- Node.js (LTS)
- pnpm through corepack (use `corepack pnpm ...`; plain `npm install` fails on the engines check)
- The EasyAPI backend running (see the **EasyAPI-Backend** repository)

### Clone

```bash
git clone https://github.com/aditya79373/EasyAPI-Frontend.git
cd EasyAPI-Frontend
```

### Install and run

The app lives in `frontend/artifacts/EasyAPI`. The dev server needs two environment variables, `PORT` and `BASE_PATH`.

**Windows (PowerShell)**, from the project root:

```powershell
corepack pnpm install
cd frontend\artifacts\EasyAPI
$env:PORT = "5173"
$env:BASE_PATH = "/"
corepack pnpm dev
```

**macOS / Linux**, from the project root:

```bash
corepack pnpm install
cd frontend/artifacts/EasyAPI
PORT=5173 BASE_PATH=/ corepack pnpm dev
```

Open http://localhost:5173.

### Environment variables

Create a `.env` file in `frontend/artifacts/EasyAPI`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

`VITE_GOOGLE_CLIENT_ID` must be the same Google client ID the backend uses (`GOOGLE_CLIENT_ID`).

Two more variables are set in the terminal when you run the dev server (see above):

| Variable | Purpose |
| --- | --- |
| `PORT` | Port for the Vite dev server (`5173`) |
| `BASE_PATH` | Base path the app is served from (`/`) |

Never commit `.env` files. For production, point the app at your deployed backend URL (for example your Render service).

### Build

```powershell
cd frontend\artifacts\EasyAPI
$env:PORT = "5173"
$env:BASE_PATH = "/"
corepack pnpm build
```

## How workspace sharing works

- When you view someone else's workspace, every request carries an `x-workspace` header.
- The backend resolves it to the workspace owner, returns **their** data, and marks the session as **Viewer**.
- A Viewer cannot create, edit, delete or invite. Any attempt shows a "View only" popup.
- Use **My Dashboard** on the Team page to switch back to your own workspace.

## Notes

- The API tester sends requests straight from the browser, so the target API must allow it through CORS. A CORS failure is an access-policy error, not necessarily an outage.
- Do not commit `.env` files.