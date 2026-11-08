# Mirrors django-oscar 4.2.1 order migrations 0019_order_analytics_tracked and
# 0020_alter_order_analytics_tracked: the column is added with default=True so
# every existing order is marked as already tracked (no duplicate analytics
# events when an old thank-you page is revisited), then the default is switched
# to False for new orders.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("order", "0026_salesperiod"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="analytics_tracked",
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name="order",
            name="analytics_tracked",
            field=models.BooleanField(default=False),
        ),
    ]
