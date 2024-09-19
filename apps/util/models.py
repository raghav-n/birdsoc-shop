from django.db import models


class EmailAlert(models.Model):
    email = models.EmailField(null=False)
