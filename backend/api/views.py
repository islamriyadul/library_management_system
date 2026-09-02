from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Book, Loan, Profile, LOAN_PERIOD_DAYS
from .serializers import (
    BookSerializer, LoanSerializer, RegisterSerializer, UserSerializer,
    StaffSerializer, CreateStaffSerializer,
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
        return Response(UserSerializer(request.user).data)


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

    try:
        student = User.objects.get(username=username)
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

        book.available_copies -= 1
        book.save()

        loan = Loan.objects.create(
            book=book,
            user=student,
            due_date=timezone.now() + timezone.timedelta(days=LOAN_PERIOD_DAYS),
        )

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
