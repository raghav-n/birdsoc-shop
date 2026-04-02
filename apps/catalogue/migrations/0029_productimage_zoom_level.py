from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogue", "0028_productimage_focal_point"),
    ]

    operations = [
        migrations.AddField(
            model_name="productimage",
            name="zoom_level",
            field=models.FloatField(default=1.0),
        ),
    ]
