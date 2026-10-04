from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()


class EmailOrUsernameModelBackend(ModelBackend):
    """
    Allows login with either the username OR the email address, in the
    same "username" field the login form/API already sends. No frontend
    or JWT changes needed — this plugs into Django's normal auth() call
    that TokenObtainPairView already uses under the hood.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None

        try:
            user = User.objects.get(Q(username__iexact=username) | Q(email__iexact=username))
        except User.DoesNotExist:
            return None
        except User.MultipleObjectsReturned:
            # Extremely unlikely (would need a username matching someone
            # else's email) but handled safely just in case.
            user = (
                User.objects.filter(Q(username__iexact=username) | Q(email__iexact=username))
                .order_by("id")
                .first()
            )

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
