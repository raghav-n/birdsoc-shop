from django.db import migrations, models


def backfill_already_drawn(apps, schema_editor):
    """Mark entries of already-drawn lottery events as 'result email sent'.

    Their emails were already attempted by the old in-request send path, so we
    must not let send_lottery_result_emails re-blast everyone. We stamp the
    event's draw time as the sent time. (Recovering the specific entrants a
    crashed draw never reached is a separate, deliberate action — not this
    blanket backfill.)
    """
    EventParticipant = apps.get_model("event", "EventParticipant")
    OrganizedEvent = apps.get_model("event", "OrganizedEvent")
    drawn = OrganizedEvent.objects.filter(
        signup_mode="lottery", lottery_drawn_at__isnull=False
    )
    for event in drawn.iterator():
        EventParticipant.objects.filter(
            event=event, lottery_result_email_sent_at__isnull=True
        ).update(lottery_result_email_sent_at=event.lottery_drawn_at)


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0030_organizedevent_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventparticipant",
            name="lottery_result_email_sent_at",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text=(
                    "When the won/lost result email was sent. NULL means it "
                    "still needs sending — the send_lottery_result_emails "
                    "command picks these up and is safe to re-run."
                ),
                verbose_name="Lottery result email sent at",
            ),
        ),
        migrations.RunPython(backfill_already_drawn, migrations.RunPython.noop),
    ]
