# Meal Direct — Customer App

Customer PWA for scheduled campus food delivery. React 19 + Vite frontend, Express
server that serves the SPA and proxies `/v1` to the hosted backend.

## Architecture

- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion, hash-based SPA routing.
- **Server** (`server.ts`): Express. Serves the built SPA, proxies `/v1/*` to the
  backend, exposes a local `/api/nutrition` estimate and a `/healthz` probe. Hardened
  with `helmet`, `compression`, `morgan`, and rate limiting on `/api`.
- **Backend**: external service (see `BACKEND_URL`). Authoritative for auth, catalog,
  pricing (`/v1/orders/quote`), orders, payments (Paystack), and notifications.

## Prerequisites

- Node.js 20+

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and adjust if needed:
   ```
   BACKEND_URL=https://mealdirectbackend.onrender.com
   PORT=3000
   ```

## Run

- Development (Vite middleware + HMR):
  ```
  npm run dev
  ```
- Production build + serve:
  ```
  npm run build
  NODE_ENV=production npm start
  ```

App runs at `http://localhost:3000`.

## Scripts

| Script          | Purpose                                  |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Dev server (Express + Vite middleware)   |
| `npm run build` | Build SPA + bundle server to `dist/`     |
| `npm start`     | Serve the production build               |
| `npm run lint`  | Type-check (`tsc --noEmit`)              |
| `npm test`      | Run unit tests (Vitest)                  |

## Payments

Checkout creates an order, initializes Paystack, and redirects to the hosted
authorization URL. Payment truth comes from the backend Paystack webhook; the app
polls `/v1/orders/{orderId}/payment-status` on return and never marks an order paid
optimistically.

## Notes / known gaps

- No customer-side order-cancel endpoint exists on the backend; cancellation is
  handled by admin/support.
- Promotions (`/v1/promotions/validate`) are not yet surfaced in checkout UI.
- Push notifications (`/v1/me/device-tokens`) are not yet wired; status updates use
  polling.
