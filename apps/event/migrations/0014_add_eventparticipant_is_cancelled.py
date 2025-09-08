from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("event", "0013_add_emergency_contact_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventparticipant",
            name="is_cancelled",
            field=models.BooleanField(default=False, verbose_name="Cancelled"),
        ),
    ]
