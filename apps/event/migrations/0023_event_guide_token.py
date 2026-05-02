import uuid
from django.db import migrations, models


def assign_guide_tokens(apps, schema_editor):
    OrganizedEvent = apps.get_model('event', 'OrganizedEvent')
    for event in OrganizedEvent.objects.all():
        event.guide_token = uuid.uuid4()
        event.save(update_fields=['guide_token'])


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0022_registration_dates'),
    ]

    operations = [
        # Add non-unique first so existing rows can all receive a temporary value
        migrations.AddField(
            model_name='organizedevent',
            name='guide_token',
            field=models.UUIDField(
                default=uuid.uuid4,
                editable=False,
                verbose_name='Guide token',
                help_text='Token for no-login magic-link access to the participant list (for guides).',
            ),
        ),
        # Assign a unique UUID to every existing row
        migrations.RunPython(assign_guide_tokens, migrations.RunPython.noop),
        # Now add the unique constraint
        migrations.AlterField(
            model_name='organizedevent',
            name='guide_token',
            field=models.UUIDField(
                default=uuid.uuid4,
                unique=True,
                editable=False,
                verbose_name='Guide token',
                help_text='Token for no-login magic-link access to the participant list (for guides).',
            ),
        ),
    ]
