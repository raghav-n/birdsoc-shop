# Generated manually to set is_self_collect values for existing records

from django.db import migrations


def set_self_collect_values(apps, schema_editor):
    DynamicShippingMethod = apps.get_model("shipping", "DynamicShippingMethod")
    
    # Set is_self_collect=True for self-collection methods
    # Based on the method codes that contain "SELFCOLLECT" in their name
    DynamicShippingMethod.objects.filter(
        code__icontains="SELFCOLLECT"
    ).update(is_self_collect=True)
    
    # Ensure other methods are set to False (this should already be the default)
    DynamicShippingMethod.objects.filter(
        is_self_collect__isnull=True
    ).update(is_self_collect=False)


def reverse_set_self_collect_values(apps, schema_editor):
    # In case we need to reverse this migration, reset all to False
    DynamicShippingMethod = apps.get_model("shipping", "DynamicShippingMethod")
    DynamicShippingMethod.objects.all().update(is_self_collect=False)


class Migration(migrations.Migration):

    dependencies = [
        ("shipping", "0009_dynamicshippingmethod_available_to_public_and_more"),
    ]

    operations = [
        migrations.RunPython(set_self_collect_values, reverse_set_self_collect_values),
    ]
