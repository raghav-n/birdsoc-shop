from django.db import migrations


def split_merch_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    # Rename the existing Merchandise group to Merch Sales (preserves members),
    # then ensure all console groups exist.
    Group.objects.filter(name='Merchandise').update(name='Merch Sales')
    Group.objects.get_or_create(name='Merch Sales')
    Group.objects.get_or_create(name='Merch Management')
    Group.objects.get_or_create(name='Events')


def merge_merch_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Group.objects.filter(name='Merch Management').delete()
    Group.objects.filter(name='Merch Sales').update(name='Merchandise')


class Migration(migrations.Migration):

    dependencies = [
        ('event', '0025_event_lottery'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(split_merch_groups, reverse_code=merge_merch_groups),
    ]
