from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0015_create_event_merchandise_groups"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="registration_required",
            field=models.BooleanField(
                default=True,
                help_text="If false, the event page shows info only with no registration form",
                verbose_name="Registration required",
            ),
        ),
    ]
