from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions

from apps.banner.models import BannerImage, TextBanner


class BannerListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = BannerImage.objects.all()
        banner_type = request.query_params.get("type")
        if banner_type == "product":
            qs = qs.filter(show_on_product=True)
        elif banner_type == "event":
            qs = qs.filter(show_on_event=True)
        data = [
            {
                "id": b.id,
                "image": request.build_absolute_uri(b.image.url),
                "show_on_product": b.show_on_product,
                "show_on_event": b.show_on_event,
                "order": b.order,
            }
            for b in qs
        ]
        return Response(data)


class TextBannerView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        try:
            banner = TextBanner.objects.get(pk=1, is_active=True)
            return Response({"text": banner.text, "is_active": True})
        except TextBanner.DoesNotExist:
            return Response({"text": None, "is_active": False})
