from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from oscar.core.loading import get_model

from apps.api.serializers import RefundRequestSerializer


RefundRequest = get_model("refund", "RefundRequest")


class RefundRequestCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = RefundRequestSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        refund = ser.save()
        return Response(
            RefundRequestSerializer(refund).data, status=status.HTTP_201_CREATED
        )


class RefundRequestDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk: int):
        try:
            refund = RefundRequest._default_manager.get(pk=pk)
        except RefundRequest.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        # Allow staff, or the user whose email matches the refund email
        if not request.user.is_staff:
            if (
                not request.user.email
                or request.user.email.lower() != refund.email.lower()
            ):
                return Response(
                    {"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN
                )

        return Response(RefundRequestSerializer(refund).data)
