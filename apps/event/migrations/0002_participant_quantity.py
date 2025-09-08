from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("event", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="participant",
            name="quantity",
            field=models.PositiveIntegerField(
                default=1,
                help_text="Number of people this participant represents",
                verbose_name="Party Size",
            ),
        ),
    ]
