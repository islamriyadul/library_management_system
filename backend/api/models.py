from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import date, timedelta
from django.conf import settings

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

    # Total cash received towards this loan's fine so far (desk + online).
    # A fine on a book that is still out keeps growing every day, so a student
    # can pay what they owe today; tomorrow's growth just shows up as a new
    # balance (fine so far - paid so far). Nothing is lost if the book is
    # returned later: whatever was paid is credited against the final fine.
    fine_paid_amount = models.PositiveIntegerField(default=0)

    # True once a RETURNED loan's final fine has been paid in full.
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
        # Money already paid while the book was out counts towards the final fine.
        if self.fine_amount > 0 and self.fine_paid_amount >= self.fine_amount:
            self.fine_paid = True
            self.fine_paid_at = self.fine_paid_at or self.return_date
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

    @property
    def outstanding_fine(self):
        """
        What the student still has to PAY on this loan right now:
        the fine so far (live while the book is out, final once returned)
        minus everything already paid. This is the number to sum for a
        student's "fine balance".
        """
        if self.is_returned and self.fine_paid:
            return 0
        return max(0, self.current_fine - self.fine_paid_amount)

    def credit_fine(self, amount, by=None, when=None):
        """
        Record `amount` BDT received towards this fine (desk or online) and
        save. The caller must hold a row lock (select_for_update).
        """
        when = when or timezone.now()
        self.fine_paid_amount += amount
        if self.is_returned and self.fine_amount > 0 and self.fine_paid_amount >= self.fine_amount:
            self.fine_paid = True
            self.fine_paid_at = when
            self.fine_paid_by = by
        self.save()

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


# ---------------------------------------------------------------------------
# Library card + online payments
# ---------------------------------------------------------------------------

class LibraryCardApplication(models.Model):
    """
    A student's application for a library card.

    Lifecycle:  pending --(librarian approves)--> approved --(fee paid)--> ISSUED
                pending --(librarian rejects)--> rejected --(student fixes & re-applies)--> pending

    The card is only "active" (student may request books, card can be
    downloaded) once it is approved AND the card fee has been paid, which is
    what stamps issued_at / card_number.
    """

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (APPROVED, "Approved"),
        (REJECTED, "Rejected"),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="card_application")

    full_name = models.CharField(max_length=150)
    student_id = models.CharField(max_length=50)
    department = models.CharField(max_length=100)
    session = models.CharField(max_length=30)
    address = models.CharField(max_length=255)
    photo = models.ImageField(upload_to="card_photos/")

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    rejection_reason = models.CharField(max_length=255, blank=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_card_applications"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    # Set when the card fee is paid.
    card_number = models.CharField(max_length=30, unique=True, null=True, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)

    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_active(self):
        return self.status == self.APPROVED and self.issued_at is not None

    @property
    def valid_thru(self):
        """
        The "Valid Thru" date printed on the card: 31 December, N years after
        the year it was issued (N = LIBRARY_CARD_VALID_YEARS in settings,
        default 4 - a typical degree length). Display only: it is NOT used to
        block an expired card.
        """
        if not self.issued_at:
            return None
        years = int(getattr(settings, "LIBRARY_CARD_VALID_YEARS", 4))
        return date(self.issued_at.year + years, 12, 31)

    def __str__(self):
        return f"{self.user.username} card application ({self.status})"


class Payment(models.Model):
    """
    One online payment attempt via bKash or Nagad, for either the library
    card fee or a bundle of returned-book fines.

    The amount is ALWAYS computed by the server when the payment is created
    (see api/payments.py) — it is never taken from the client.
    """

    BKASH = "bkash"
    NAGAD = "nagad"
    PROVIDER_CHOICES = [(BKASH, "bKash"), (NAGAD, "Nagad")]

    CARD_FEE = "card_fee"
    FINES = "fines"
    PURPOSE_CHOICES = [(CARD_FEE, "Library card fee"), (FINES, "Fines")]

    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    STATUS_CHOICES = [(PENDING, "Pending"), (COMPLETED, "Completed"), (FAILED, "Failed")]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments")
    provider = models.CharField(max_length=10, choices=PROVIDER_CHOICES)
    purpose = models.CharField(max_length=10, choices=PURPOSE_CHOICES)
    amount = models.PositiveIntegerField()  # BDT

    sender_number = models.CharField(max_length=15)
    reference = models.CharField(max_length=30, unique=True)  # our own receipt id
    provider_trx_id = models.CharField(max_length=40, blank=True)  # the bKash/Nagad trxID
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=PENDING)
    failure_reason = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.reference} {self.provider} {self.amount} BDT ({self.status})"


class PaymentLine(models.Model):
    """How much of a fines payment went to which loan (one row per loan)."""

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="lines")
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name="payment_lines")
    amount = models.PositiveIntegerField()  # BDT

    def __str__(self):
        return f"{self.payment.reference}: {self.amount} BDT -> loan {self.loan_id}"
