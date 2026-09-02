from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Book, Loan, Profile


class UserSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    student_id = serializers.CharField(source="profile.student_id", read_only=True)
    department = serializers.CharField(source="profile.department", read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "student_id", "department"]


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
            "total_copies", "available_copies", "added_at",
        ]
        read_only_fields = ["available_copies", "added_at"]

    def create(self, validated_data):
        validated_data["available_copies"] = validated_data.get("total_copies", 1)
        return super().create(validated_data)


class LoanSerializer(serializers.ModelSerializer):
    book_title = serializers.CharField(source="book.title", read_only=True)
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Loan
        fields = [
            "id", "book", "book_title", "user", "username",
            "issue_date", "due_date", "return_date",
            "fine_amount", "is_returned",
        ]
        read_only_fields = [
            "user", "issue_date", "due_date", "return_date",
            "fine_amount", "is_returned",
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
