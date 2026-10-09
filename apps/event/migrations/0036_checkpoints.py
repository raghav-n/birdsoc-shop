import apps.event.models
from django.db import migrations, models


def seed_from_attended(apps, schema_editor):
    """Already-attended registrations in grouped events count as checked in at checkpoint 1."""
    EventParticipant = apps.get_model("event", "EventParticipant")
    eps = EventParticipant.objects.select_related("participant").filter(
        attended=True, event__group__isnull=False
    )
    for ep in eps:
        ep.checkpoints = [{"1": True} for _ in range(max(ep.participant.quantity, 1))]
        ep.save(update_fields=["checkpoints"])


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0035_eventgroup_guide_token_quick_edit_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventgroup",
            name="checkpoint_labels",
            field=models.JSONField(
                default=apps.event.models.default_checkpoint_labels,
                help_text="Names of the two attendance checkpoints. The first is marked on the group page, the second on each event's own page.",
                verbose_name="Checkpoint labels",
            ),
        ),
        migrations.AddField(
            model_name="eventparticipant",
            name="checkpoints",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Per-person checkpoint marks for grouped events: one dict per person (slot), mapping checkpoint number ('1'/'2') to when it was marked. ``attended`` mirrors whether anyone is marked at checkpoint 1.",
                verbose_name="Checkpoints",
            ),
        ),
        migrations.RunPython(seed_from_attended, migrations.RunPython.noop),
    ]
