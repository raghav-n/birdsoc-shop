from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions

from apps.event.utils import get_global_registration_closed


class RegistrationStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response(
            {"global_registration_closed": get_global_registration_closed()}
        )
