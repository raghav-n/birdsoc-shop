from django.db import migrations, models
from django.utils import timezone
from django.utils.text import slugify


def _slug_for(event):
    date_part = ""
    if event.start_date:
        dt = event.start_date
        if timezone.is_aware(dt):
            dt = timezone.localtime(dt)
        date_part = dt.strftime("%Y-%m-%d")
    return slugify(f"{date_part} {event.title}".strip())[:280] or "event"


def backfill_slugs(apps, schema_editor):
    OrganizedEvent = apps.get_model("event", "OrganizedEvent")
    used = set()
    # Oldest first so the un-suffixed slug goes to the earliest-created event.
    for event in OrganizedEvent.objects.order_by("pk").iterator():
        base = _slug_for(event)
        slug = base
        n = 2
        while slug in used or OrganizedEvent.objects.filter(slug=slug).exclude(pk=event.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        used.add(slug)
        event.slug = slug
        event.save(update_fields=["slug"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("event", "0029_organizedevent_lottery_lost_email_subject_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="organizedevent",
            name="slug",
            # db_index=False on the interim field: SlugField indexes by default,
            # and the later unique=True AlterField recreates that index — without
            # this the pattern-ops index would collide on apply.
            field=models.SlugField(max_length=300, null=True, db_index=False),
        ),
        migrations.RunPython(backfill_slugs, noop),
        migrations.AlterField(
            model_name="organizedevent",
            name="slug",
            field=models.SlugField(
                blank=True,
                help_text=(
                    "URL-friendly identifier used in public event links. Generated once "
                    "from the start date and title when the event is first created, and "
                    "left unchanged afterwards so existing links keep working."
                ),
                max_length=300,
                unique=True,
                verbose_name="Slug",
            ),
        ),
    ]
