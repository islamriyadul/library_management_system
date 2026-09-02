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
    student_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
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

    def __str__(self):
        return f"{self.book.title} -> {self.user.username}"
