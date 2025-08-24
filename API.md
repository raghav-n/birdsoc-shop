BirdSoc Shop API (v1)

Overview

- Purpose: Provide a stateless REST API so a separate frontend can consume shop features without Django templates.
- Stack: Django 4.2 + django-oscar, with Django REST Framework (DRF), Simple JWT, and CORS.
- Versioning: All endpoints under `/api/v1/` (keep existing `/api/verify-payment/`).
- Auth model: JWT for storefront users; session auth keeps working for Django dashboard.
- Payments: PayNow offline flow with proof upload and order eventing (already implemented in MVC). API mirrors this.
- Shipping: Dynamic shipping methods via `apps.shipping.models.DynamicShippingMethod`.

Key Principles

- Stateless JSON API, no CSRF for JWT requests. Session-only endpoints remain CSRF-protected.
- Preserve existing business rules: order numbers, donation top-up, shipping rules, payment events, receipts.
- Idempotent PUT/PATCH; safe GET; explicit behavior for guest carts via `cart_id`.

Implementation Plan

- Add packages: `djangorestframework`, `djangorestframework-simplejwt`, `django-cors-headers`, optionally `drf-spectacular` or `drf-yasg` for docs.
- Settings:
  - `INSTALLED_APPS += ['rest_framework', 'corsheaders']` (and `'drf_spectacular'` if used).
  - `MIDDLEWARE` add `corsheaders.middleware.CorsMiddleware` near top.
  - DRF config (example):
    - `DEFAULT_AUTHENTICATION_CLASSES`: `('rest_framework_simplejwt.authentication.JWTAuthentication',)`
    - `DEFAULT_PERMISSION_CLASSES`: `('rest_framework.permissions.AllowAny',)` globally; tighten per-view.
    - `DEFAULT_SCHEMA_CLASS`: `drf_spectacular.openapi.AutoSchema` (if used).
  - CORS: `CORS_ALLOW_CREDENTIALS = False`, `CORS_ALLOWED_ORIGINS = ['https://your-frontend.example']` (or `CORS_ALLOW_ALL_ORIGINS = False`).
  - JWT: Reuse `settings.JWT_SECRET` by configuring SimpleJWT with `SIGNING_KEY = JWT_SECRET` (or let it default to `SECRET_KEY`). Set `ACCESS_TOKEN_LIFETIME = 15m`, `REFRESH_TOKEN_LIFETIME = 7d`.
  - Add `/api/` to open URLs in `apps.util.middleware.LoginRequiredMiddleware` to avoid redirecting API traffic:
    - Either add `'OPEN_URLS += ["/api/"]'` in settings, or in middleware short-circuit when `request.path_info.startswith('/api/')`.
- URLs:
  - Create `shop/api_urls.py` and include it in `shop/urls.py` as `path('api/v1/', include('shop.api_urls'))` (keep `api/verify-payment/`).
- App structure: Create `apps/api/` with modules: `serializers.py`, `views/` (auth, catalogue, basket, checkout, orders, misc), `urls.py`, `permissions.py`.
- Reuse logic:
  - Extract PayNow placement logic from `apps.checkout.views.PaymentDetailsView` into a service function that the API calls (or implement equivalent using Oscar’s order placement mixins).
  - Use Oscar repositories/managers to ensure price, stock, availability, and shipping are authoritative.
- Storage: Use DRF `MultiPartParser` for `payment_proof` uploads (saved by `apps.payment.models.Source` upload handler).
- Throttling: Apply DRF throttles for auth and write endpoints.

Authentication

- JWT endpoints (Simple JWT):
  - POST `/api/v1/auth/token/` → issue access+refresh (email + password).
  - POST `/api/v1/auth/token/refresh/` → refresh access.
  - POST `/api/v1/auth/logout/` → optional, client-side token discard.
  - POST `/api/v1/auth/register/` → create account (email, password, first/last name).
  - GET `/api/v1/users/me/` → current user profile (requires JWT).
  - PATCH `/api/v1/users/me/` → update `first_name`, `last_name`.
- Passwords: add endpoints for password reset request and confirm (emails can reuse existing templates).
- Permissions:
  - Public: catalogue, shipping methods, config, cart read/write (guest via `cart_id`).
  - Authenticated: user’s orders, addresses, basket merge, checkout with saved addresses.

Error Model

- JSON errors: `{ "detail": "message", "code": "error_code" }`.
- 401 for missing/invalid JWT, 403 for permission, 400 for validation, 404 for not found, 409 for conflicts (e.g., stock insufficiency), 422 for domain validation.

Data Models (response shapes)

- Product: `{ id, upc, slug, title, description, is_public, price: { excl_tax, incl_tax, currency }, images: [{original, caption, display_order}], stock: { num_in_stock, low_stock_threshold, is_available }, attributes: [{name, code, type, value}], options: [{code, name, required}], categories: [{id, name, slug, path}] }`.
- Category: `{ id, name, slug, path, children: [...], product_count }`.
- ShippingMethod: `{ code, name, description, is_self_collect, price, method_id }`.
- Basket: `{ id, owner: {id,email} | null, status, total_excl_tax, total_incl_tax, currency, lines: [{ id, product_id, product_title, quantity, unit_price_incl_tax, line_price_incl_tax, options: [{code,value}] }] }`.
- Address: Oscar shipping address fields (name, line1.., postcode, etc.).
- Order: `{ number, status, date_placed, total_incl_tax, total_tax, donation_amount, total_incl_tax_with_donation, shipping_method: ShippingMethod, lines: [{ upc, title, quantity, unit_price_incl_tax, line_price_incl_tax }], sources: [{source_type, amount_debited, reference, payment_verified, payment_verified_on}], receipt_url? }`.
- RefundRequest: `{ id, status, name, email, paynow_phone, order_number, amount, reason, created_at }`.
- Event (optional public read): `{ id, title, description, start_date, end_date, location, is_active, participant_count, max_participants, is_full }`.

Endpoints

Public and Misc

- GET `/api/v1/health` → `{ status: "ok", version: "v1" }`.
- GET `/api/v1/config` → high-level flags and labels: `{ shop_open, currency, shop_name, static_base_url, global_self_collection_required, global_paynow_required }`.
- GET `/api/v1/shipping/methods` → list active `DynamicShippingMethod` available to public. Query: `self_collect=true|false`.

Auth

- POST `/api/v1/auth/token/` → body `{ email, password }`; returns `{ access, refresh, user: {id,email,first_name,last_name} }`.
- POST `/api/v1/auth/token/refresh/` → body `{ refresh }` → `{ access }`.
- POST `/api/v1/auth/register/` → body `{ email, password, first_name?, last_name? }` → 201 with `{ id, email }`.
- GET `/api/v1/users/me/` (JWT) → current user profile.
- PATCH `/api/v1/users/me/` (JWT) → update names.
- POST `/api/v1/auth/password/reset/` → `{ email }` (sends email).
- POST `/api/v1/auth/password/reset/confirm/` → `{ uid, token, new_password }`.

Catalogue

- GET `/api/v1/categories` → tree or flat list (query `flat=true`).
- GET `/api/v1/categories/{slug}`
- GET `/api/v1/products` → filters: `q`, `category`, `is_public`, `ordering=price|title|-price`, `page`, `page_size`.
- GET `/api/v1/products/{id|slug}` → single product with images, options, attributes, stock.
- GET `/api/v1/products/{id}/recommendations` (optional) → simple “also bought” via order lines.

Basket (Guest or Auth)

- POST `/api/v1/baskets` → create basket (guest). Returns `{ cart_id, basket }`.
- GET `/api/v1/baskets/current` → Resolve by precedence: `Authorization` user basket → header `X-Cart-Id` → query `cart_id`. Returns basket shape.
- POST `/api/v1/baskets/{basket_id}/lines` → `{ product_id, quantity, options? }` → 201 line + updated totals. Validations: stock, option requirements.
- PATCH `/api/v1/baskets/{basket_id}/lines/{line_id}` → `{ quantity }`.
- DELETE `/api/v1/baskets/{basket_id}/lines/{line_id}` → 204.
- POST `/api/v1/baskets/{basket_id}/apply-voucher` → `{ code }`.
- POST `/api/v1/baskets/merge` (JWT) → `{ source_cart_id }` → merges into user’s open basket.

Checkout

- POST `/api/v1/checkout/email` → `{ email }` to set `guest_email` on checkout session (required for anonymous checkout).
- GET `/api/v1/checkout/shipping-methods` → Reflects `GLOBAL_SELF_COLLECTION_REQUIRED`. If true, returns one self-collect method; otherwise, all active methods.
- POST `/api/v1/checkout/address` → Set shipping address when delivery is used. Body aligns with Oscar `ShippingAddress` fields.
- POST `/api/v1/checkout/payment/paynow-proof` (multipart) → fields: `basket_id`, `donation?` (int), `payment_proof` (image). Returns `{ reference, donation, total_with_donation }` and caches this data for order placement.
- POST `/api/v1/checkout/place-order` → Body: `{ basket_id, shipping_method_code?, donation? }`. Flow:
  - Calculate totals (+ donation).
  - Create `Source` with type `PayNow`, attach `payment_proof` (from prior step or same request multipart), set `amount_debited` to total.
  - Add `paynow-processing` event to all lines; place order; return `{ order }` with `number` and status `Pending payment confirmation`.

Orders (JWT)

- GET `/api/v1/orders` → current user’s orders, newest first.
- GET `/api/v1/orders/{number}` → details with lines, sources, receipt link.
- GET `/api/v1/orders/{number}/receipt` → application/pdf response (or `{pdf_base64}` if preferred). Authorization required: owner or staff.

Refunds

- POST `/api/v1/refunds` → create refund request. Body: `{ name, email, paynow_phone, order_number, amount, reason }`. Sends emails as per existing MVC.
- GET `/api/v1/refunds/{id}` (JWT, owner via email match or staff) → details.

Events (Optional public read)

- GET `/api/v1/events` → active upcoming events.
- GET `/api/v1/events/{id}` → details.
- POST `/api/v1/events/{id}/register` → `{ first_name, last_name, email, phone_number?, quantity }` creates `Participant` and links via `EventParticipant` (with capacity validation).

Payments: Auto-Verification Webhook (Already Present)

- POST `/api/verify-payment/` (unchanged path to avoid breaking integrations)
  - Headers: `Authorization: Bearer <JWT>` signed with `settings.JWT_SECRET` using HS256.
  - Payload: `{ order_number: string, amount: string }` where `amount` equals `order.total_incl_tax_with_donation`.
  - Behavior: Validates token and amount, sets status to `Payment automatically confirmed`, records `paynow-auto-verified` event, mirrors line quantities from `paynow-processing`. Idempotent if already verified.
  - Errors: 401 invalid token, 404 order missing, 400 amount mismatch or already verified.

Detailed Implementation Notes

- Serializers
  - Product: pull price via Oscar strategy (`Selector().strategy(...)`) to compute tax-inclusive prices; include stock via `StockRecord`.
  - Category: include children recursively when `?tree=true`.
  - Basket: serialize via `Basket.lines` and `Basket.total_excl_tax/incl_tax` using current strategy.
  - Order: expose `donation_amount` and computed totals via existing properties; include `shipping_method` via `Order.get_shipping_method()`.
- Views
  - Prefer DRF `ViewSet` + routers for CRUD-like resources (products, categories, baskets, orders), and APIViews for bespoke actions (place-order, apply-voucher, merge, paynow-proof).
  - Basket resolution helper: given request, resolve user basket or guest basket by `X-Cart-Id`/`cart_id`; create one if missing on POST to `/baskets`.
  - Checkout service: factor out logic from `apps.checkout.views.PaymentDetailsView` to a shared function:
    - Inputs: `request`, `basket`, `donation`, `payment_proof` file.
    - Creates `Source` (type `PayNow`), sets `amount_debited = basket.total_incl_tax + donation`.
    - Adds payment source and event `paynow-processing`.
    - Submits order via Oscar’s `OrderPlacementMixin` submission data (user, basket, shipping method/address, order_kwargs with `donation_amount`).
    - Returns `Order`.
- Shipping
  - Use `apps.shipping.Repository().get_available_shipping_methods(...)` and `DynamicShippingMethod.to_dict()` for shaping responses; expose `method_id` for UI display if needed.
  - When `GLOBAL_SELF_COLLECTION_REQUIRED` is true, set shipping method automatically.
- Security
  - Ensure `LoginRequiredMiddleware` doesn’t intercept `/api/*`.
  - JWT audience/issuer not required internally; keep token short-lived; use refresh flow.
  - Limit file uploads to images, size limit (e.g., 5 MB), and validate content-type.
  - Throttle endpoints: e.g., auth (5/min), cart line writes (60/min per IP), refund creation (3/hour per email/IP).
- Emails & Receipts
  - Keep existing `OrderDispatcher` behavior; API placement should trigger same events and attachments.
  - `/orders/{number}/receipt` can reuse `order.get_receipt_as_pdf()` and stream the bytes.

Routing Sketch (shop/api_urls.py)

- `router.register('products', ProductViewSet)`
- `router.register('categories', CategoryViewSet)`
- `router.register('orders', OrderViewSet, basename='orders')`
- Basket/checkout endpoints added with explicit `path()` for actions.

Minimal Code Changes (pseudocode snippets)

- settings.py
  - `INSTALLED_APPS += ['rest_framework','corsheaders']`
  - `MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', ...] + MIDDLEWARE`
  - `REST_FRAMEWORK = { 'DEFAULT_AUTHENTICATION_CLASSES': ('rest_framework_simplejwt.authentication.JWTAuthentication',), 'DEFAULT_PERMISSION_CLASSES': ('rest_framework.permissions.AllowAny',) }`
  - Add `/api/` to open URLs for `LoginRequiredMiddleware`.
- shop/urls.py
  - `path('api/v1/', include('shop.api_urls'))`
  - Keep `path('api/verify-payment/', verify_payment, name='verify-payment')`.
- apps/api/serializers.py
  - `ProductSerializer`, `CategorySerializer`, `BasketSerializer`, `BasketLineSerializer`, `OrderSerializer`, `ShippingMethodSerializer`, `RefundRequestSerializer`.
- apps/api/views/
  - `AuthViewSet`/SimpleJWT views, `CatalogueViewSet`s, `BasketViewSet` with line sub-actions, `CheckoutAPIView`s for email, address, shipping methods, paynow-proof, place-order, `OrdersViewSet`.
- apps/api/permissions.py
  - Owner checks for orders and refunds.
- apps/checkout/services.py (new)
  - Extract PayNow placement from `PaymentDetailsView` into a callable used by REST.

Examples

- Create guest basket
  - POST `/api/v1/baskets` → `{ cart_id: "b5b6c...", basket: {...} }`
- Add line to basket
  - POST `/api/v1/baskets/{id}/lines` body `{ product_id: 123, quantity: 2 }`
- Place order (multipart)
  - POST `/api/v1/checkout/place-order`
    - fields: `basket_id`, `donation=10`, `payment_proof=@screenshot.jpg`
    - response: `{ order: { number: "100234", status: "Pending payment confirmation" } }`

Frontend Considerations

- Send `Authorization: Bearer <access>` for logged-in calls.
- Persist `cart_id` client-side (localStorage) and send via `X-Cart-Id` header.
- Handle 401 by refreshing token; rethrow on failure.
- Use `/api/v1/config` to toggle UI for shipping and PayNow steps.

Testing Checklist

- Catalogue: product list/search, price accuracy, stock availability flags.
- Basket: add/update/remove, voucher application, totals recalc.
- Checkout: donation values reflected in `Order.donation_amount`, proof upload saved, source created, `paynow-processing` event set.
- Orders: PDF receipt returns, status pipeline transitions trigger emails.
- Webhook: `/api/verify-payment/` happy-path and idempotency.

Migration Path

- Stage 1: Add API alongside existing MVC pages; frontend continues to use server-side templates.
- Stage 2: Switch frontend to consume API piecemeal (catalogue first, then cart, then checkout).
- Stage 3: Remove template dependencies as pages migrate; keep Django dashboard and admin unchanged.

Notes on django-oscar-api (optional)

- You can adopt `django-oscar-api` to accelerate CRUD for products/basket/orders. If chosen, mount it under `/api/oscar/` and layer custom endpoints (donation, PayNow proof, dynamic shipping, refunds) on top. Ensure serializers match your donation/shipping/source extensions.

