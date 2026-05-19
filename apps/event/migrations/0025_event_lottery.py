from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0024_event_blog_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="signup_mode",
            field=models.CharField(
                choices=[
                    ("first_come", "First-come, first-served"),
                    ("lottery", "Lottery (random draw after signups close)"),
                ],
                default="first_come",
                help_text=(
                    "First-come: registrations confirm immediately. "
                    "Lottery: collect entries during the signup window, then run a random draw to pick winners. "
                    "Lottery is only supported for free events."
                ),
                max_length=16,
                verbose_name="Signup mode",
            ),
        ),
        migrations.AddField(
            model_name="organizedevent",
            name="lottery_drawn_at",
            field=models.DateTimeField(
                blank=True,
                editable=False,
                help_text="Set when the lottery draw has been run for this event.",
                null=True,
                verbose_name="Lottery drawn at",
            ),
        ),
        migrations.AddField(
            model_name="eventparticipant",
            name="is_lottery_pending",
            field=models.BooleanField(
                default=False,
                help_text="Lottery entry awaiting the draw.",
                verbose_name="Pending lottery draw",
            ),
        ),
        migrations.AddField(
            model_name="eventparticipant",
            name="is_lottery_lost",
            field=models.BooleanField(
                default=False,
                help_text="Lottery entry that wasn't selected in the draw.",
                verbose_name="Not selected in lottery",
            ),
        ),
    ]
