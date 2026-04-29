from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0016_add_registration_required"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="max_qty",
            field=models.PositiveIntegerField(
                default=5,
                help_text="Maximum number of tickets a single registration can book",
                verbose_name="Max quantity per registration",
            ),
        ),
    ]
