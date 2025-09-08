from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth.password_validation import validate_password

from apps.api.serializers import UserSerializer


User = get_user_model()


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        if not email or not password:
            return Response(
                {"detail": "email and password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if User.objects.filter(email__iexact=email).exists():
            return Response(
                {"detail": "Email already registered"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_password(password)
        except Exception as e:
            return Response(
                {"detail": " ".join([str(i) for i in e])},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        user.first_name = request.data.get("first_name", user.first_name)
        user.last_name = request.data.get("last_name", user.last_name)
        user.save(update_fields=["first_name", "last_name"])
        return Response(UserSerializer(user).data)


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Use email instead of username
    username_field = "email"


class EmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailTokenObtainPairSerializer


class PasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip()
        redirect_base = request.data.get(
            "redirect_base_url"
        )  # e.g., https://app.example/reset
        if not email:
            return Response(
                {"detail": "email is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Do not reveal whether the email exists
            return Response({"sent": True})

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        if redirect_base:
            link = f"{redirect_base}?uid={uid}&token={token}"
            subject = "Password reset requested"
            body = (
                "You requested a password reset.\n\n"
                f"Reset your password using this link: {link}\n\n"
                "If you didn’t request this, you can ignore this email."
            )
            try:
                send_mail(
                    subject,
                    body,
                    settings.DEFAULT_FROM_EMAIL,
                    [user.email],
                    fail_silently=True,
                )
            except Exception:
                pass

        # Always return success to avoid probing
        return Response({"sent": True})


class PasswordResetConfirmView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        uid = request.data.get("uid")
        token = request.data.get("token")
        new_password = request.data.get("new_password")

        if not uid or not token or not new_password:
            return Response(
                {"detail": "uid, token, and new_password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except Exception:
            return Response(
                {"detail": "Invalid uid"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {"detail": "Invalid or expired token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_password(new_password, user)
        except Exception as e:
            return Response(
                {"detail": " ".join([str(i) for i in e])},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"success": True})
