"""
OBD 2026 feedback form: replace the guide rating with ratings for the
activities, lunch, talks and walk. Idempotent; skipped if the form is missing.
"""
from django.db import migrations

SLUG = "obd-2026-feedback"
NEW_RATINGS = [
    ("activities", "How would you rate the activities?"),
    ("lunch", "How would you rate the lunch?"),
    ("talks", "How would you rate the talks?"),
    ("walk", "How would you rate the walk?"),
]
ORDER = ["site", "overall", "activities", "lunch", "talks", "walk", "recommend", "highlight", "improve"]


def update_form(apps, schema_editor):
    Form = apps.get_model("form", "Form")
    FormField = apps.get_model("form", "FormField")

    form = Form.objects.filter(slug=SLUG).first()
    if form is None:
        return
    FormField.objects.filter(form=form, key="guide").delete()
    for key, label in NEW_RATINGS:
        FormField.objects.get_or_create(
            form=form, key=key, defaults={"label": label, "field_type": "rating", "required": False}
        )
    for field in FormField.objects.filter(form=form):
        field.order = ORDER.index(field.key) if field.key in ORDER else len(ORDER) + field.order
        field.save(update_fields=["order"])


class Migration(migrations.Migration):

    dependencies = [
        ("form", "0004_obd_2026_feedback_form"),
    ]

    operations = [
        migrations.RunPython(update_form, migrations.RunPython.noop),
    ]
