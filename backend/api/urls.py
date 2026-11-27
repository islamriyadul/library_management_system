from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .login import ActiveAccountTokenObtainPairView

from .views import (
    BookViewSet, RegisterView, MeView,
    MyLoansView, AllLoansView, issue_book, return_book,
    StaffListCreateView, toggle_staff_active,
    VerificationQueueView, create_verification_request, resolve_verification_request,
    create_book_request, MyBookRequestsView, PendingBookRequestsView, resolve_book_request,
    cancel_book_request, mark_fine_paid,
)
from .card_views import (
    my_card, apply_for_card, download_card, list_applications, review_application,
    payment_summary, start_payment, confirm_payment_view,
)

router = DefaultRouter()
router.register(r"books", BookViewSet, basename="book")

urlpatterns = [
    # Auth
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", ActiveAccountTokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", MeView.as_view(), name="me"),

    # Loans / circulation
    path("loans/mine/", MyLoansView.as_view(), name="my-loans"),
    path("loans/all/", AllLoansView.as_view(), name="all-loans"),
    path("loans/issue/", issue_book, name="issue-book"),
    path("loans/<int:loan_id>/return/", return_book, name="return-book"),
    path("loans/<int:loan_id>/pay-fine/", mark_fine_paid, name="pay-fine"),

    # Staff management (Admin only)
    path("staff/", StaffListCreateView.as_view(), name="staff-list-create"),
    path("staff/<int:user_id>/toggle-active/", toggle_staff_active, name="staff-toggle-active"),

    # Circulation desk verification queue (Librarian/Admin only)
    path("verification/", VerificationQueueView.as_view(), name="verification-queue"),
    path("verification/create/", create_verification_request, name="verification-create"),
    path("verification/<int:request_id>/resolve/", resolve_verification_request, name="verification-resolve"),

    # Student self-service book requests
    path("book-requests/create/", create_book_request, name="book-request-create"),
    path("book-requests/mine/", MyBookRequestsView.as_view(), name="book-request-mine"),
    path("book-requests/pending/", PendingBookRequestsView.as_view(), name="book-request-pending"),
    path("book-requests/<int:request_id>/resolve/", resolve_book_request, name="book-request-resolve"),
    path("book-requests/<int:request_id>/cancel/", cancel_book_request, name="book-request-cancel"),

    # Library card
    path("library-card/", my_card, name="library-card"),
    path("library-card/apply/", apply_for_card, name="library-card-apply"),
    path("library-card/download/", download_card, name="library-card-download"),
    path("library-card/applications/", list_applications, name="library-card-applications"),
    path("library-card/applications/<int:application_id>/review/", review_application, name="library-card-review"),

    # Online payments (bKash / Nagad)
    path("payments/summary/", payment_summary, name="payment-summary"),
    path("payments/create/", start_payment, name="payment-create"),
    path("payments/<int:payment_id>/confirm/", confirm_payment_view, name="payment-confirm"),
]

urlpatterns += router.urls
