# Meal Direct Mobile App — Web-Parity Build Instructions

## Objective

Build the iOS and Android customer app so it is functionally, visually, and behaviorally consistent with the existing Meal Direct web app in this repository.

“100% consistent” means the mobile app must preserve:

- The same customer journeys, business rules, labels, status meanings, validation, and error recovery.
- The same API payloads and server-authoritative behavior.
- The same brand, spacing rhythm, typography hierarchy, component shapes, icons, feedback, and motion intent.
- The same loading, empty, offline, error, disabled, success, and permission-denied states.
- The same analytics/monitoring events and accessibility outcomes where the platforms support them.

Native platform controls may be used when they improve accessibility or reliability, but they must not change the product's information architecture or business behavior.

## Sources of truth

Do not rebuild from screenshots or memory. Read and continuously compare against these files:

| Concern | Web source of truth |
| --- | --- |
| Route guards and screen map | `src/App.tsx` |
| Global state, API mapping, persistence, and business rules | `src/store.tsx` |
| Domain types and status enums | `src/types.ts` |
| Design tokens and global interaction rules | `src/index.css` |
| Shared shell, navigation, cards, currency, banners, and modals | `src/components/CommonUI.tsx` |
| Individual screen behavior and exact copy | `src/components/*View.tsx`, `Receipt.tsx`, `ChatPanel.tsx` |
| Currency, slot availability, and spend calculations | `src/utils/helpers.ts` |
| Haptic intent | `src/utils/vibe.ts` |
| Payment launch behavior | `src/utils/paystackPopup.ts` |
| Monitoring behavior | `src/utils/monitoring.ts` |
| Backend-for-frontend authentication and proxy rules | `server.ts` |
| Runtime configuration | `.env.example` |
| PWA identity and app icons | `public/manifest.json`, `public/icon-*.png`, `public/logo.png` |
| Regression expectations | `src/__tests__/*.test.ts` |

If this guide and the web implementation disagree, the current web code is authoritative unless the product owner explicitly approves a cross-platform change.

## Recommended mobile stack

Use React Native with Expo and TypeScript. Recommended foundations:

- Expo Router or React Navigation for typed navigation and deep links.
- TanStack Query for server state; a small context or Zustand store for cart and UI state.
- Expo SecureStore for refresh/access credentials. Never store tokens in AsyncStorage.
- AsyncStorage or SQLite for non-sensitive cached data and resumable checkout state.
- Expo Notifications with the native Firebase/APNs credentials expected by the backend.
- Expo Haptics, Network, Image Picker, FileSystem, Sharing, Print, and WebBrowser as needed.
- Sentry React Native using the same release naming and environment conventions as the web app.
- Lucide React Native so icon shapes remain consistent with `lucide-react` on the web.

The exact libraries can change, but the observable product behavior cannot.

## Repository and package structure

Create the mobile project in a separate top-level directory such as `mobile/`. Do not copy business rules into unrelated screen components.

Suggested structure:

```text
mobile/
  app/                         # routes/screens
  src/
    api/                       # transport, auth refresh, DTO mapping
    components/                # shared visual primitives
    design/                    # tokens, typography, shadows, motion
    domain/                    # shared enums/types and pure business rules
    features/                  # auth, catalog, cart, checkout, orders, etc.
    navigation/                # guards, deep-link configuration
    persistence/               # SecureStore/AsyncStorage adapters
    notifications/             # registration and notification routing
    monitoring/                # Sentry and structured diagnostics
  assets/                      # copied/exported canonical brand assets
  tests/
```

Prefer extracting framework-neutral types, DTO mappers, constants, and pure calculations into a shared workspace package used by both web and mobile. At minimum, share or mechanically synchronize:

- `OrderStatus`, payment types, cart/order/catalog interfaces, and escalation categories.
- Order status normalization and payment-confirmation rules.
- Currency formatting and integer-kobo handling.
- Slot availability rules.
- Quote/order payload construction and validation.
- Referral-code normalization and validation.
- Avatar MIME type and 2 MB limit.

## Design system parity

### Color tokens

Use these exact canonical values from `src/index.css`:

| Token | Value | Use |
| --- | --- | --- |
| Emerald deep | `#0B6B4F` | Primary actions and active navigation |
| Emerald strong | `#074C39` | Strong headings and pressed/dark primary states |
| Mango warm | `#F3B33D` | Accent, badges, highlights |
| Ink deep | `#10231C` | Primary text and dark surfaces |
| Muted grey | `#617069` | Secondary text |
| Canvas ivory | `#F7F8F4` | App background |
| Surface white | `#FFFFFF` | Cards and input surfaces |
| Surface 50 | `#FAFAFA` | Subtle secondary surfaces |
| Surface 100 | `#F5F5F5` | Pressed/grouped surfaces |
| Success | `#16845B` | Successful states |
| Warning | `#B96A05` | Warning states |
| Danger | `#B42318` | Destructive/error states |
| Info | `#2764C5` | Informational states |

Do not use approximate platform-default greens or yellows.

### Typography

- Body/UI: Inter, weights 300–700.
- Display/headings: Space Grotesk, weights 500–700; use the visually equivalent heavy weight for existing `font-black` headings.
- Money, references, codes, and tabular figures: JetBrains Mono with tabular numerals.
- Preserve the web hierarchy: compact uppercase eyebrow labels, bold display headings, small muted descriptions, and highly legible action labels.
- Bundle fonts in the app; do not depend on runtime Google Fonts availability.

### Shape, elevation, and glass

- Control radius: 10 px.
- Large control radius: 14 px.
- Standard card radius: 20 px.
- Glass/hero panel radius: 24–28 px depending on the matching web component.
- Reproduce glass panels with a translucent white surface, subtle dark border, restrained shadow, and native blur where supported.
- When reduced transparency is enabled or blur is unavailable, use opaque white plus a visible subtle border.
- Keep shadows soft and low-opacity. Avoid Material default elevation that produces heavy grey shadows.

### Interaction and motion

- Tap targets must be at least 48 × 48 logical pixels.
- Buttons visually compress to approximately 96% while pressed.
- Screen transitions use a 200 ms ease-out fade with slight vertical movement: incoming from +15 px, outgoing to −15 px.
- Honor the operating system's Reduce Motion and Reduce Transparency settings.
- Use skeleton shimmer for loading collections and cards; do not replace established skeleton states with a full-screen spinner.
- Map web vibration intent to native haptics: selection/tick, medium impact, success notification, confirmation impact, and error notification.
- Preserve safe-area padding at the header and bottom navigation.

## Navigation and route guards

Implement the same guard order as `src/App.tsx`:

1. A password-recovery deep link always opens the new-password flow.
2. An unauthenticated customer sees authentication.
3. An authenticated but incomplete customer sees onboarding.
4. An authenticated and onboarded customer enters the main app.

The mobile navigation map must cover:

| Web route | Mobile destination | Tab state |
| --- | --- | --- |
| `/`, `/home` | Home | Home |
| `/onboarding` | Onboarding | None |
| `/vendors` | Vendors | Vendors |
| `/vendors/:vendorId` | Vendor detail | Vendors |
| `/cart` | Cart and checkout | Cart |
| `/checkout` | Checkout compatibility route; current web delegates to cart | Cart |
| `/orders` | Orders | Orders |
| `/orders/:orderId` | Order detail | Orders |
| `/orders/:orderId?action=receipt` | Receipt | Orders |
| `/payment/status/:orderId` | Payment status | Orders |
| `/notifications` | Notifications | None |
| `/profile` | Profile | Profile |
| `/wallet` | Wallet | Profile |
| `/offline` | Offline information | None |

The persistent bottom navigation has exactly five items in this order: Home, Vendors, Cart, Orders, Profile. Show the cart quantity badge and notification unread badge using the same counting rules as the web app. Unknown links fall back to Home after guards run.

Register universal links/app links for authentication callbacks, referrals, payment returns, order details, and notification taps. A cold-start deep link must restore the intended destination after successful sign-in when that destination is safe to restore.

## Screen-by-screen parity requirements

### Authentication and password recovery

- Support sign in, sign up, email confirmation guidance, resend confirmation, forgot password, recovery-link handling, new password, completed, and expired-link states.
- Preserve exact form validation and friendly error copy from `AuthView.tsx` and `ResetPasswordView.tsx`.
- Retry an authentication request once only for a transient network failure; use a 20-second timeout per attempt as the web client does.
- Never reveal whether an email exists during password reset or confirmation resend.

### Onboarding

- Require the same customer profile fields, campus selection, delivery location/default location, optional room details, and referral behavior.
- Load public campus locations and delivery slots before campus membership is complete.
- Do not mark onboarding complete locally until the backend confirms it and the refreshed `/me` session is mapped.

### Home

- Match greeting, campus/location/slot controls, featured vendor/meal sections, availability and “portions left” badges, favorites, cart actions, spending/nutrition information, refresh behavior, and all empty/loading states.
- Use the same current date/slot/location scoping when loading the catalog.

### Vendors and vendor detail

- Preserve search/filter/sort behavior, visibility filtering, ratings, preparation time, featured tags, availability, meal categories, favorites, and image fallbacks.
- A cart can contain items from only one vendor. Replacing a different vendor's cart requires the same explicit confirmation behavior.
- Items marked `requiresSoup` require exactly one active soup selection before being added.
- Sold-out items cannot be added; low stock is five portions or fewer.

### Cart and checkout

- Persist display snapshots (`name`, `priceKobo`, `imageUrl`, and soup data) with cart lines so cached cart rows remain visible when the live catalog is unavailable.
- Require date, slot, delivery location, and all current order inputs.
- A same-day slot is available only if it is at least 60 minutes in the future. Future-day slots are available; past-day slots are not.
- Generate a new idempotency key for order creation/payment initialization and prevent concurrent checkout submissions.
- Fetch `POST /orders/quote`; the backend quote is the only pricing authority.
- Show food subtotal, delivery fee, service/takeaway fee, discount, large-order surcharge, and total exactly as returned.
- Never recalculate or silently remove `largeOrderSurchargeKobo`; it is already included in `totalKobo`.
- Require the existing explicit surcharge acceptance when the backend says it is necessary.
- Support both wallet and Paystack. Wallet orders become paid only through the backend's create-order response. Paystack orders remain pending until verified.
- Keep checkout disabled offline and surface a visible recovery path.

### Paystack payment status

- Initialize Paystack through the backend and launch a secure native browser/session or approved native SDK. Preserve hosted checkout as the fallback.
- Save a recoverable pending-checkout snapshot before leaving the app, then clear the active cart as the web app does.
- On success, cancellation, app restart, or deep-link return, open the payment-status screen for the order.
- Poll `GET /orders/:orderId/payment-status` using the same terminal-state rules defined by `mapPaymentStatus` and `derivePaymentPollingState` in `src/store.tsx`.
- Payment truth comes only from the backend webhook/verification response. Never mark an order paid based on the browser/SDK success callback alone.
- Restore the backed-up cart after a failed or cancelled payment when the existing web flow offers restoration.

### Orders, tracking, receipt, chat, reviews, and support

- Preserve all `OrderStatus` values and mappings from `src/types.ts` and `src/store.tsx`; do not collapse statuses for convenience.
- Match active/history filtering, order cards, timeline, delivery handoff code, live tracker, delivered animation, reorder behavior, receipt, share/save behavior, and polling/refresh behavior.
- Batch chat loads the latest 50 messages and posts messages through the same batch endpoints.
- Preserve escalation categories and backend submission. Customer cancellation is not available; route cancellation help to support as the web app does.
- Allow the same order and menu-item review flows with the same eligibility rules.
- Receipts must use integer kobo data, NGN formatting, tabular figures, payment reference, status, fee breakdown, vendor, campus, location, slot, and soup selections.

### Notifications

- Match the inbox list, unread count, mark-one-read, mark-all-read, order routing, foreground toast, and in-app dispatch alert.
- Register the native device token at `POST /me/device-tokens` with the correct native platform value, then enable `pushEnabled` using the preferences endpoint.
- On disable/sign-out, unregister the token both locally and from the backend.
- A notification tap must route to its order when `orderId` is present.
- Polling remains a fallback when permission is denied or token registration fails.

### Wallet and profile

- Match balance, advisory limits, ledger ordering, dedicated-account provisioning/retry, wallet payment selection, and all zero/loading/error states.
- Match profile editing, default location, room number, avatar validation/upload, saved locations, favorites, referrals, notification preferences, legal/support links, and sign-out cleanup.
- Avatar files must be JPEG, PNG, or WebP and no larger than 2 MB.

### Offline behavior

- Observe real network state and show the same connected/offline messaging intent.
- Cached browsing may continue, but order placement and payment must be blocked offline.
- Display the last successful sync time.
- Reconnect should refresh authoritative user, order, notification, and catalog state without duplicating writes.

## API and authentication contract

The web app uses a same-origin Express BFF:

- `/api/auth/*` sets HttpOnly access/refresh cookies.
- `/api/v1/*` reads those cookies, refreshes access when needed, and requires matching `md_csrf` cookie and `X-MealDirect-CSRF` header on mutations.
- `/api/public/*` exposes a strict unauthenticated catalog allowlist.

A native app cannot rely on browser same-origin cookies or JavaScript-readable CSRF cookies. Before mobile implementation, add and document a mobile-safe backend contract. The preferred contract is:

1. Native customer login/signup returns access and refresh credentials only to the authenticated native client over TLS.
2. Store credentials in iOS Keychain/Android Keystore through SecureStore.
3. Send `Authorization: Bearer <accessToken>` to authenticated `/v1` requests.
4. Refresh through `/v1/auth/refresh`, rotate refresh credentials, and retry the original request once.
5. Clear credentials and protected caches after unrecoverable 401 or sign-out.
6. Keep CSRF protection for cookie-based web sessions; bearer-authenticated native calls do not use the browser double-submit CSRF flow.
7. Enforce customer-portal role checks server-side for both platforms.

Do not embed long-lived API secrets, service-role keys, Paystack secret keys, or Firebase server credentials in the mobile binary.

### Required endpoint coverage

Generate a typed API client from a backend OpenAPI schema if available. Otherwise, capture request and response fixtures from the web mappers and cover at least:

- Customer authentication, password recovery, session/profile, onboarding, avatar, and default location.
- Campuses, campus locations, campus delivery slots, vendor discovery, vendor detail, and menus.
- Quote, promotion validation, create order, list/detail orders, payment initialization, payment status, reviews, and escalations.
- Wallet, wallet ledger, and dedicated-account provisioning.
- Notifications, notification preferences, device-token registration/removal, and read states.
- Batch chat message list/send.
- Referral profile and redemption.

Use the same envelope unwrapping behavior: when a JSON object contains `data` and is not an authentication token response, consume `data` as the payload.

## Persistence and synchronization

Persist only what is required for continuity:

- Secure storage: access/refresh credentials.
- Durable local storage: cart, pending checkout, checkout cart backup, onboarding draft, favorites, saved locations, and pending referral/deep-link destination.
- Cache with timestamps: catalog, orders, notifications, wallet, and profile snapshots.

Do not treat cached orders, prices, stock, wallet balance, notifications, or payment states as authoritative. Refresh them after authentication, app foregrounding, reconnection, pull-to-refresh, payment return, and relevant push notifications.

Use account-scoped storage keys. On sign-out, remove every previous customer's protected/cache data, pending payment information, device token, favorites, saved locations, reviews, and onboarding draft.

## Error handling and accessibility

- Preserve backend error `status`, `code`, and `details`; wallet insufficient-funds errors may include `details.shortfallKobo`.
- Display actionable network, validation, session-expired, stock, quote, surcharge, wallet, and payment errors in the same context as the web app.
- Critical action errors use a centered modal; background refresh failures use non-blocking messaging and retain safe cached content.
- Every icon-only control needs an accessible label.
- Maintain logical focus order, screen-reader headings, selected/disabled state announcements, dynamic badge announcements, and sufficient contrast.
- Announce important asynchronous changes such as item added, quote changed, payment confirmed, order status advanced, and offline/online transitions.
- Support dynamic text without truncating critical values or actions. Money, order numbers, payment references, and delivery codes must remain selectable/readable.

## Platform configuration

Configure separate development, staging, and production builds. Runtime configuration should include:

- Public backend/API base URL.
- Sentry DSN, environment, sample rate, and release.
- Firebase Android/iOS configuration files and APNs setup.
- Universal-link/app-link domains and custom scheme fallback.
- Paystack public configuration if the chosen integration requires it; secrets remain server-side.
- Privacy manifest/permission descriptions for notifications, photos/camera, and any other capability actually used.

Use the canonical icons and logo from `public/`, but generate platform-specific adaptive, monochrome, notification, and splash assets from the approved originals. The app name is **Meal Direct** and the product surface is the **Customer** app.

## Implementation sequence

1. Freeze a parity baseline by recording every current web screen/state at representative phone widths and saving API fixtures.
2. Extract/share domain types, status mapping, validation, and formatting tests.
3. Agree on and implement the native authentication/refresh contract.
4. Build tokens, fonts, shared primitives, app shell, route guards, and deep links.
5. Implement auth and onboarding.
6. Implement catalog, vendors, vendor detail, cart, and quote.
7. Implement wallet and Paystack checkout, including restart/deep-link recovery.
8. Implement orders, status tracking, receipts, chat, escalation, review, and reorder.
9. Implement notifications, foreground alerts, profile, referrals, offline sync, and monitoring.
10. Run automated contract, unit, integration, accessibility, visual-regression, and real-device tests.
11. Complete the parity checklist below before store submission.

## Definition of done: parity checklist

The mobile app is not complete until all items pass on both iOS and Android:

- [ ] Every route and guard has a matching native destination and cold-start deep-link test.
- [ ] Every web screen has matching normal, loading, empty, offline, error, disabled, and success states.
- [ ] All visible copy matches the web source unless a platform-specific permission message is required.
- [ ] Brand colors, bundled fonts, radii, spacing, icon family, shadows, and motion are visually approved against reference captures.
- [ ] Cart quantities, vendor replacement, soup selection, stock limits, slot cutoff, promotion, surcharge, and quote behavior match.
- [ ] All money is integer kobo internally and formatted as `en-NG` NGN only at display boundaries.
- [ ] Order and payment status mappings pass the same fixtures as the web tests.
- [ ] Paystack success callbacks never mark payment paid without backend confirmation.
- [ ] Failed/cancelled/interrupted checkout can be recovered after process death.
- [ ] Wallet balance and ledger remain server-authoritative.
- [ ] Push permission grant, denial, token rotation, foreground receipt, background receipt, tap routing, disable, and sign-out cleanup pass.
- [ ] Offline browsing and reconnect refresh work; offline checkout is impossible.
- [ ] Secure storage, refresh rotation, 401 handling, account separation, and sign-out deletion pass a security review.
- [ ] Screen readers, large text, reduced motion, reduced transparency, contrast, focus, and 48 px tap targets pass accessibility checks.
- [ ] Visual regression covers at least one small phone and one large phone per platform.
- [ ] Contract tests run against staging and compare mobile DTO mapping with the web app's mappings.
- [ ] Real-device end-to-end tests cover sign-up/onboarding, ordering with Paystack, ordering with wallet, payment cancellation, status tracking, delivery handoff, receipt, review, escalation, chat, referral, profile update, and sign-out.
- [ ] Product/design approval confirms no unexplained parity exceptions remain.

## Parity exception process

If exact equivalence is impossible or harmful on a native platform, document it before implementation in a parity register with:

- Web behavior and source file.
- Proposed iOS and Android behavior.
- Reason for the difference.
- Accessibility, security, or platform requirement that justifies it.
- Product/design approval and acceptance test.

No undocumented deviation counts as “100% consistent.”
