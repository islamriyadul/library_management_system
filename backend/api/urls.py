from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    BookViewSet, RegisterView, MeView,
    MyLoansView, AllLoansView, issue_book, return_book,
    StaffListCreateView, toggle_staff_active,
)

router = DefaultRouter()
router.register(r"books", BookViewSet, basename="book")

urlpatterns = [
    # Auth
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),

    # Loans / circulation
    path("loans/mine/", MyLoansView.as_view(), name="my-loans"),
    path("loans/all/", AllLoansView.as_view(), name="all-loans"),
    path("loans/issue/", issue_book, name="issue-book"),
    path("loans/<int:loan_id>/return/", return_book, name="return-book"),

    # Staff management (Admin only)
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("staff/<int:user_id>/toggle-active/", toggle_staff_active, name="staff-toggle-active"),
]

urlpatterns += router.urls
