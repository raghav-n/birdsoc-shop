from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0009_organizedevent_price_tiers"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventregistration",
            name="donation_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="eventregistrationgroup",
            name="donation_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]

