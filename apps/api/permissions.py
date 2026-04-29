from rest_framework import permissions


def _user_in_group(user, group_name: str) -> bool:
    return user.groups.filter(name=group_name).exists()


class IsEventsStaff(permissions.BasePermission):
    """Allow access to users in the 'Events' group, or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or _user_in_group(request.user, "Events"))
        )


class IsMerchandiseStaff(permissions.BasePermission):
    """Allow access to users in the 'Merchandise' group, or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or _user_in_group(request.user, "Merchandise")
            )
        )
