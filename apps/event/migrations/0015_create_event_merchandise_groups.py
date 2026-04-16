from django.db import migrations


def create_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.get_or_create(name='Events')
    Group.objects.get_or_create(name='Merchandise')


def remove_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name__in=['Events', 'Merchandise']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0014_add_eventparticipant_is_cancelled'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(create_groups, reverse_code=remove_groups),
    ]
