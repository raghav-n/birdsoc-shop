from django.db import models


class FAQItem(models.Model):
    question = models.CharField(max_length=500)
    answer = models.TextField(help_text="HTML is supported")
    position = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position"]
        verbose_name = "FAQ Item"
        verbose_name_plural = "FAQ Items"

    def __str__(self):
        return self.question
