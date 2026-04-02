from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogue", "0027_attributeoption_code_attributeoptiongroup_code_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="productimage",
            name="focal_point_x",
            field=models.PositiveSmallIntegerField(default=50),
        ),
        migrations.AddField(
            model_name="productimage",
            name="focal_point_y",
            field=models.PositiveSmallIntegerField(default=50),
        ),
    ]
