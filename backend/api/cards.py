"""Small helpers about a user's library-card state, shared by several views."""
from .models import LibraryCardApplication


def get_application(user):
    return LibraryCardApplication.objects.filter(user=user).first()


def has_active_card(user):
    """True only when the card is approved AND its fee has been paid."""
    app = get_application(user)
    return bool(app and app.is_active)
