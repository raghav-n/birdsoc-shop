from django.db import migrations, models


def populate_num_allocated(apps, schema_editor):
    Line = apps.get_model("order", "Line")
    for line in Line.objects.filter(num_allocated__isnull=True):
        line.num_allocated = line.quantity
        line.save(update_fields=["num_allocated"])


class Migration(migrations.Migration):

    dependencies = [
        ("order", "0023_auto"),
    ]

    operations = [
        # Step 1: Add fields as nullable / with default
        migrations.AddField(
            model_name="line",
            name="allocation_cancelled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="line",
            name="num_allocated",
            field=models.PositiveIntegerField(
                blank=True, null=True, verbose_name="Number allocated"
            ),
        ),
        # Step 2: Populate num_allocated from quantity
        migrations.RunPython(populate_num_allocated, migrations.RunPython.noop),
        # Step 3: Make num_allocated non-nullable
        migrations.AlterField(
            model_name="line",
            name="num_allocated",
            field=models.PositiveIntegerField(verbose_name="Number allocated"),
        ),
    ]
