from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, Loan, Profile, VerificationRequest, BookRequest, LOAN_PERIOD_DAYS
from .serializers import (
    BookSerializer, LoanSerializer, RegisterSerializer, UserSerializer,
    StaffSerializer, CreateStaffSerializer, VerificationRequestSerializer,
    BookRequestSerializer, UpdateMeSerializer,
)
from .permissions import IsLibrarianOrAdmin, IsLibrarianOrAdminOnly, IsAdminOnly, get_role


# ---------- Auth ----------

class RegisterView(generics.CreateAPIView):
    """Public signup. Always creates a Student account."""
    queryset = None
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        """
        Edit your own profile. See UpdateMeSerializer for the full writable
        field list (role-specific — Student/Librarian/Admin fields all live
        here, each role only fills in its own subset) and for why
        username/email/role are excluded.
        """
        serializer = UpdateMeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.update(request.user, serializer.validated_data)
        return Response(UserSerializer(request.user, context={"request": request}).data)


# ---------- Books ----------

class BookViewSet(viewsets.ModelViewSet):
    """
    GET  /api/books/       -> list (anyone logged in, supports ?search=&subject=)
    POST /api/books/       -> create (Librarian or Admin only)
    PUT/PATCH/DELETE       -> Librarian or Admin only
    """
    queryset = Book.objects.all().order_by("title")
    serializer_class = BookSerializer
    permission_classes = [IsLibrarianOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get("search")
        subject = self.request.query_params.get("subject")
        available_only = self.request.query_params.get("available")

        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(author__icontains=search)
                | Q(isbn__icontains=search)
            )
        if subject:
            qs = qs.filter(subject__icontains=subject)
        if available_only == "true":
            qs = qs.filter(available_copies__gt=0)
        return qs


# ---------- Loans / Circulation ----------

class MyLoansView(generics.ListAPIView):
    serializer_class = LoanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Loan.objects.filter(user=self.request.user).order_by("-issue_date")


class AllLoansView(generics.ListAPIView):
    """Librarian/Admin view of every loan in the system."""
    serializer_class = LoanSerializer
    permission_classes = [IsLibrarianOrAdminOnly]

    def get_queryset(self):
        qs = Loan.objects.all().order_by("-issue_date")
        status_param = self.request.query_params.get("status")
        if status_param == "active":
            qs = qs.filter(is_returned=False)
        elif status_param == "overdue":
            qs = qs.filter(is_returned=False, due_date__lt=timezone.now())
        return qs


MIN_LOAN_DAYS = 1
MAX_LOAN_DAYS = 90


def _clean_loan_days(raw_days):
    """
    Validates an optional librarian-chosen loan length. Returns
    (days, error_response). error_response is None when valid, so callers
    can do: days, err = _clean_loan_days(...); if err: return err
    """
    if raw_days in (None, ""):
        return LOAN_PERIOD_DAYS, None
    try:
        days = int(raw_days)
    except (TypeError, ValueError):
        return None, Response(
            {"detail": "days must be a whole number."}, status=status.HTTP_400_BAD_REQUEST
        )
    if not (MIN_LOAN_DAYS <= days <= MAX_LOAN_DAYS):
        return None, Response(
            {"detail": f"days must be between {MIN_LOAN_DAYS} and {MAX_LOAN_DAYS}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return days, None


def _issue_loan(book, student, days=None):
    """
    Shared core logic: decrement available copies, create the Loan.
    Caller is responsible for wrapping this in a transaction with the book
    row already locked via select_for_update(), and for checking
    available_copies >= 1 beforehand. Used by both the direct "Issue Book"
    endpoint and approving a student's book request.

    `days` overrides the default LOAN_PERIOD_DAYS — pass an already-validated
    int from _clean_loan_days(), or leave as None for the default period.
    """
    if days is None:
        days = LOAN_PERIOD_DAYS
    book.available_copies -= 1
    book.save()
    return Loan.objects.create(
        book=book,
        user=student,
        due_date=timezone.now() + timezone.timedelta(days=days),
    )


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def issue_book(request):
    book_id = request.data.get("book_id")
    username = request.data.get("username")

    if not book_id or not username:
        return Response(
            {"detail": "book_id and username are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    days, err = _clean_loan_days(request.data.get("days"))
    if err:
        return err

    try:
        student = User.objects.get(username__iexact=username)
    except User.DoesNotExist:
        return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)

    with transaction.atomic():
        try:
            book = Book.objects.select_for_update().get(id=book_id)
        except Book.DoesNotExist:
            return Response({"detail": "No such book."}, status=status.HTTP_404_NOT_FOUND)

        if book.available_copies < 1:
            return Response(
                {"detail": "No available copies of this book."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loan = _issue_loan(book, student, days=days)

    return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def return_book(request, loan_id):
    with transaction.atomic():
        try:
            loan = Loan.objects.select_for_update().get(id=loan_id)
        except Loan.DoesNotExist:
            return Response({"detail": "No such loan."}, status=status.HTTP_404_NOT_FOUND)

        if loan.is_returned:
            return Response(
                {"detail": "This loan was already returned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loan.mark_returned()

        book = loan.book
        book.available_copies += 1
        book.save()

    return Response(LoanSerializer(loan).data)


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def mark_fine_paid(request, loan_id):
    """Librarian confirms the student actually handed over the cash."""
    with transaction.atomic():
        try:
            loan = Loan.objects.select_for_update().get(id=loan_id)
        except Loan.DoesNotExist:
            return Response({"detail": "No such loan."}, status=status.HTTP_404_NOT_FOUND)

        if not loan.is_returned:
            return Response(
                {"detail": "This book hasn't been returned yet — nothing to pay."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if loan.fine_amount <= 0:
            return Response(
                {"detail": "This loan has no fine to pay."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if loan.fine_paid:
            return Response(
                {"detail": "This fine was already marked as paid."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loan.fine_paid = True
        loan.fine_paid_at = timezone.now()
        loan.fine_paid_by = request.user
        loan.save()

    return Response(LoanSerializer(loan).data)


# ---------- Staff management (Admin only) ----------

class StaffListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/staff/  -> list all Librarian + Admin accounts (Admin only)
    POST /api/staff/  -> create a new Librarian or Admin account (Admin only)
    """
    permission_classes = [IsAdminOnly]
    queryset = User.objects.filter(
        profile__role__in=[Profile.LIBRARIAN, Profile.ADMIN]
    ).order_by("username")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return CreateStaffSerializer
        return StaffSerializer


@api_view(["POST"])
@permission_classes([IsAdminOnly])
def toggle_staff_active(request, user_id):
    """Suspend or reinstate a librarian/admin account."""
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)

    if get_role(target) not in ("librarian", "admin"):
        return Response(
            {"detail": "This endpoint only manages staff accounts."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    profile = target.profile
    profile.is_active_account = not profile.is_active_account
    profile.save()

    return Response(StaffSerializer(target).data)


# ---------- Circulation desk verification queue (Librarian/Admin) ----------

class VerificationQueueView(generics.ListAPIView):
    """Pending walk-in check-ins waiting to be cleared at the desk."""
    permission_classes = [IsLibrarianOrAdminOnly]
    serializer_class = VerificationRequestSerializer

    def get_queryset(self):
        return VerificationRequest.objects.filter(
            status=VerificationRequest.PENDING
        ).order_by("-created_at")


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def create_verification_request(request):
    """Librarian logs a student's walk-in at the desk."""
    username = request.data.get("username")
    purpose = request.data.get("purpose")

    if not username or not purpose:
        return Response(
            {"detail": "username and purpose are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        student = User.objects.get(username__iexact=username)
    except User.DoesNotExist:
        return Response({"detail": "No such user."}, status=status.HTTP_404_NOT_FOUND)

    vr = VerificationRequest.objects.create(student=student, purpose=purpose)
    return Response(VerificationRequestSerializer(vr).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def resolve_verification_request(request, request_id):
    """Librarian clicks the checkmark (approve) or cross (reject)."""
    action = request.data.get("action")
    if action not in ("approve", "reject"):
        return Response(
            {"detail": "action must be 'approve' or 'reject'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        vr = VerificationRequest.objects.get(id=request_id)
    except VerificationRequest.DoesNotExist:
        return Response({"detail": "No such request."}, status=status.HTTP_404_NOT_FOUND)

    if vr.status != VerificationRequest.PENDING:
        return Response(
            {"detail": "This request was already resolved."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    vr.status = VerificationRequest.APPROVED if action == "approve" else VerificationRequest.REJECTED
    vr.resolved_by = request.user
    vr.resolved_at = timezone.now()
    vr.save()

    return Response(VerificationRequestSerializer(vr).data)


# ---------- Student self-service book requests ----------

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_book_request(request):
    """A student clicks 'Request to Borrow' on a book in the Catalog."""
    book_id = request.data.get("book")
    if not book_id:
        return Response({"detail": "book is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        book = Book.objects.get(id=book_id)
    except Book.DoesNotExist:
        return Response({"detail": "No such book."}, status=status.HTTP_404_NOT_FOUND)

    # Don't let a student pile up duplicate pending requests for the same book
    if BookRequest.objects.filter(
        student=request.user, book=book, status=BookRequest.PENDING
    ).exists():
        return Response(
            {"detail": "You already have a pending request for this book."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    br = BookRequest.objects.create(student=request.user, book=book)
    return Response(BookRequestSerializer(br).data, status=status.HTTP_201_CREATED)


class MyBookRequestsView(generics.ListAPIView):
    """A student's own request history/status."""
    permission_classes = [IsAuthenticated]
    serializer_class = BookRequestSerializer

    def get_queryset(self):
        return BookRequest.objects.filter(student=self.request.user).order_by("-requested_at")


class PendingBookRequestsView(generics.ListAPIView):
    """Librarian/Admin view of every request awaiting a decision."""
    permission_classes = [IsLibrarianOrAdminOnly]
    serializer_class = BookRequestSerializer

    def get_queryset(self):
        return BookRequest.objects.filter(status=BookRequest.PENDING).order_by("requested_at")


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def resolve_book_request(request, request_id):
    """Librarian approves (actually issues the loan) or rejects a request."""
    action = request.data.get("action")
    if action not in ("approve", "reject"):
        return Response(
            {"detail": "action must be 'approve' or 'reject'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Librarian can set/override the loan length here; the student never
    # chose one when requesting. Ignored entirely when rejecting.
    days, err = _clean_loan_days(request.data.get("days"))
    if err:
        return err

    # Everything happens in one transaction with the request row locked, so a
    # student cancelling at the same instant can't be silently overwritten
    # (and can't end up with both a cancelled request and an issued loan).
    with transaction.atomic():
        try:
            br = BookRequest.objects.select_for_update().get(id=request_id)
        except BookRequest.DoesNotExist:
            return Response({"detail": "No such request."}, status=status.HTTP_404_NOT_FOUND)

        if br.status == BookRequest.CANCELLED:
            return Response(
                {"detail": "The student cancelled this request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if br.status != BookRequest.PENDING:
            return Response(
                {"detail": "This request was already resolved."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if action == "reject":
            br.status = BookRequest.REJECTED
            br.resolved_by = request.user
            br.resolved_at = timezone.now()
            br.save()
            return Response(BookRequestSerializer(br).data)

        # Approve: actually issue the loan, same rules as the direct Issue
        # Book flow (must have a copy available), with the librarian's
        # chosen loan length (defaults to the standard period if omitted).
        book = Book.objects.select_for_update().get(id=br.book_id)
        if book.available_copies < 1:
            return Response(
                {"detail": "No available copies left — can't approve."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        loan = _issue_loan(book, br.student, days=days)
        br.status = BookRequest.APPROVED
        br.resolved_by = request.user
        br.resolved_at = timezone.now()
        br.resulting_loan = loan
        br.save()

    return Response(BookRequestSerializer(br).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cancel_book_request(request, request_id):
    """
    A student withdraws their own request — only allowed while it is still
    pending. Once a librarian has approved (loan issued) or rejected it,
    it can no longer be cancelled.
    """
    with transaction.atomic():
        try:
            # Filtering by student means someone else's request id just looks
            # like it doesn't exist, instead of leaking that it does.
            br = BookRequest.objects.select_for_update().get(
                id=request_id, student=request.user
            )
        except BookRequest.DoesNotExist:
            return Response({"detail": "No such request."}, status=status.HTTP_404_NOT_FOUND)

        if br.status == BookRequest.CANCELLED:
            return Response(
                {"detail": "This request was already cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if br.status != BookRequest.PENDING:
            return Response(
                {"detail": f"This request was already {br.status} by the librarian, so it can't be cancelled."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        br.status = BookRequest.CANCELLED
        br.resolved_at = timezone.now()
        br.save()

    return Response(BookRequestSerializer(br).data)
