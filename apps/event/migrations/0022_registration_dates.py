from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0021_waitlist"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="registration_start",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="If set, registration opens at this date/time. Before this, registration is closed regardless of the manual toggle.",
                verbose_name="Registration start",
            ),
        ),
        migrations.AddField(
            model_name="organizedevent",
            name="registration_end",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="If set, registration closes at this date/time. After this, registration is closed regardless of the manual toggle.",
                verbose_name="Registration end",
            ),
        ),
    ]
