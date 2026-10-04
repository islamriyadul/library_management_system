from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Book, Loan, Profile, VerificationRequest, BookRequest


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    student_id = serializers.CharField(source="profile.student_id", read_only=True)
    department = serializers.CharField(source="profile.department", read_only=True)
    batch = serializers.CharField(source="profile.batch", read_only=True)
    staff_id = serializers.CharField(source="profile.staff_id", read_only=True)
    employment_type = serializers.CharField(source="profile.employment_type", read_only=True)
    library_unit = serializers.CharField(source="profile.library_unit", read_only=True)
    employee_id = serializers.CharField(source="profile.employee_id", read_only=True)
    access_level = serializers.CharField(source="profile.access_level", read_only=True)
    office_location = serializers.CharField(source="profile.office_location", read_only=True)
    profile_picture = serializers.ImageField(source="profile.profile_picture", read_only=True)
    is_active_account = serializers.BooleanField(source="profile.is_active_account", read_only=True)
    updated_at = serializers.DateTimeField(source="profile.updated_at", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "role",
            "student_id", "department", "batch",
            "staff_id", "employment_type", "library_unit",
            "employee_id", "access_level", "office_location",
            "profile_picture", "is_active_account", "updated_at",
        ]


class UpdateMeSerializer(serializers.Serializer):
    """
    What a logged-in user may change about their OWN account via PATCH
    /auth/me/. Deliberately excludes username, email, and role — those stay
    locked (username is used as a lookup key throughout the backend;
    role changes are an Admin-only action via /staff/).
    """

    first_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    last_name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    student_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    department = serializers.CharField(required=False, allow_blank=True, max_length=100)
    batch = serializers.CharField(required=False, allow_blank=True, max_length=50)
    staff_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    employment_type = serializers.CharField(required=False, allow_blank=True, max_length=100)
    library_unit = serializers.CharField(required=False, allow_blank=True, max_length=100)
    employee_id = serializers.CharField(required=False, allow_blank=True, max_length=50)
    access_level = serializers.CharField(required=False, allow_blank=True, max_length=100)
    office_location = serializers.CharField(required=False, allow_blank=True, max_length=150)
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    # multipart/form-data can't send a literal "null" for a file field, so
    # removal is a separate explicit flag rather than overloading
    # profile_picture=None from the frontend.
    remove_profile_picture = serializers.BooleanField(required=False, default=False)

    def update(self, user, validated_data):
        for field in ("first_name", "last_name"):
            if field in validated_data:
                setattr(user, field, validated_data[field])
        user.save()

        profile = user.profile

        # Handle removal first. If the frontend somehow sent both a removal
        # flag AND a new file in the same request, removal wins — simplest,
        # safest interpretation, and the frontend never actually does this.
        if validated_data.get("remove_profile_picture"):
            if profile.profile_picture:
                profile.profile_picture.delete(save=False)  # deletes the file on disk too
            profile.profile_picture = None
        elif "profile_picture" in validated_data:
            # Replacing an existing photo — delete the old file first so it
            # doesn't just pile up unused on disk.
            if profile.profile_picture:
                profile.profile_picture.delete(save=False)
            profile.profile_picture = validated_data["profile_picture"]

        for field in (
            "student_id", "department", "batch",
            "staff_id", "employment_type", "library_unit",
            "employee_id", "access_level", "office_location",
        ):
            if field in validated_data:
                setattr(profile, field, validated_data[field])
        profile.save()

        return user


class RegisterSerializer(serializers.ModelSerializer):
    """Public registration. Always creates a Student account -
    role is never chosen by the person registering."""

    password = serializers.CharField(write_only=True, min_length=6)
    student_id = serializers.CharField(write_only=True, required=False, allow_blank=True)
    department = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "student_id", "department"]

    def create(self, validated_data):
        student_id = validated_data.pop("student_id", "")
        department = validated_data.pop("department", "")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        # Signal already created a Profile with role="student"; just fill in extra info
        user.profile.student_id = student_id
        user.profile.department = department
        user.profile.save()
        return user


class BookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = [
            "id", "title", "author", "isbn", "subject",
            "total_copies", "available_copies", "cover_image", "added_at",
        ]
        read_only_fields = ["available_copies", "added_at"]

    def create(self, validated_data):
        validated_data["available_copies"] = validated_data.get("total_copies", 1)
        return super().create(validated_data)


class LoanSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)
    # fine_amount is the locked-in final fine (only ever set at return time).
    # current_fine is what's actually owed right now, live, whether the
    # loan has been returned yet or not — this is what the UI should show.
    current_fine = serializers.IntegerField(read_only=True)
    fine_paid_by_username = serializers.CharField(
        source="fine_paid_by.username", read_only=True, default=None
    )

    class Meta:
        model = Loan
        fields = [
            "id", "book", "book_title", "user", "username",
            "issue_date", "due_date", "return_date",
            "fine_amount", "current_fine", "is_returned",
            "fine_paid", "fine_paid_at", "fine_paid_by_username",
        ]
        read_only_fields = [
            "user", "issue_date", "due_date", "return_date",
            "fine_amount", "current_fine", "is_returned",
            "fine_paid", "fine_paid_at", "fine_paid_by_username",
        ]


# ---------- Staff management (Admin only) ----------

class StaffSerializer(serializers.ModelSerializer):
    """Read view of a librarian/admin account."""

    role = serializers.CharField(source="profile.role")
    is_active_account = serializers.BooleanField(source="profile.is_active_account")

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "is_active_account"]


class CreateStaffSerializer(serializers.ModelSerializer):
    """Admin uses this to create a new Librarian or Admin account."""

    password = serializers.CharField(write_only=True, min_length=6)
    role = serializers.ChoiceField(choices=[Profile.LIBRARIAN, Profile.ADMIN], write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password", "role"]

    def create(self, validated_data):
        role = validated_data.pop("role")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
        )
        user.profile.role = role
        user.profile.save()
        return user

    def to_representation(self, instance):
        # Once created, represent the account the same way StaffSerializer does
        # (reads role/is_active_account correctly from the Profile)
        return StaffSerializer(instance, context=self.context).data


# ---------- Circulation desk verification queue (Librarian/Admin) ----------

class VerificationRequestSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    clearance = serializers.SerializerMethodField()

    class Meta:
        model = VerificationRequest
        fields = [
            "id", "student_username", "purpose", "status",
            "created_at", "resolved_at", "clearance",
        ]
        read_only_fields = ["status", "created_at", "resolved_at"]

    def get_clearance(self, obj):
        return "overdue" if obj.is_student_overdue() else "clear"


# ---------- Student self-service book requests ----------

class BookRequestSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)
    book_title = serializers.CharField(source="book.title", read_only=True)

    class Meta:
        model = BookRequest
        fields = [
            "id", "student", "student_username", "book", "book_title",
            "status", "requested_at", "resolved_at",
        ]
        read_only_fields = ["student", "status", "requested_at", "resolved_at"]
