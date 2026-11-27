import io
import shutil
import tempfile
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from .models import Book, LibraryCardApplication, Loan, Payment

TMP_MEDIA = tempfile.mkdtemp()


def photo(size=(300, 400), fmt="JPEG", name="me.jpg"):
    buf = io.BytesIO()
    Image.new("RGB", size, (30, 90, 200)).save(buf, fmt)
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/jpeg")


@override_settings(MEDIA_ROOT=TMP_MEDIA, PAYMENT_MODE="sandbox", LIBRARY_CARD_FEE=200)
class CardAndPaymentBase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def setUp(self):
        self.stu = User.objects.create_user("stu", "s@x.com", "pass1234")
        self.other = User.objects.create_user("other", "o@x.com", "pass1234")
        self.lib = User.objects.create_user("lib", "l@x.com", "pass1234")
        self.lib.profile.role = "librarian"
        self.lib.profile.save()
        self.book = Book.objects.create(title="Physics", author="A", isbn="111", total_copies=2, available_copies=2)

    # helpers -------------------------------------------------------------
    def as_user(self, user):
        self.client.force_authenticate(user)

    def apply(self, student_id="230241082", **over):
        data = {
            "full_name": "Sajjad Hossain", "student_id": student_id,
            "department": "Computer Science and Engineering",
            "session": "2026-2027", "address": "Chattogram", "photo": photo(),
        }
        data.update(over)
        return self.client.post("/api/library-card/apply/", data, format="multipart")

    def approve(self, user=None):
        app = LibraryCardApplication.objects.get(user=user or self.stu)
        self.as_user(self.lib)
        r = self.client.post(f"/api/library-card/applications/{app.id}/review/", {"action": "approve"})
        self.as_user(user or self.stu)
        return r

    def pay(self, purpose="card_fee", provider="bkash", pin="12345", **extra):
        body = {"provider": provider, "purpose": purpose, "sender_number": "01712345678"}
        body.update(extra)
        r = self.client.post("/api/payments/create/", body, format="json")
        if r.status_code != 201:
            return r, None
        return self.client.post(f"/api/payments/{r.data['id']}/confirm/", {"pin": pin}, format="json"), r.data["id"]

    def issue_active_card(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r, _ = self.pay()
        self.assertEqual(r.status_code, 200, r.data)


class ApplicationTests(CardAndPaymentBase):
    def test_apply_creates_pending_application_with_photo(self):
        self.as_user(self.stu)
        r = self.apply()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "pending")
        self.assertFalse(r.data["is_active"])
        self.assertTrue(r.data["application"]["photo"].startswith("http"))

    def test_cannot_apply_twice(self):
        self.as_user(self.stu)
        self.apply()
        self.assertEqual(self.apply().status_code, 400)

    def test_photo_is_required(self):
        self.as_user(self.stu)
        r = self.client.post("/api/library-card/apply/", {
            "full_name": "A", "student_id": "1", "department": "d", "session": "s", "address": "a",
        }, format="multipart")
        self.assertEqual(r.status_code, 400)
        self.assertIn("photo", r.data)

    def test_non_image_and_oversize_photo_rejected(self):
        self.as_user(self.stu)
        bad = SimpleUploadedFile("x.jpg", b"not an image", content_type="image/jpeg")
        self.assertEqual(self.apply(photo=bad).status_code, 400)
        big = SimpleUploadedFile("big.jpg", b"\xff\xd8" + b"0" * (2 * 1024 * 1024 + 10), content_type="image/jpeg")
        self.assertEqual(self.apply(photo=big).status_code, 400)

    def test_gif_rejected(self):
        self.as_user(self.stu)
        buf = io.BytesIO()
        Image.new("RGB", (50, 50)).save(buf, "GIF")
        gif = SimpleUploadedFile("a.gif", buf.getvalue(), content_type="image/gif")
        self.assertEqual(self.apply(photo=gif).status_code, 400)

    def test_duplicate_student_id_blocked_across_users(self):
        self.as_user(self.stu)
        self.apply(student_id="555")
        self.as_user(self.other)
        r = self.apply(student_id="555")
        self.assertEqual(r.status_code, 400)
        self.assertIn("student_id", r.data)

    def test_staff_cannot_apply(self):
        self.as_user(self.lib)
        self.assertEqual(self.apply().status_code, 403)

    def test_only_staff_can_list_or_review(self):
        self.as_user(self.stu)
        self.apply()
        app = LibraryCardApplication.objects.get(user=self.stu)
        self.assertEqual(self.client.get("/api/library-card/applications/").status_code, 403)
        r = self.client.post(f"/api/library-card/applications/{app.id}/review/", {"action": "approve"})
        self.assertEqual(r.status_code, 403)
        self.as_user(self.lib)
        listing = self.client.get("/api/library-card/applications/")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(len(listing.data), 1)

    def test_reject_needs_reason_then_student_can_reapply(self):
        self.as_user(self.stu)
        self.apply()
        app = LibraryCardApplication.objects.get(user=self.stu)
        self.as_user(self.lib)
        url = f"/api/library-card/applications/{app.id}/review/"
        self.assertEqual(self.client.post(url, {"action": "reject"}).status_code, 400)
        r = self.client.post(url, {"action": "reject", "reason": "Photo is blurry"})
        self.assertEqual(r.status_code, 200)
        # can't review twice
        self.assertEqual(self.client.post(url, {"action": "approve"}).status_code, 400)

        self.as_user(self.stu)
        state = self.client.get("/api/library-card/").data
        self.assertEqual(state["status"], "rejected")
        self.assertEqual(state["application"]["rejection_reason"], "Photo is blurry")
        r = self.apply()  # re-apply, same student id is fine for the same user
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "pending")
        self.assertEqual(r.data["application"]["rejection_reason"], "")


class FeeAndAccessTests(CardAndPaymentBase):
    def test_cannot_request_book_without_card(self):
        self.as_user(self.stu)
        r = self.client.post("/api/book-requests/create/", {"book": self.book.id})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "library_card_required")

    def test_cannot_request_book_while_pending_or_unpaid(self):
        self.as_user(self.stu)
        self.apply()
        self.assertEqual(self.client.post("/api/book-requests/create/", {"book": self.book.id}).status_code, 403)
        self.approve()  # approved but fee NOT paid yet
        self.assertEqual(self.client.post("/api/book-requests/create/", {"book": self.book.id}).status_code, 403)

    def test_catalog_still_browsable_without_card(self):
        self.as_user(self.stu)
        r = self.client.get("/api/books/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)

    def test_cannot_pay_fee_before_approval(self):
        self.as_user(self.stu)
        self.apply()
        r, _ = self.pay()
        self.assertEqual(r.status_code, 400)

    def test_full_flow_pay_fee_activates_card_and_unlocks_requests(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        state = self.client.get("/api/library-card/").data
        self.assertEqual(state["status"], "approved")
        self.assertFalse(state["is_active"])
        self.assertFalse(state["fee_paid"])

        r, _ = self.pay(provider="nagad")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "completed")
        self.assertTrue(r.data["provider_trx_id"].startswith("SBX"))

        state = self.client.get("/api/library-card/").data
        self.assertTrue(state["is_active"])
        number = state["application"]["card_number"]
        self.assertTrue(number.isdigit() and len(number) == 12, number)
        self.assertEqual(state["application"]["valid_thru"][5:], "12-31")
        self.assertEqual(state["visual"]["barcode"][0], "1")
        self.assertEqual(len(state["visual"]["qr"]), len(state["visual"]["qr"][0]))
        self.assertEqual(self.client.post("/api/book-requests/create/", {"book": self.book.id}).status_code, 201)

    def test_client_cannot_choose_the_amount(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r = self.client.post("/api/payments/create/", {
            "provider": "bkash", "purpose": "card_fee",
            "sender_number": "01712345678", "amount": 1,
        }, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["amount"], 200)

    def test_cannot_pay_fee_twice(self):
        self.issue_active_card()
        r, _ = self.pay()
        self.assertEqual(r.status_code, 400)

    def test_bad_mobile_number_and_provider_rejected(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        for bad in ("123", "01012345678", "abcdefghijk"):
            r = self.client.post("/api/payments/create/", {
                "provider": "bkash", "purpose": "card_fee", "sender_number": bad}, format="json")
            self.assertEqual(r.status_code, 400, bad)
        r = self.client.post("/api/payments/create/", {
            "provider": "paypal", "purpose": "card_fee", "sender_number": "01712345678"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_phone_formats_are_normalised(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r = self.client.post("/api/payments/create/", {
            "provider": "bkash", "purpose": "card_fee", "sender_number": "+880 1712-345678"}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["sender_number"], "01712345678")

    def test_declined_payment_does_not_issue_card(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r, pid = self.pay(pin="0000")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Payment.objects.get(pk=pid).status, "failed")
        self.assertFalse(self.client.get("/api/library-card/").data["is_active"])
        # and a fresh attempt still works
        r, _ = self.pay(pin="4321")
        self.assertEqual(r.status_code, 200)

    def test_mistyped_pin_can_be_retried_on_same_payment(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r, pid = self.pay(pin="12")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Payment.objects.get(pk=pid).status, "pending")
        r = self.client.post(f"/api/payments/{pid}/confirm/", {"pin": "12345"}, format="json")
        self.assertEqual(r.status_code, 200)

    def test_cannot_confirm_someone_elses_payment(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r = self.client.post("/api/payments/create/", {
            "provider": "bkash", "purpose": "card_fee", "sender_number": "01712345678"}, format="json")
        self.as_user(self.other)
        r2 = self.client.post(f"/api/payments/{r.data['id']}/confirm/", {"pin": "12345"}, format="json")
        self.assertEqual(r2.status_code, 404)

    def test_cannot_confirm_twice(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r, pid = self.pay()
        again = self.client.post(f"/api/payments/{pid}/confirm/", {"pin": "12345"}, format="json")
        self.assertEqual(again.status_code, 400)

    @override_settings(PAYMENT_MODE="live")
    def test_live_mode_refuses_to_confirm_because_no_real_gateway_yet(self):
        self.as_user(self.stu)
        self.apply()
        self.approve()
        r = self.client.post("/api/payments/create/", {
            "provider": "bkash", "purpose": "card_fee", "sender_number": "01712345678"}, format="json")
        r2 = self.client.post(f"/api/payments/{r.data['id']}/confirm/", {"pin": "12345"}, format="json")
        self.assertEqual(r2.status_code, 501)
        self.assertFalse(self.client.get("/api/library-card/").data["is_active"])
        self.assertFalse(self.client.get("/api/payments/summary/").data["gateway_ready"])

    def test_mode_defaults_to_live_when_debug_is_off(self):
        from . import payments
        with override_settings(DEBUG=False):
            if hasattr(__import__("django.conf").conf.settings, "PAYMENT_MODE"):
                from django.conf import settings
                del settings.PAYMENT_MODE  # fall back to the default
            self.assertEqual(payments.payment_mode(), "live")
            self.assertFalse(payments.gateway_ready())


class DownloadTests(CardAndPaymentBase):
    def test_download_blocked_until_card_is_active(self):
        self.as_user(self.stu)
        self.assertEqual(self.client.get("/api/library-card/download/").status_code, 403)
        self.apply()
        self.approve()
        self.assertEqual(self.client.get("/api/library-card/download/").status_code, 403)

    def test_active_card_downloads_as_pdf(self):
        self.issue_active_card()
        r = self.client.get("/api/library-card/download/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF"))
        self.assertIn("attachment", r["Content-Disposition"])
        self.assertGreater(len(r.content), 2000)

    def test_pdf_survives_very_long_names(self):
        self.as_user(self.stu)
        self.apply(full_name="X" * 150, department="D" * 100)
        self.approve()
        r, _ = self.pay()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/library-card/download/").status_code, 200)


class FinePaymentTests(CardAndPaymentBase):
    """Fines can be paid online whether the book is back or still out."""

    # -- helpers ---------------------------------------------------------
    def returned_loan(self, user, fine=210, paid=False):
        loan = Loan.objects.create(book=self.book, user=user, due_date=timezone.now() - timedelta(days=30))
        loan.is_returned = True
        loan.return_date = timezone.now()
        loan.fine_amount = fine
        loan.fine_paid = paid
        loan.fine_paid_amount = fine if paid else 0
        loan.save()
        return loan

    def overdue_loan(self, user, days=37):
        """A book that is still OUT and `days` overdue (the 370 BDT case)."""
        return Loan.objects.create(book=self.book, user=user, due_date=timezone.now() - timedelta(days=days, minutes=5))

    def age(self, loan, days):
        """Make a loan `days` more overdue (simulates days passing). Updates the DB row directly."""
        Loan.objects.filter(pk=loan.pk).update(due_date=loan.due_date - timedelta(days=days))
        loan.refresh_from_db()

    def start(self, **extra):
        body = {"provider": "bkash", "purpose": "fines", "sender_number": "01712345678"}
        body.update(extra)
        return self.client.post("/api/payments/create/", body, format="json")

    def confirm(self, payment_id, pin="12345"):
        return self.client.post(f"/api/payments/{payment_id}/confirm/", {"pin": pin}, format="json")

    # -- what can be paid ------------------------------------------------
    def test_summary_lists_overdue_and_returned_unpaid_fines(self):
        out = self.overdue_loan(self.stu, 37)
        back = self.returned_loan(self.stu, 210)
        self.returned_loan(self.stu, 50, paid=True)           # already paid
        self.returned_loan(self.other, 999)                    # someone else's
        Loan.objects.create(book=self.book, user=self.stu, due_date=timezone.now() + timedelta(days=5))  # not due yet
        self.as_user(self.stu)
        s = self.client.get("/api/payments/summary/").data["fines"]
        self.assertEqual(s["total"], 370 + 210)
        self.assertEqual(s["per_day"], 10)
        by_id = {i["id"]: i for i in s["items"]}
        self.assertEqual(set(by_id), {out.id, back.id})
        self.assertEqual(by_id[out.id]["state"], "overdue")
        self.assertEqual(by_id[out.id]["outstanding"], 370)
        self.assertEqual(by_id[back.id]["state"], "returned")
        self.assertEqual(by_id[back.id]["outstanding"], 210)

    # -- paying a fine on a book that is still out (the reported bug) ------
    def test_can_pay_the_370_fine_on_a_book_still_out(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        r = self.start()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["amount"], 370)
        done = self.confirm(r.data["id"])
        self.assertEqual(done.status_code, 200, done.data)
        self.assertEqual(done.data["lines"], [{"loan_id": loan.id, "book_title": "Physics", "amount": 370}])
        loan.refresh_from_db()
        self.assertEqual(loan.fine_paid_amount, 370)
        self.assertEqual(loan.outstanding_fine, 0)
        self.assertFalse(loan.is_returned)        # still out
        self.assertFalse(loan.fine_paid)          # not "settled" - it keeps growing
        self.assertEqual(self.client.get("/api/payments/summary/").data["fines"]["total"], 0)
        # the student's loans API (dashboard / My Fines) reflects it too
        mine = self.client.get("/api/loans/mine/").data
        self.assertEqual([l["outstanding_fine"] for l in mine], [0])
        self.assertEqual(mine[0]["fine_paid_amount"], 370)

    def test_the_next_days_fine_shows_up_and_can_be_paid_too(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        self.confirm(self.start().data["id"])
        self.age(loan, 1)                          # one more day passes
        loan.refresh_from_db()
        self.assertEqual(loan.outstanding_fine, 10)
        r = self.start()
        self.assertEqual(r.data["amount"], 10)
        self.assertEqual(self.confirm(r.data["id"]).status_code, 200)
        loan.refresh_from_db()
        self.assertEqual(loan.fine_paid_amount, 380)
        self.assertEqual(loan.outstanding_fine, 0)

    def test_balance_growing_between_quote_and_confirm_is_fine(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        r = self.start()                           # quoted 370
        self.age(loan, 1)                          # a day ticks over before they confirm
        self.assertEqual(self.confirm(r.data["id"]).status_code, 200)
        loan.refresh_from_db()
        self.assertEqual(loan.fine_paid_amount, 370)   # only what was quoted is taken
        self.assertEqual(loan.outstanding_fine, 10)    # the extra day is still owed

    # -- returning the book after paying online -----------------------------
    def test_returning_after_paying_in_full_settles_the_fine(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        self.confirm(self.start().data["id"])
        self.as_user(self.lib)
        self.assertEqual(self.client.post(f"/api/loans/{loan.id}/return/").status_code, 200)
        loan.refresh_from_db()
        self.assertTrue(loan.is_returned)
        self.assertEqual(loan.fine_amount, 370)
        self.assertTrue(loan.fine_paid)
        self.assertEqual(loan.outstanding_fine, 0)

    def test_returning_later_only_the_extra_days_are_left_and_desk_collects_them(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        self.confirm(self.start().data["id"])      # paid 370
        self.age(loan, 3)                          # 3 more days before it comes back
        self.as_user(self.lib)
        self.client.post(f"/api/loans/{loan.id}/return/")
        loan.refresh_from_db()
        self.assertEqual(loan.fine_amount, 400)
        self.assertFalse(loan.fine_paid)
        self.assertEqual(loan.outstanding_fine, 30)          # not 400: the 370 is credited
        r = self.client.post(f"/api/loans/{loan.id}/pay-fine/")   # librarian collects the remainder
        self.assertEqual(r.status_code, 200)
        loan.refresh_from_db()
        self.assertTrue(loan.fine_paid)
        self.assertEqual(loan.fine_paid_amount, 400)
        self.assertEqual(loan.fine_paid_by, self.lib)
        self.assertEqual(loan.outstanding_fine, 0)

    def test_desk_payment_on_an_untouched_returned_fine_collects_everything(self):
        loan = self.returned_loan(self.stu, 210)
        self.as_user(self.lib)
        self.assertEqual(self.client.post(f"/api/loans/{loan.id}/pay-fine/").status_code, 200)
        loan.refresh_from_db()
        self.assertEqual((loan.fine_paid, loan.fine_paid_amount), (True, 210))

    # -- returned loans, selection and safety --------------------------------
    def test_paying_a_returned_fine_marks_it_paid(self):
        loan = self.returned_loan(self.stu, 210)
        self.as_user(self.stu)
        r = self.start()
        self.assertEqual(r.data["amount"], 210)
        self.confirm(r.data["id"])
        loan.refresh_from_db()
        self.assertTrue(loan.fine_paid)
        self.assertIsNotNone(loan.fine_paid_at)
        self.assertEqual(loan.outstanding_fine, 0)

    def test_can_pay_selected_loans_only(self):
        a = self.returned_loan(self.stu, 100)
        b = self.overdue_loan(self.stu, 20)        # 200
        c = self.returned_loan(self.stu, 300)
        self.as_user(self.stu)
        r = self.start(loan_ids=[a.id, b.id])
        self.assertEqual(r.data["amount"], 300)
        self.confirm(r.data["id"])
        for loan in (a, b, c):
            loan.refresh_from_db()
        self.assertEqual((a.outstanding_fine, b.outstanding_fine, c.outstanding_fine), (0, 0, 300))

    def test_client_cannot_choose_the_amount(self):
        self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        r = self.start(amount=1)
        self.assertEqual(r.data["amount"], 370)

    def test_cannot_pay_another_students_fine(self):
        theirs = self.overdue_loan(self.other, 10)
        self.as_user(self.stu)
        self.assertEqual(self.start(loan_ids=[theirs.id]).status_code, 400)

    def test_cannot_pay_a_loan_with_nothing_owed(self):
        paid = self.returned_loan(self.stu, 100, paid=True)
        fresh = Loan.objects.create(book=self.book, user=self.stu, due_date=timezone.now() + timedelta(days=3))
        self.as_user(self.stu)
        self.assertEqual(self.start(loan_ids=[paid.id]).status_code, 400)
        self.assertEqual(self.start(loan_ids=[fresh.id]).status_code, 400)

    def test_nothing_to_pay(self):
        self.as_user(self.stu)
        self.assertEqual(self.start().status_code, 400)

    def test_fine_settled_at_desk_meanwhile_fails_safely(self):
        loan = self.returned_loan(self.stu, 210)
        self.as_user(self.stu)
        r = self.start()
        self.as_user(self.lib)                     # librarian collects cash before the student confirms
        self.assertEqual(self.client.post(f"/api/loans/{loan.id}/pay-fine/").status_code, 200)
        self.as_user(self.stu)
        r2 = self.confirm(r.data["id"])
        self.assertEqual(r2.status_code, 400)
        self.assertEqual(Payment.objects.get(pk=r.data["id"]).status, "failed")
        loan.refresh_from_db()
        self.assertEqual(loan.fine_paid_amount, 210)   # not double-charged

    def test_declined_payment_changes_nothing(self):
        loan = self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        r = self.start()
        self.assertEqual(self.confirm(r.data["id"], pin="0000").status_code, 400)
        loan.refresh_from_db()
        self.assertEqual(loan.fine_paid_amount, 0)
        self.assertEqual(loan.outstanding_fine, 370)

    def test_new_attempt_supersedes_old_pending_one(self):
        self.overdue_loan(self.stu, 37)
        self.as_user(self.stu)
        first = self.start()
        self.start(provider="nagad", sender_number="01812345678")
        self.assertEqual(Payment.objects.get(pk=first.data["id"]).status, "failed")
        self.assertEqual(Payment.objects.filter(status="pending").count(), 1)

    def test_history_is_private_and_newest_first(self):
        self.returned_loan(self.stu, 210)
        self.as_user(self.stu)
        self.confirm(self.start().data["id"])
        self.as_user(self.other)
        self.assertEqual(self.client.get("/api/payments/summary/").data["history"], [])
        self.as_user(self.stu)
        history = self.client.get("/api/payments/summary/").data["history"]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["lines"][0]["amount"], 210)

    def test_unauthenticated_blocked(self):
        self.client.force_authenticate(None)
        for url in ("/api/library-card/", "/api/payments/summary/", "/api/library-card/download/"):
            self.assertEqual(self.client.get(url).status_code, 401, url)


class LoanFineMathTests(CardAndPaymentBase):
    """outstanding_fine = fine so far - paid so far, in every state."""

    def loan(self, **kw):
        return Loan.objects.create(book=self.book, user=self.stu, due_date=kw.pop("due_date"), **kw)

    def test_not_yet_due(self):
        self.assertEqual(self.loan(due_date=timezone.now() + timedelta(days=3)).outstanding_fine, 0)

    def test_overdue_out_unpaid_and_part_paid(self):
        loan = self.loan(due_date=timezone.now() - timedelta(days=10, minutes=1))
        self.assertEqual(loan.outstanding_fine, 100)
        loan.fine_paid_amount = 40
        self.assertEqual(loan.outstanding_fine, 60)

    def test_never_negative(self):
        loan = self.loan(due_date=timezone.now() - timedelta(days=2, minutes=1))
        loan.fine_paid_amount = 500
        self.assertEqual(loan.outstanding_fine, 0)

    def test_returned_states(self):
        loan = self.loan(due_date=timezone.now() - timedelta(days=5, minutes=1))
        loan.mark_returned()
        self.assertEqual((loan.fine_amount, loan.outstanding_fine), (50, 50))
        loan.credit_fine(20)
        self.assertEqual((loan.outstanding_fine, loan.fine_paid), (30, False))
        loan.credit_fine(30)
        self.assertEqual((loan.outstanding_fine, loan.fine_paid), (0, True))

    def test_legacy_paid_flag_still_means_zero_owed(self):
        loan = self.loan(due_date=timezone.now() - timedelta(days=5, minutes=1))
        loan.mark_returned()
        loan.fine_paid = True           # an old row: flag set, fine_paid_amount never recorded
        self.assertEqual(loan.outstanding_fine, 0)


class DefaultFeeTest(APITestCase):
    def test_default_card_fee_is_700_bdt(self):
        from . import payments
        from django.conf import settings
        if hasattr(settings, "LIBRARY_CARD_FEE"):
            del settings.LIBRARY_CARD_FEE
        self.assertEqual(payments.card_fee(), 700)
