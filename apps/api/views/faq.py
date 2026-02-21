from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions

from apps.faq.models import FAQItem
from apps.api.serializers import FAQItemSerializer


class FAQListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        items = FAQItem.objects.filter(is_active=True)
        serializer = FAQItemSerializer(items, many=True)
        return Response(serializer.data)
