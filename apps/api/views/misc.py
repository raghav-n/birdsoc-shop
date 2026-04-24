from django.conf import settings
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions
from oscar.core.loading import get_model

from apps.home.models import ShopConfig


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({"status": "ok", "version": "v1"})


class ConfigView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        config = ShopConfig.get()
        return Response(
            {
                "shop_open": config.shop_open_public,
                "shop_open_internal": config.shop_open,
                "close_datetime": config.close_datetime.isoformat() if config.close_datetime else None,
                "currency": settings.OSCAR_DEFAULT_CURRENCY,
                "shop_name": settings.OSCAR_SHOP_NAME,
                "static_base_url": getattr(settings, "OSCAR_STATIC_BASE_URL", ""),
                "global_self_collection_required": settings.GLOBAL_SELF_COLLECTION_REQUIRED,
                "global_paynow_required": settings.GLOBAL_PAYNOW_REQUIRED,
            }
        )


class ShippingMethodsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        DynamicShippingMethod = get_model("shipping", "DynamicShippingMethod")
        qs = DynamicShippingMethod._default_manager.filter(
            active=True, available_to_public=True
        )
        self_collect = request.query_params.get("self_collect")
        if self_collect is not None:
            v = str(self_collect).lower() in ("true", "1", "yes")
            qs = qs.filter(is_self_collect=v)
        data = [
            {
                "code": m.code,
                "name": m.name,
                "description": m.description,
                "is_self_collect": m.is_self_collect,
                "price": str(m.price),
                "method_id": m.method_id,
                "website_faq_description": m.website_faq_description or "",
                "website_home_description": m.website_home_description or "",
            }
            for m in qs
        ]
        return Response(data)
