# Meal Direct — Customer App

Customer PWA for scheduled campus food delivery. React 19 + Vite frontend, Express
server that serves the SPA and exposes a cookie-backed BFF under `/api`.

## Architecture

- **Frontend**: React 19, Vite, Tailwind CSS v4, Motion, hash-based SPA routing.
- **Server** (`server.ts`): Express. Serves the built SPA, proxies `/api/v1/*` to the
  backend `/v1/*`, exposes a local `/api/nutrition` estimate and a `/healthz` probe.
  Auth tokens are held in HttpOnly cookies by the BFF; mutating `/api/v1` calls require
  the readable CSRF cookie to match `X-MealDirect-CSRF`. Hardened with `helmet` CSP,
  `compression`, `morgan`, and rate limiting on `/api`.
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

Checkout creates an order, initializes Paystack, stores a recoverable pending checkout
snapshot, and redirects to the hosted authorization URL. Payment truth comes from the
backend Paystack webhook; the app polls `/v1/orders/{orderId}/payment-status` through
the BFF on return and never marks an order paid optimistically.

## Notes / known gaps

- No customer-side order-cancel endpoint exists on the backend; cancellation help routes
  users to support escalation.
- Live E2E verification requires seeded backend credentials and Paystack test mode:
  `E2E_BASE_URL`, `E2E_CUSTOMER_EMAIL`, and `E2E_CUSTOMER_PASSWORD`.
- Sentry is disabled unless `VITE_SENTRY_DSN` is configured.
