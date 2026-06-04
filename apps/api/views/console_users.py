"""Superuser-only API for managing console group membership.

Lets a superuser assign users to the console access groups (Merch Sales,
Merch Management, Events). Superuser status itself is not editable here — it
stays managed via the Django admin.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.response import Response

from apps.api.permissions import CONSOLE_GROUPS, IsSuperuser
from apps.api.serializers import UserSerializer

User = get_user_model()


class ConsoleUsersViewSet(viewsets.ViewSet):
    """List console users and edit their console group membership."""

    permission_classes = [IsSuperuser]

    def list(self, request):
        search = (request.query_params.get("search") or "").strip()
        qs = User.objects.all().prefetch_related("groups").order_by("email")
        if search:
            qs = qs.filter(
                Q(email__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        else:
            # Default view: current console members only (anyone with a console
            # group or staff access), so the list is useful without searching.
            qs = qs.filter(
                Q(groups__name__in=CONSOLE_GROUPS) | Q(is_staff=True)
            ).distinct()
        return Response(UserSerializer(qs[:100], many=True).data)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        requested = request.data.get("groups")
        if not isinstance(requested, list):
            return Response(
                {"detail": "groups must be a list of group names"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invalid = [name for name in requested if name not in CONSOLE_GROUPS]
        if invalid:
            return Response(
                {"detail": f"Unknown group(s): {', '.join(map(str, invalid))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reconcile only the managed console groups; leave other groups alone.
        for name in CONSOLE_GROUPS:
            group, _ = Group.objects.get_or_create(name=name)
            if name in requested:
                user.groups.add(group)
            else:
                user.groups.remove(group)

        # Auto-manage console access: any console group implies is_staff.
        # Never downgrade a superuser.
        has_console_group = user.groups.filter(name__in=CONSOLE_GROUPS).exists()
        desired_staff = bool(has_console_group or user.is_superuser)
        if user.is_staff != desired_staff:
            user.is_staff = desired_staff
            user.save(update_fields=["is_staff"])

        return Response(UserSerializer(user).data)
