from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0023_event_guide_token"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="blog_url",
            field=models.URLField(
                blank=True,
                null=True,
                help_text=(
                    "Optional URL of a blog post about this event on singaporebirds.com. "
                    "Set via the internal blog-link API."
                ),
                verbose_name="Blog post URL",
            ),
        ),
    ]
