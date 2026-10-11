"""
Create the October Big Day 2026 feedback form: one form for every site, with a
site dropdown. Idempotent: skipped if a form with the slug already exists.
Invites are not sent; that's done from the console.
"""
from django.db import migrations

SLUG = "obd-2026-feedback"
GROUP_SLUG = "october-big-day-2026"
TITLE_PREFIX = "October Big Day 2026: "
# Fallback if the group's events aren't in this database (same list as setup_obd_2026).
DEFAULT_SITES = [
    "Bidadari Park",
    "Bishan-AMK Park",
    "Thomson Nature Park",
    "Fort Canning Park",
    "Jurong Lake Gardens",
    "Singapore Botanic Gardens",
]

DESCRIPTION = (
    "Thank you for birding with us on October Big Day. Your feedback helps us "
    "plan next year's count. It takes about a minute."
)

QUESTIONS = [
    # (key, label, type, required, help_text, choices); None = the site list.
    ("site", "Which site did you join?", "select", True, "", None),
    ("overall", "Overall, how would you rate the day?", "rating", False, "", ""),
    ("guide", "How would you rate your guide?", "rating", False, "", ""),
    ("recommend", "How likely are you to recommend our events to a friend?", "scale", False, "", ""),
    ("highlight", "What did you enjoy most?", "textarea", False, "", ""),
    ("improve", "What could we do better next time?", "textarea", False, "", ""),
]


def create_form(apps, schema_editor):
    Form = apps.get_model("form", "Form")
    FormField = apps.get_model("form", "FormField")
    EventGroup = apps.get_model("event", "EventGroup")

    if Form.objects.filter(slug=SLUG).exists():
        return

    group = EventGroup.objects.filter(slug=GROUP_SLUG).first()
    sites = []
    if group:
        for event in group.events.order_by("title"):
            name = event.title[len(TITLE_PREFIX):] if event.title.startswith(TITLE_PREFIX) else event.title
            sites.append(name.strip())
    sites = sites or sorted(DEFAULT_SITES)

    form = Form.objects.create(
        name="October Big Day 2026 feedback",
        slug=SLUG,
        description=DESCRIPTION,
        event_group=group,
        is_active=True,
        accept_submissions=True,
        allow_anonymous=True,
        success_message="Thank you for your feedback, and for counting birds with us!",
    )
    for order, (key, label, field_type, required, help_text, choices) in enumerate(QUESTIONS):
        FormField.objects.create(
            form=form,
            key=key,
            label=label,
            field_type=field_type,
            required=required,
            help_text=help_text,
            choices="\n".join(sites) if choices is None else choices,
            order=order,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("form", "0003_feedback_invites"),
        ("event", "0036_checkpoints"),
    ]

    operations = [
        migrations.RunPython(create_form, migrations.RunPython.noop),
    ]
