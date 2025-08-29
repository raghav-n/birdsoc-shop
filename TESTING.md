Backend API Testing

Overview

- The API includes comprehensive tests covering auth, catalogue, shipping, baskets, checkout (PayNow), orders, refunds, and events.
- Tests are built with Django’s test runner and Django REST Framework’s `APITestCase`.

Prerequisites

- Python deps installed: `pip install -r requirements.txt`.
- PostgreSQL credentials set in `.env` or environment (see `shop/settings.py` for `DB_USER`/`DB_PASS`).
- Optional: WeasyPrint system deps (for PDF receipts). If not available, the receipt test is skipped.

Running tests

- Full suite: `python manage.py test`
- API-only: `python manage.py test apps.api`

What’s covered

- Health/config endpoints.
- Auth: register, token (email+password), me, password reset (request+confirm).
- Catalogue: list and retrieve by id or slug.
- Shipping: dynamic shipping method listing.
- Basket: create guest basket, add/update/delete lines, apply invalid voucher, merge guest → user.
- Checkout: PayNow proof upload + place order end-to-end (self-collect default).
- Orders: list user’s orders; receipt endpoint (skipped if WeasyPrint missing).
- Refunds: create request; owner/staff access to detail.
- Events: basic registration and duplicate prevention.

Notes

- Tests create real Oscar models (products, stock records, shipping methods, etc.) against the test DB.
- Receipt generation writes PDFs to `receipts/` under the project directory; the folder exists in the repo.

