"""
Online payment logic (bKash / Nagad).

SECURITY MODEL
  * The amount is computed here, on the server, from the database. The
    client only says *what* it wants to pay for (card fee, or which fines).
  * A payment only ever becomes "completed" inside confirm_payment(), under
    a row lock, after re-validating that the thing being paid for is still
    unpaid.

GATEWAY MODES  (settings.PAYMENT_MODE)
  "sandbox" - a built-in simulator. NO real money moves. Used for
              development and for demoing the flow. This is the default
              when DEBUG is True.
  "live"    - the default when DEBUG is False. Real bKash/Nagad calls are
              NOT implemented yet, so confirming is refused. That's
              deliberate: it makes it impossible to ship a build where
              users can "pay" without money moving.

To go live, implement a gateway in _authorize() that calls the provider's
merchant API (bKash Tokenized Checkout: create -> execute -> query payment;
Nagad: initialize -> checkout -> verify) and returns the provider's trxID
only after the provider confirms the money was received.
"""
import re
import secrets

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import Loan, LibraryCardApplication, Payment, PaymentLine


class PaymentError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def card_fee():
    """Library card fee in BDT. Override with LIBRARY_CARD_FEE in settings."""
    return int(getattr(settings, "LIBRARY_CARD_FEE", 700))


def payment_mode():
    default = "sandbox" if settings.DEBUG else "live"
    return getattr(settings, "PAYMENT_MODE", default)


def gateway_ready():
    return payment_mode() == "sandbox"


_MOBILE_RE = re.compile(r"^01[3-9]\d{8}$")


def normalize_mobile(raw):
    """'+880 1712-345678' / '8801712345678' / '01712345678' -> '01712345678'."""
    digits = re.sub(r"[\s\-]", "", str(raw or ""))
    if digits.startswith("+88"):
        digits = digits[3:]
    elif digits.startswith("88") and len(digits) == 13:
        digits = digits[2:]
    return digits


def payable_fine_loans(user):
    """
    Every loan of this student with something left to pay, newest first:

      * a returned book whose final fine isn't fully paid, and
      * a book that is still out and overdue (its fine keeps growing at
        FINE_PER_DAY, so what's payable is "fine so far - paid so far").

    The amount to pay on each is loan.outstanding_fine.
    """
    candidates = Loan.objects.filter(user=user).filter(
        Q(is_returned=False) | Q(is_returned=True, fine_paid=False, fine_amount__gt=0)
    ).select_related("book")
    owed = [loan for loan in candidates if loan.outstanding_fine > 0]
    owed.sort(key=lambda l: l.due_date)  # oldest overdue first
    return owed


# ---------------------------------------------------------------- create

def create_payment(user, provider, purpose, sender_number, loan_ids=None):
    if provider not in (Payment.BKASH, Payment.NAGAD):
        raise PaymentError("Choose bKash or Nagad.")
    if purpose not in (Payment.CARD_FEE, Payment.FINES):
        raise PaymentError("Unknown payment purpose.")

    number = normalize_mobile(sender_number)
    if not _MOBILE_RE.match(number):
        raise PaymentError("Enter a valid Bangladeshi mobile number, e.g. 01712345678.")

    with transaction.atomic():
        lines = []
        if purpose == Payment.CARD_FEE:
            app = LibraryCardApplication.objects.filter(user=user).first()
            if not app or app.status != LibraryCardApplication.APPROVED:
                raise PaymentError("Your library card application must be approved before you can pay the fee.")
            if app.issued_at:
                raise PaymentError("Your library card fee is already paid.")
            amount = card_fee()
        else:
            owed = {loan.id: loan for loan in payable_fine_loans(user)}
            if loan_ids:
                wanted = {int(i) for i in loan_ids}
                if not wanted.issubset(owed):
                    raise PaymentError("One or more of those fines can't be paid (already paid, or not yours).")
                loans = [owed[i] for i in sorted(wanted)]
            else:
                loans = list(owed.values())
            # The amount is fixed HERE, on the server, per loan: exactly what is owed right now.
            lines = [(loan, loan.outstanding_fine) for loan in loans]
            amount = sum(a for _, a in lines)
            if amount <= 0:
                raise PaymentError("You have no payable fines right now.")

        # A new attempt replaces any older unfinished attempt for the same thing.
        Payment.objects.filter(user=user, purpose=purpose, status=Payment.PENDING).update(
            status=Payment.FAILED, failure_reason="Replaced by a newer payment attempt."
        )
        payment = Payment.objects.create(
            user=user,
            provider=provider,
            purpose=purpose,
            amount=amount,
            sender_number=number,
            reference="PAY-" + secrets.token_hex(6).upper(),
        )
        for loan, line_amount in lines:
            PaymentLine.objects.create(payment=payment, loan=loan, amount=line_amount)
    return payment


# --------------------------------------------------------------- confirm

def _fail(payment, reason):
    payment.status = Payment.FAILED
    payment.failure_reason = reason
    payment.save()
    return payment, reason


def _revalidate(payment):
    """Re-check, under lock, that what's being paid for is still unpaid."""
    if payment.purpose == Payment.CARD_FEE:
        app = LibraryCardApplication.objects.select_for_update().filter(user=payment.user).first()
        if not app or app.status != LibraryCardApplication.APPROVED:
            return "Your library card application is no longer approved."
        if app.issued_at:
            return "Your library card fee was already paid."
        return None

    lines = list(payment.lines.select_related("loan"))
    if not lines:
        return "Nothing left to pay."
    locked = {l.pk: l for l in Loan.objects.select_for_update().filter(pk__in=[ln.loan_id for ln in lines])}
    for line in lines:
        loan = locked[line.loan_id]
        # The balance may have gone UP since (another day of fine) - that's fine,
        # we only take what was quoted. It must not have gone DOWN: that means
        # it was paid in the meantime (for example at the desk).
        if loan.user_id != payment.user_id or loan.outstanding_fine < line.amount:
            return "Your fine balance changed (for example it was paid at the desk). Reload and try again."
    return None


def _authorize(payment, pin):
    """
    Ask the gateway to take the money. Returns (outcome, trx_id, message)
    where outcome is "ok", "retry" (typo - same payment may be retried) or
    "declined" (payment is dead). Only the sandbox exists today - see the
    module docstring for going live.
    """
    if payment_mode() == "sandbox":
        if not re.fullmatch(r"\d{4,5}", str(pin or "")):
            return "retry", "", "Enter your 4 or 5 digit PIN."
        if str(pin) in ("0000", "00000"):
            return "declined", "", "Payment declined (sandbox: a PIN of 0000 simulates a declined payment)."
        return "ok", "SBX" + secrets.token_hex(5).upper(), ""
    raise PaymentError("Online payments are not available yet.", 501)


def _apply(payment):
    """Do the thing the payment was for."""
    now = timezone.now()
    if payment.purpose == Payment.CARD_FEE:
        app = LibraryCardApplication.objects.select_for_update().get(user=payment.user)
        app.issued_at = now
        app.card_number = f"{now.year}{app.pk:08d}"  # 12 digits, e.g. 202600000007
        app.save()
    else:
        for line in payment.lines.select_related("loan"):
            loan = Loan.objects.select_for_update().get(pk=line.loan_id)
            loan.credit_fine(line.amount, when=now)  # paid online: no librarian recorded


def confirm_payment(user, payment_id, pin):
    """
    Returns (payment, error_message). error_message is None on success.
    Raises PaymentError for requests that should be refused outright.
    """
    if not gateway_ready():
        raise PaymentError("Online payments are not available yet.", 501)

    with transaction.atomic():
        try:
            payment = Payment.objects.select_for_update().get(pk=payment_id, user=user)
        except Payment.DoesNotExist:
            raise PaymentError("No such payment.", 404)
        if payment.status != Payment.PENDING:
            raise PaymentError(f"This payment is already {payment.status}.")

        problem = _revalidate(payment)
        if problem:
            return _fail(payment, problem)

        outcome, trx_id, message = _authorize(payment, pin)
        if outcome == "retry":
            return payment, message
        if outcome == "declined":
            return _fail(payment, message)

        _apply(payment)
        payment.status = Payment.COMPLETED
        payment.provider_trx_id = trx_id
        payment.completed_at = timezone.now()
        payment.save()
        return payment, None
