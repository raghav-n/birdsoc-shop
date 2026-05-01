from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0020_event_new_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="waitlist_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, users can join a waiting list when the event is full.",
                verbose_name="Waitlist enabled",
            ),
        ),
        migrations.AddField(
            model_name="eventparticipant",
            name="is_waitlisted",
            field=models.BooleanField(
                default=False,
                verbose_name="On waitlist",
            ),
        ),
    ]
