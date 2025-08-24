from __future__ import annotations

from decimal import Decimal
from django.contrib.auth import get_user_model
from django.utils.text import slugify
from django.utils.crypto import get_random_string
from rest_framework.test import APIClient
from oscar.core.loading import get_model


ProductClass = get_model("catalogue", "ProductClass")
Category = get_model("catalogue", "Category")
Product = get_model("catalogue", "Product")
Partner = get_model("partner", "Partner")
StockRecord = get_model("partner", "StockRecord")
DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
OrganizedEvent = get_model("event", "OrganizedEvent")


def create_user(email="user@example.com", password="Passw0rd!", **kwargs):
    User = get_user_model()
    user, _ = User.objects.get_or_create(email=email, defaults={
        "username": email,
        "first_name": kwargs.get("first_name", "Test"),
        "last_name": kwargs.get("last_name", "User"),
    })
    user.set_password(password)
    user.save()
    return user


def auth_client(client: APIClient, email="user@example.com", password="Passw0rd!") -> APIClient:
    # Register or ensure user exists, then get token
    create_user(email=email, password=password)
    resp = client.post("/api/v1/auth/token/", {"email": email, "password": password}, format="json")
    assert resp.status_code == 200, resp.data
    token = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def create_shipping_method(code: str = None, price: Decimal = Decimal("0.00"), is_self_collect: bool = True):
    code = code or f"SM-{get_random_string(6)}"
    return DynamicShippingMethod._default_manager.create(
        name=f"Shipping {code}",
        code=code,
        price=price,
        is_self_collect=is_self_collect,
        active=True,
        available_to_public=True,
    )


def create_product(title: str = None, price: Decimal = Decimal("10.00"), num_in_stock: int = 10) -> Product:
    title = title or f"Widget {get_random_string(6)}"
    pclass, _ = ProductClass._default_manager.get_or_create(name="Standard")
    product = Product._default_manager.create(
        title=title,
        slug=slugify(title),
        is_public=True,
        product_class=pclass,
    )
    partner, _ = Partner._default_manager.get_or_create(name="Default Partner")
    StockRecord._default_manager.create(
        product=product,
        partner=partner,
        partner_sku=f"SKU-{get_random_string(8)}",
        price=price,
        num_in_stock=num_in_stock,
        price_currency="SGD",
    )
    return product


def create_event(**kwargs):
    data = {
        "title": kwargs.get("title", f"Event {get_random_string(6)}"),
        "description": kwargs.get("description", "Test event"),
        "start_date": kwargs.get("start_date"),
        "end_date": kwargs.get("end_date"),
        "location": kwargs.get("location", "HQ"),
        "max_participants": kwargs.get("max_participants", 50),
        "is_active": kwargs.get("is_active", True),
    }
    # Minimal datetime values
    from django.utils import timezone
    if data["start_date"] is None:
        data["start_date"] = timezone.now() + timezone.timedelta(days=1)
    return OrganizedEvent._default_manager.create(**data)
