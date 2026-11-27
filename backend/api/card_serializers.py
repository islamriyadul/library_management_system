from PIL import Image
from rest_framework import serializers

from .models import LibraryCardApplication, Payment

MAX_PHOTO_BYTES = 2 * 1024 * 1024  # 2 MB


class LibraryCardApplicationSerializer(serializers.ModelSerializer):
    """Read-only view of an application (photo comes back as an absolute URL)."""
    username = serializers.CharField(source="user.username", read_only=True)
    photo = serializers.ImageField(read_only=True)
    valid_thru = serializers.DateField(read_only=True)

    class Meta:
        model = LibraryCardApplication
        fields = [
            "id", "username", "full_name", "student_id", "department", "session",
            "address", "photo", "status", "rejection_reason", "reviewed_at",
            "card_number", "issued_at", "valid_thru", "submitted_at",
        ]
        read_only_fields = fields


class ApplyInputSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    student_id = serializers.CharField(max_length=50)
    department = serializers.CharField(max_length=100)
    session = serializers.CharField(max_length=30)
    address = serializers.CharField(max_length=255)
    photo = serializers.ImageField()

    def validate_photo(self, f):
        if f.size > MAX_PHOTO_BYTES:
            raise serializers.ValidationError("Photo must be 2 MB or smaller.")
        f.seek(0)
        try:
            img = Image.open(f)
            fmt = img.format
            img.verify()
        except Exception:
            raise serializers.ValidationError("Upload a valid JPG or PNG image.")
        if fmt not in ("JPEG", "PNG"):
            raise serializers.ValidationError("Photo must be a JPG or PNG image.")
        f.seek(0)
        return f

    def validate_student_id(self, value):
        value = value.strip()
        taken = LibraryCardApplication.objects.filter(student_id__iexact=value)
        me = self.context.get("user")
        if me:
            taken = taken.exclude(user=me)
        if taken.exists():
            raise serializers.ValidationError("A library card application already exists for this student ID.")
        return value


class PaymentSerializer(serializers.ModelSerializer):
    # For fines payments: which books the money went to (shown on the receipt).
    lines = serializers.SerializerMethodField()

    def get_lines(self, payment):
        return [
            {"loan_id": ln.loan_id, "book_title": ln.loan.book.title, "amount": ln.amount}
            for ln in payment.lines.select_related("loan__book")
        ]

    class Meta:
        model = Payment
        fields = [
            "id", "reference", "provider", "purpose", "amount", "status",
            "provider_trx_id", "sender_number", "failure_reason",
            "created_at", "completed_at", "lines",
        ]
        read_only_fields = fields
