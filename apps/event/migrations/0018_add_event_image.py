import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0017_add_max_qty"),
    ]

    operations = [
        migrations.CreateModel(
            name="EventImage",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False)),
                ("file", models.ImageField(upload_to="event_images/")),
                ("uploaded_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-uploaded_at"]},
        ),
        migrations.AddField(
            model_name="organizedevent",
            name="image",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="events",
                to="event.eventimage",
                verbose_name="Image",
            ),
        ),
    ]
