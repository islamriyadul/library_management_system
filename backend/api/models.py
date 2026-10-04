from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta

# How many days a book can be borrowed for before it's overdue
LOAN_PERIOD_DAYS = 14

# Fine charged per day once a book is overdue (in Taka)
FINE_PER_DAY = 10


class Profile(models.Model):
    STUDENT = "student"
    LIBRARIAN = "librarian"
    ADMIN = "admin"
    ROLE_CHOICES = [
        (STUDENT, "Student"),
        (LIBRARIAN, "Librarian"),
        (ADMIN, "Admin"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=STUDENT)

    # Student-specific (blank/unused for Librarian & Admin)
    student_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    batch = models.CharField(max_length=50, blank=True)

    # Librarian-specific (blank/unused for Student & Admin)
    staff_id = models.CharField(max_length=50, blank=True)
    employment_type = models.CharField(max_length=100, blank=True)
    library_unit = models.CharField(max_length=100, blank=True)

    # Admin-specific (blank/unused for Student & Librarian)
    employee_id = models.CharField(max_length=50, blank=True)
    access_level = models.CharField(max_length=100, blank=True)
    office_location = models.CharField(max_length=150, blank=True)

    profile_picture = models.ImageField(upload_to="profile_pictures/", blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active_account = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.user.username} ({self.role})"


@receiver(post_save, sender=User)
def create_or_sync_profile(sender, instance, created, **kwargs):
    """
    Every User automatically gets a Profile.
    - A superuser (created via createsuperuser) becomes Admin automatically.
    - Everyone else (e.g. public registration) starts as Student.
    Librarian accounts are only ever created by an Admin through the
    staff-management endpoint, which sets the role explicitly afterward.
    """
    if created:
        role = Profile.ADMIN if instance.is_superuser else Profile.STUDENT
        Profile.objects.get_or_create(user=instance, defaults={"role": role})


class Book(models.Model):
    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    isbn = models.CharField(max_length=20, unique=True)
    subject = models.CharField(max_length=100, blank=True)
    total_copies = models.PositiveIntegerField(default=1)
    available_copies = models.PositiveIntegerField(default=1)
    cover_image = models.ImageField(upload_to="book_covers/", blank=True, null=True)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} by {self.author}"


class Loan(models.Model):
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="loans")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="loans")
    issue_date = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField()
    return_date = models.DateTimeField(null=True, blank=True)
    fine_amount = models.PositiveIntegerField(default=0)
    is_returned = models.BooleanField(default=False)

    # Whether the student has actually handed over the cash for fine_amount.
    # Only meaningful once the book is returned and fine_amount > 0 — a fine
    # can't be "paid" while it's still just a live, growing estimate on a
    # book that hasn't come back yet.
    fine_paid = models.BooleanField(default=False)
    fine_paid_at = models.DateTimeField(null=True, blank=True)
    fine_paid_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="fines_collected"
    )

    def save(self, *args, **kwargs):
        if not self.due_date:
            self.due_date = timezone.now() + timedelta(days=LOAN_PERIOD_DAYS)
        super().save(*args, **kwargs)

    def mark_returned(self):
        self.return_date = timezone.now()
        self.is_returned = True
        if self.return_date > self.due_date:
            days_overdue = (self.return_date - self.due_date).days
            self.fine_amount = days_overdue * FINE_PER_DAY
        self.save()

    @property
    def current_fine(self):
        """
        What's actually owed on this loan RIGHT NOW.

        fine_amount only gets set inside mark_returned() — it stays 0 for
        every day a book is overdue but still out, because nothing ever
        recalculates it while the loan is still active. That's correct for
        the locked-in final fine, but useless for "what does this student
        currently owe" — which is what every fines/loans screen actually
        needs to show.

        - Already returned: fine_amount is final and correct, return it.
        - Still out and overdue: compute it live from today's date.
        - Still out and not yet due: 0.
        """
        if self.is_returned:
            return self.fine_amount
        if timezone.now() > self.due_date:
            days_overdue = (timezone.now() - self.due_date).days
            return days_overdue * FINE_PER_DAY
        return 0

    def __str__(self):
        return f"{self.book.title} -> {self.user.username}"


class VerificationRequest(models.Model):
    """
    A student's walk-in check-in at the circulation desk, logged by a
    librarian (e.g. "Textbook Issue", "Return Deposit"). Librarian then
    clears (approves) or rejects it. The "clearance" state shown in the
    UI (Clear / Overdue Fine) is NOT stored here — it's computed live from
    the student's current loans, so it's always accurate.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="verification_requests")
    purpose = models.CharField(max_length=100)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_verifications"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    def is_student_overdue(self):
        return Loan.objects.filter(
            user=self.student, is_returned=False, due_date__lt=timezone.now()
        ).exists()

    def __str__(self):
        return f"{self.student.username} - {self.purpose} ({self.status})"


class BookRequest(models.Model):
    """
    A student clicking "Request to Borrow" on a book in the Catalog. A
    librarian/admin then approves (which actually issues the loan, same
    as the existing issue_book logic — fixed 14-day period, same as
    every other loan) or rejects it.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"  # withdrawn by the student while still pending
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
        (CANCELLED, "Cancelled"),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="book_requests")
    book = models.ForeignKey(Book, on_delete=models.CASCADE, related_name="requests")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_book_requests"
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    # Set when approval creates the actual loan, so the frontend can link
    # a resolved request straight to its resulting Loan if ever needed.
    resulting_loan = models.ForeignKey(
        Loan, on_delete=models.SET_NULL, null=True, blank=True, related_name="from_request"
    )

    def __str__(self):
        return f"{self.student.username} requested {self.book.title} ({self.status})"
