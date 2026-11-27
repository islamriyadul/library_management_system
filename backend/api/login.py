from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .authentication import SUSPENDED_MESSAGE, is_suspended


class ActiveAccountTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Refuse to issue tokens to a suspended account at login time."""

    def validate(self, attrs):
        data = super().validate(attrs)  # raises normally on bad credentials
        if is_suspended(self.user):
            raise AuthenticationFailed(SUSPENDED_MESSAGE, code="account_suspended")
        return data


class ActiveAccountTokenObtainPairView(TokenObtainPairView):
    serializer_class = ActiveAccountTokenObtainPairSerializer
