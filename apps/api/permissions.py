from rest_framework import permissions

# Console access groups. Merch Management is a superset of Merch Sales:
# anyone in Merch Management implicitly has Merch Sales access too.
GROUP_MERCH_SALES = "Merch Sales"
GROUP_MERCH_MANAGEMENT = "Merch Management"
GROUP_EVENTS = "Events"

# Groups a superuser may assign via the user-management console.
CONSOLE_GROUPS = (GROUP_MERCH_SALES, GROUP_MERCH_MANAGEMENT, GROUP_EVENTS)


def _user_in_group(user, group_name: str) -> bool:
    return user.groups.filter(name=group_name).exists()


class IsSuperuser(permissions.BasePermission):
    """Allow access to superusers only (DRF's IsAdminUser only checks is_staff)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )


class IsEventsStaff(permissions.BasePermission):
    """Allow access to users in the 'Events' group, or superusers."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_superuser or _user_in_group(request.user, GROUP_EVENTS))
        )


class IsMerchSalesStaff(permissions.BasePermission):
    """Allow merch sales access: superusers, 'Merch Sales', or 'Merch Management'."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or _user_in_group(request.user, GROUP_MERCH_SALES)
                or _user_in_group(request.user, GROUP_MERCH_MANAGEMENT)
            )
        )


class IsMerchManagementStaff(permissions.BasePermission):
    """Allow merch analytics/management access: superusers or 'Merch Management'."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.is_superuser
                or _user_in_group(request.user, GROUP_MERCH_MANAGEMENT)
            )
        )
