from rest_framework.permissions import BasePermission, SAFE_METHODS


def get_role(user):
    """Safely read a user's role, defaulting to 'student' if no profile exists yet."""
    profile = getattr(user, "profile", None)
    return profile.role if profile else "student"


class IsLibrarianOrAdmin(BasePermission):
    """
    Everyone can read (GET). Only Librarians and Admins can write
    (create/update/delete books, issue/return loans, etc).
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(
            request.user
            and request.user.is_authenticated
            and get_role(request.user) in ("librarian", "admin")
        )


class IsLibrarianOrAdminOnly(BasePermission):
    """Used for endpoints that only Librarians/Admins should access at all,
    even for reading (e.g. viewing every loan in the system)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_role(request.user) in ("librarian", "admin")
        )


class IsAdminOnly(BasePermission):
    """Used for Admin-only actions, like managing staff accounts."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and get_role(request.user) == "admin"
        )
