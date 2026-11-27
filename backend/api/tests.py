from datetime import timedelta
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Book, Loan, FINE_PER_DAY


class SuspensionTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser("boss", "b@x.com", "pass1234")
        self.lib = User.objects.create_user("lib1", "l@x.com", "pass1234")
        self.lib.profile.role = "librarian"
        self.lib.profile.save()

    def _login(self, u, p="pass1234"):
        return self.client.post("/api/auth/login/", {"username": u, "password": p})

    def test_active_librarian_can_login(self):
        self.assertEqual(self._login("lib1").status_code, 200)

    def test_suspended_cannot_login(self):
        self.lib.profile.is_active_account = False
        self.lib.profile.save()
        r = self._login("lib1")
        self.assertEqual(r.status_code, 401)
        self.assertIn("suspended", r.data["detail"].lower())

    def test_wrong_password_still_generic(self):
        r = self._login("lib1", "nope")
        self.assertEqual(r.status_code, 401)
        self.assertNotIn("suspended", str(r.data).lower())

    def test_existing_token_dies_when_suspended(self):
        token = self._login("lib1").data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get("/api/loans/all/").status_code, 200)
        self.lib.profile.is_active_account = False
        self.lib.profile.save()
        self.assertEqual(self.client.get("/api/loans/all/").status_code, 401)

    def test_admin_cannot_suspend_self(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/staff/{self.admin.id}/toggle-active/")
        self.assertEqual(r.status_code, 400)
        self.admin.profile.refresh_from_db()
        self.assertTrue(self.admin.profile.is_active_account)


class FineBalanceTests(APITestCase):
    def setUp(self):
        self.stu = User.objects.create_user("stu", "s@x.com", "pass1234")
        self.book = Book.objects.create(title="B", author="A", isbn="1")

    def _loan(self, **kw):
        loan = Loan.objects.create(book=self.book, user=self.stu,
                                   due_date=timezone.now() + timedelta(days=14))
        for k, v in kw.items():
            setattr(loan, k, v)
        loan.save()
        return loan

    def test_paid_fine_not_in_outstanding(self):
        loan = self._loan(is_returned=True, fine_amount=210, fine_paid=True)
        self.assertEqual(loan.outstanding_fine, 0)

    def test_unpaid_returned_fine_counts(self):
        loan = self._loan(is_returned=True, fine_amount=210)
        self.assertEqual(loan.outstanding_fine, 210)

    def test_active_overdue_counts_live(self):
        loan = self._loan(due_date=timezone.now() - timedelta(days=36))
        self.assertEqual(loan.outstanding_fine, 36 * FINE_PER_DAY)

    def test_api_exposes_outstanding_total(self):
        self._loan(is_returned=True, fine_amount=210, fine_paid=True)
        self._loan(due_date=timezone.now() - timedelta(days=36))
        self.client.force_authenticate(self.stu)
        data = self.client.get("/api/loans/mine/").data
        self.assertEqual(sum(l["outstanding_fine"] for l in data), 360)
