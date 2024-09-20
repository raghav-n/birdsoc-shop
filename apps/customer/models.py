from django.db import models
from oscar.apps.customer.models import *


class EmailAlert(models.Model):
    email = models.EmailField(null=False)
