from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Form',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Name')),
                ('slug', models.SlugField(max_length=200, unique=True, verbose_name='Slug')),
                ('description', models.TextField(blank=True, verbose_name='Description')),
                ('is_active', models.BooleanField(default=True, verbose_name='Active')),
                ('accept_submissions', models.BooleanField(default=True, verbose_name='Accept submissions')),
                ('success_message', models.CharField(blank=True, default='Thanks for your response!', max_length=255, verbose_name='Success message')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Form',
                'verbose_name_plural': 'Forms',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='FormField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.SlugField(max_length=50, verbose_name='Key')),
                ('label', models.CharField(max_length=200, verbose_name='Label')),
                ('help_text', models.CharField(blank=True, max_length=255, verbose_name='Help text')),
                ('field_type', models.CharField(choices=[('text', 'Text'), ('textarea', 'Textarea'), ('email', 'Email'), ('number', 'Number'), ('date', 'Date'), ('select', 'Select'), ('multiselect', 'Multi-select'), ('checkbox', 'Checkbox')], default='text', max_length=20, verbose_name='Field type')),
                ('required', models.BooleanField(default=True, verbose_name='Required')),
                ('placeholder', models.CharField(blank=True, max_length=200, verbose_name='Placeholder')),
                ('default_value', models.CharField(blank=True, max_length=500, verbose_name='Default value')),
                ('choices', models.TextField(blank=True, help_text='One per line', verbose_name='Choices')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Order')),
                ('form', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fields', to='form.form')),
            ],
            options={
                'verbose_name': 'Form field',
                'verbose_name_plural': 'Form fields',
                'ordering': ['order', 'id'],
            },
        ),
        migrations.CreateModel(
            name='FormSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('submitter_ip', models.GenericIPAddressField(blank=True, null=True)),
                ('user_agent', models.CharField(blank=True, max_length=255)),
                ('data', models.JSONField(blank=True, default=dict)),
                ('form', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='submissions', to='form.form')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Form submission',
                'verbose_name_plural': 'Form submissions',
                'ordering': ['-submitted_at'],
            },
        ),
        migrations.AlterUniqueTogether(
            name='formfield',
            unique_together={('form', 'key')},
        ),
    ]

