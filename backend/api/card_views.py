from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .card_pdf import barcode_modules, build_card_pdf, qr_matrix
from .card_serializers import (
    ApplyInputSerializer, LibraryCardApplicationSerializer, PaymentSerializer,
)
from .cards import get_application
from .models import FINE_PER_DAY, LibraryCardApplication, Payment
from .payments import (
    PaymentError, card_fee, confirm_payment, create_payment, gateway_ready,
    payable_fine_loans, payment_mode,
)
from .permissions import IsLibrarianOrAdminOnly, get_role


def _student_only(request):
    if get_role(request.user) != "student":
        return Response(
            {"detail": "Library cards are for student accounts."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _card_state(request):
    app = get_application(request.user)
    state = {
        "status": app.status if app else "none",
        "is_active": bool(app and app.is_active),
        "fee": card_fee(),
        "fee_paid": bool(app and app.issued_at),
        "application": (
            LibraryCardApplicationSerializer(app, context={"request": request}).data if app else None
        ),
        "visual": None,
    }
    if app and app.is_active:
        # The exact same barcode/QR the PDF uses, so the on-screen card matches it.
        state["visual"] = {
            "barcode": barcode_modules(app.card_number),
            "qr": qr_matrix(app.card_number),
        }
    return state


# ------------------------------------------------------------- student side

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_card(request):
    """Where the student is in the card process (none/pending/approved/rejected + paid or not)."""
    return Response(_card_state(request))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def apply_for_card(request):
    denied = _student_only(request)
    if denied:
        return denied

    with transaction.atomic():
        app = LibraryCardApplication.objects.select_for_update().filter(user=request.user).first()
        if app and app.status != LibraryCardApplication.REJECTED:
            return Response(
                {"detail": "You have already applied for a library card."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = ApplyInputSerializer(data=request.data, context={"user": request.user})
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        if app is None:
            app = LibraryCardApplication(user=request.user)
        else:
            app.photo.delete(save=False)  # re-applying after a rejection: drop the old photo
        app.full_name = data["full_name"].strip()
        app.student_id = data["student_id"]
        app.department = data["department"].strip()
        app.session = data["session"].strip()
        app.address = data["address"].strip()
        app.photo = data["photo"]
        app.status = LibraryCardApplication.PENDING
        app.rejection_reason = ""
        app.reviewed_by = None
        app.reviewed_at = None
        app.save()

    return Response(_card_state(request), status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def download_card(request):
    app = get_application(request.user)
    if not app or not app.is_active:
        return Response(
            {"detail": "Your library card isn't issued yet. Complete registration and pay the card fee first."},
            status=status.HTTP_403_FORBIDDEN,
        )
    pdf = build_card_pdf(app)
    resp = HttpResponse(pdf, content_type="application/pdf")
    resp["Content-Disposition"] = f'attachment; filename="library-card-{app.card_number}.pdf"'
    return resp


# ----------------------------------------------------------- librarian side

@api_view(["GET"])
@permission_classes([IsLibrarianOrAdminOnly])
def list_applications(request):
    wanted = request.query_params.get("status", LibraryCardApplication.PENDING)
    qs = LibraryCardApplication.objects.select_related("user")
    if wanted != "all":
        qs = qs.filter(status=wanted)
    qs = qs.order_by("submitted_at")
    return Response(LibraryCardApplicationSerializer(qs, many=True, context={"request": request}).data)


@api_view(["POST"])
@permission_classes([IsLibrarianOrAdminOnly])
def review_application(request, application_id):
    action = request.data.get("action")
    reason = str(request.data.get("reason", "")).strip()
    if action not in ("approve", "reject"):
        return Response({"detail": "action must be 'approve' or 'reject'."}, status=status.HTTP_400_BAD_REQUEST)
    if action == "reject" and not reason:
        return Response({"detail": "Give the student a reason for the rejection."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        try:
            app = LibraryCardApplication.objects.select_for_update().get(pk=application_id)
        except LibraryCardApplication.DoesNotExist:
            return Response({"detail": "No such application."}, status=status.HTTP_404_NOT_FOUND)
        if app.status != LibraryCardApplication.PENDING:
            return Response({"detail": "This application was already reviewed."}, status=status.HTTP_400_BAD_REQUEST)

        app.status = LibraryCardApplication.APPROVED if action == "approve" else LibraryCardApplication.REJECTED
        app.rejection_reason = reason[:255] if action == "reject" else ""
        app.reviewed_by = request.user
        app.reviewed_at = timezone.now()
        app.save()

    return Response(LibraryCardApplicationSerializer(app, context={"request": request}).data)


# ----------------------------------------------------------------- payments

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_summary(request):
    fines = payable_fine_loans(request.user)
    app = get_application(request.user)
    return Response({
        "mode": payment_mode(),
        "gateway_ready": gateway_ready(),
        "card": {
            "status": app.status if app else "none",
            "fee": card_fee(),
            "fee_due": bool(app and app.status == LibraryCardApplication.APPROVED and not app.issued_at),
            "is_active": bool(app and app.is_active),
        },
        "fines": {
            "total": sum(l.outstanding_fine for l in fines),
            "per_day": FINE_PER_DAY,
            "items": [
                {
                    "id": l.id,
                    "book_title": l.book.title,
                    # "overdue" = still out and the fine is still growing; "returned" = final amount
                    "state": "returned" if l.is_returned else "overdue",
                    "due_date": l.due_date,
                    "return_date": l.return_date,
                    "fine_so_far": l.current_fine,
                    "paid": l.fine_paid_amount,
                    "outstanding": l.outstanding_fine,
                }
                for l in fines
            ],
        },
        "history": PaymentSerializer(
            Payment.objects.filter(user=request.user).order_by("-created_at")[:50], many=True
        ).data,
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_payment(request):
    denied = _student_only(request)
    if denied:
        return denied
    try:
        payment = create_payment(
            request.user,
            provider=request.data.get("provider"),
            purpose=request.data.get("purpose"),
            sender_number=request.data.get("sender_number"),
            loan_ids=request.data.get("loan_ids") or None,
        )
    except PaymentError as e:
        return Response({"detail": e.message}, status=e.status)
    except (TypeError, ValueError):
        return Response({"detail": "Invalid request."}, status=status.HTTP_400_BAD_REQUEST)
    return Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_payment_view(request, payment_id):
    try:
        payment, error = confirm_payment(request.user, payment_id, request.data.get("pin"))
    except PaymentError as e:
        return Response({"detail": e.message}, status=e.status)
    body = PaymentSerializer(payment).data
    if error:
        body["detail"] = error
        return Response(body, status=status.HTTP_400_BAD_REQUEST)
    return Response(body)
