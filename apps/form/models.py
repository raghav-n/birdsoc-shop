import uuid

from django.db import models
from django.utils.text import slugify
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model


class Form(models.Model):
    name = models.CharField(_("Name"), max_length=200)
    slug = models.SlugField(_("Slug"), max_length=200, unique=True)
    description = models.TextField(_("Description"), blank=True)
    is_active = models.BooleanField(_("Active"), default=True)
    accept_submissions = models.BooleanField(
        _("Accept submissions"), default=True
    )
    success_message = models.CharField(
        _("Success message"), max_length=255, blank=True, default="Thanks for your response!"
    )
    # Feedback forms hang off an event group: its participants get personal
    # invite links, and responses are attributed to their booking and site.
    event_group = models.ForeignKey(
        "event.EventGroup",
        on_delete=models.SET_NULL,
        related_name="forms",
        null=True,
        blank=True,
        verbose_name=_("Event group"),
    )
    allow_anonymous = models.BooleanField(
        _("Allow anonymous responses"),
        default=True,
        help_text=_("Accept responses on the public link without a personal invite token."),
    )
    email_subject = models.CharField(_("Invite email subject"), max_length=255, blank=True)
    email_body = models.TextField(
        _("Invite email body"),
        blank=True,
        help_text=_("Plain text. Placeholders: {first_name}, {event}, {link}."),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = _("Form")
        verbose_name_plural = _("Forms")

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class FormField(models.Model):
    class FieldType(models.TextChoices):
        TEXT = "text", _("Text")
        TEXTAREA = "textarea", _("Textarea")
        EMAIL = "email", _("Email")
        NUMBER = "number", _("Number")
        DATE = "date", _("Date")
        SELECT = "select", _("Select")
        MULTISELECT = "multiselect", _("Multi-select")
        CHECKBOX = "checkbox", _("Checkbox")
        RATING = "rating", _("Rating (1-5)")
        SCALE = "scale", _("Scale (0-10)")

    form = models.ForeignKey(
        Form, on_delete=models.CASCADE, related_name="fields"
    )
    # Key used in submission payloads (unique per form)
    key = models.SlugField(_("Key"), max_length=50)
    label = models.CharField(_("Label"), max_length=200)
    help_text = models.CharField(_("Help text"), max_length=255, blank=True)
    field_type = models.CharField(
        _("Field type"), max_length=20, choices=FieldType.choices, default=FieldType.TEXT
    )
    required = models.BooleanField(_("Required"), default=True)
    display = models.BooleanField(_("Display"), default=True)
    placeholder = models.CharField(_("Placeholder"), max_length=200, blank=True)
    default_value = models.CharField(_("Default value"), max_length=500, blank=True)
    # For select-like fields: newline-separated options
    choices = models.TextField(_("Choices"), blank=True, help_text=_("One per line"))
    order = models.PositiveIntegerField(_("Order"), default=0)

    class Meta:
        unique_together = ("form", "key")
        ordering = ["order", "id"]
        verbose_name = _("Form field")
        verbose_name_plural = _("Form fields")

    def __str__(self) -> str:
        return f"{self.form.name}: {self.label}"

    def choices_list(self):
        if not self.choices:
            return []
        return [c.strip() for c in self.choices.splitlines() if c.strip()]


class FormInvite(models.Model):
    """A personal link to a form for one event booking (its main contact)."""

    form = models.ForeignKey(Form, on_delete=models.CASCADE, related_name="invites")
    event_participant = models.ForeignKey(
        "event.EventParticipant", on_delete=models.CASCADE, related_name="form_invites"
    )
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    emailed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ("form", "event_participant")
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"Invite to {self.form.name} for EP {self.event_participant_id}"


class FormSubmission(models.Model):
    form = models.ForeignKey(
        Form, on_delete=models.CASCADE, related_name="submissions"
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True, null=True)
    # Set when submitted through a personal link; resubmitting edits this row.
    invite = models.OneToOneField(
        FormInvite,
        on_delete=models.SET_NULL,
        related_name="submission",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        get_user_model(), on_delete=models.SET_NULL, null=True, blank=True
    )
    submitter_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    # Store submitted data keyed by FormField.key
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-submitted_at"]
        verbose_name = _("Form submission")
        verbose_name_plural = _("Form submissions")

    def __str__(self) -> str:
        return f"Submission #{self.pk} to {self.form.name}"
