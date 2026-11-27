import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Part 1/2 of "pay fines online, including fines on books still out":
      * Loan.fine_paid_amount - total cash received towards a loan's fine
      * PaymentLine           - how much of a fines payment went to which loan
    (0011 carries the existing data over and drops the old Payment.loans link.)
    """

    dependencies = [
        ("api", "0009_library_card_and_payments"),
    ]

    operations = [
        migrations.AddField(
            model_name="loan",
            name="fine_paid_amount",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="PaymentLine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.PositiveIntegerField()),
                ("loan", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="payment_lines", to="api.loan")),
                ("payment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="lines", to="api.payment")),
            ],
        ),
    ]
