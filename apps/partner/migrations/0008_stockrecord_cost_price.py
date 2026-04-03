from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('partner', '0007_stockrecord_crossed_out_price'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockrecord',
            name='cost_price',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Cost price per unit (used for profit calculations in dashboard).',
                max_digits=12,
                null=True,
            ),
        ),
    ]
