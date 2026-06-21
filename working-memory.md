# Working Memory

## Problem Summary
- Production-readiness hardening for the Meal Direct customer PWA: backend contract alignment, cookie-backed BFF sessions, payment recovery, safer mutation state, CSP/Sentry/PWA hardening, and bundle health.

## Product Goal
- Make the customer app safe to deploy beyond beta by removing browser-readable auth tokens, matching the live backend API contract, preventing false payment/order success states, and improving observability and performance.

## Stack and Runtime
- React 19 + Vite SPA with hash routing.
- Express server serves the SPA and BFF routes.
- Tailwind CSS v4 styling.
- Hosted backend at `BACKEND_URL`, defaulting to `https://mealdirectbackend.onrender.com`.

## Confirmed Facts
- `npm run lint`, `npm test`, and `npm run build` pass after changes.
- Production smoke passed for `/healthz`, `/api/v1/health/ready`, `/`, CSP header presence, and CSP nonce replacement.
- Main bundle reduced from a prior 620 KB warning to 477.40 KB.

## Unknowns / Needs Confirmation
- Live seeded customer credentials and Paystack test-mode flow are not available in the workspace, so live E2E verification still needs external credentials/test data.

## Active Files / Surfaces
- `server.ts`, `src/store.tsx`, `src/App.tsx`, `src/main.tsx`, `index.html`, `public/sw.js`, profile/order/payment/notification/onboarding components, `src/utils/monitoring.ts`, and `src/__tests__/production-readiness.test.ts`.

## Decisions
- Browser API default is `/api/v1`; the Express BFF forwards to backend `/v1`.
- Auth tokens live in HttpOnly cookies managed by the BFF.
- Mutating `/api/v1` calls require `X-MealDirect-CSRF` to match the readable `md_csrf` cookie.
- Sentry initializes only when `VITE_SENTRY_DSN` is set.

## API Contracts
- `/api/auth/customer/login` and `/api/auth/customer/signup` proxy backend auth and strip tokens from JSON responses.
- `/api/auth/logout` clears session cookies.
- `/api/v1/*` proxies to `BACKEND_URL/v1/*`, refreshes once on `401`, and retries.
- `/v1/me` is mapped from backend session/profile envelope into the client `UserProfile`.

## Data Model
- No database schema changes in this frontend repo.
- Pending checkout snapshot is stored locally under `md_pending_checkout` after Paystack initialization succeeds.

## Auth and Security
- Removed frontend use of `md_access_token` and `md_refresh_token` localStorage values.
- Production Helmet CSP is enabled with a runtime nonce for the JSON-LD script.
- Service worker no longer caches API/auth/payment calls.

## UI System Notes
- Secondary routes are lazily loaded while auth, home, checkout, and order tracking stay on the fast path.
- Failed backend mutations now surface visible errors in onboarding, profile, order detail, and notifications flows.

## Bugs Fixed
- `/v1/me` session envelope mapping no longer corrupts client user state.
- Silent sync no longer sends `user.id` as a bearer token.
- Payment polling timeout now shows pending verification instead of cancelled.
- Cart is not cleared until Paystack initialization succeeds.
- Customer-side cancel now routes to support instead of faking local cancellation.

## Risks / Watchouts
- Live Paystack callback behavior still needs seeded-account verification.
- Backend `RegisterDeviceTokenDto` is empty in the current OpenAPI snapshot, so push token payload acceptance must be validated live.

## Next Actions
- Run live E2E with `E2E_BASE_URL`, `E2E_CUSTOMER_EMAIL`, `E2E_CUSTOMER_PASSWORD`, seeded inventory, and Paystack test mode.
