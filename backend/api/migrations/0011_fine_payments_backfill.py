from django.db import migrations
from django.db.models import F


def forwards(apps, schema_editor):
    Loan = apps.get_model("api", "Loan")
    Payment = apps.get_model("api", "Payment")
    PaymentLine = apps.get_model("api", "PaymentLine")

    # Fines already settled (at the desk or online) count as fully paid.
    Loan.objects.filter(fine_paid=True).update(fine_paid_amount=F("fine_amount"))

    # Carry existing fines payments over: each linked loan gets a line for its fine.
    for payment in Payment.objects.filter(purpose="fines"):
        for loan in payment.loans.all():
            PaymentLine.objects.create(payment=payment, loan=loan, amount=loan.fine_amount)


def backwards(apps, schema_editor):
    PaymentLine = apps.get_model("api", "PaymentLine")
    for line in PaymentLine.objects.select_related("payment", "loan"):
        line.payment.loans.add(line.loan)


class Migration(migrations.Migration):
    """Part 2/2: backfill the new fields, then drop the old Payment.loans link."""

    dependencies = [
        ("api", "0010_fine_payment_lines"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
        migrations.RemoveField(model_name="payment", name="loans"),
    ]
