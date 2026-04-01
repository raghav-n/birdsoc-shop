# BirdSoc SG Shop

An e-commerce platform for the Bird Society of Singapore, built with Django and React.

## Tech Stack

- **Backend**: Django 4.2, Django Oscar, Django REST Framework
- **Frontend**: React 18, Vite, styled-components
- **Database**: PostgreSQL (SQLite for development)
- **Payments**: PayNow (no payment gateway)
- **Other**: Redis, Sentry, WeasyPrint (PDF generation)

## Project Structure

```
apps/               # Django apps
  catalogue/        # Product catalog
  checkout/         # Checkout workflow
  cart/             # Shopping cart
  order/            # Order processing
  payment/          # Payment integrations
  shipping/         # Shipping calculations
  refund/           # Refund management
  offer/            # Promotions and offers
  customer/         # User management
  event/            # Event management
  dashboard/        # Admin dashboard
  api/              # REST API
  communication/    # Email and notifications
  util/             # Shared utilities
frontend/           # React frontend
  src/
    components/     # Reusable UI components
    pages/          # Page components
    context/        # React context (Auth, Cart, ShopConfig)
    utils/          # Helper utilities
    styles/         # Global styles
shop/               # Django project config (settings, urls)
```