from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0006_eventparticipant_extra_json_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organizedevent",
            name="json_schema",
            field=models.JSONField(
                verbose_name="JSON schema",
                blank=True,
                null=True,
                help_text="Optional JSON schema for additional participant data",
            ),
        ),
    ]

