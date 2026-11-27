from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

# NOTE: keep this module free of imports from rest_framework.views /
# simplejwt.views. settings.py loads this class at startup, and importing a
# view here would create a circular import. The login view lives in login.py.

SUSPENDED_MESSAGE = "This account has been suspended. Please contact the library administrator."


def is_suspended(user):
    profile = getattr(user, "profile", None)
    return bool(profile) and not profile.is_active_account


class ActiveAccountJWTAuthentication(JWTAuthentication):
    """
    Same as the normal JWT check, plus: a suspended account (Profile
    .is_active_account = False) is rejected on EVERY request, so suspending
    someone takes effect immediately even if they already hold a valid token.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if is_suspended(user):
            raise AuthenticationFailed(SUSPENDED_MESSAGE, code="account_suspended")
        return user
