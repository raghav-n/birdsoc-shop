import uuid

from django.db import migrations, models


def populate_guide_tokens(apps, schema_editor):
    EventGroup = apps.get_model("event", "EventGroup")
    for group in EventGroup.objects.all():
        group.guide_token = uuid.uuid4()
        group.save(update_fields=["guide_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0034_organizedevent_collect_driving"),
    ]

    operations = [
        migrations.AddField(
            model_name="eventgroup",
            name="quick_edit_fields",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Extra-info keys (e.g. 'driving') shown as editable columns on the group participant list and its guide link.",
                verbose_name="Quick-edit fields",
            ),
        ),
        # Added nullable first so existing rows each get their own token.
        migrations.AddField(
            model_name="eventgroup",
            name="guide_token",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(populate_guide_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="eventgroup",
            name="guide_token",
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                help_text="Token for no-login magic-link access to the group participant list.",
                unique=True,
                verbose_name="Guide token",
            ),
        ),
    ]
