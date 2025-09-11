from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("form", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="formfield",
            name="display",
            field=models.BooleanField(default=True, verbose_name="Display"),
        ),
    ]

