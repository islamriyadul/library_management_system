from django.contrib import admin
from .models import Book, Loan, Profile


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "isbn", "subject", "total_copies", "available_copies")
    search_fields = ("title", "author", "isbn")


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("book", "user", "issue_date", "due_date", "return_date", "is_returned", "fine_amount")
    list_filter = ("is_returned",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "student_id", "department", "is_active_account")
    list_filter = ("role", "is_active_account")
    search_fields = ("user__username",)
