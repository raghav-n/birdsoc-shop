from django.db import models
from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from decimal import Decimal, InvalidOperation

import json
import jsonschema


class EventImage(models.Model):
    file = models.ImageField(upload_to="event_images/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-uploaded_at"]


class OrganizedEvent(models.Model):
    """
    Model representing an organized event.
    """

    title = models.CharField(_("Event Title"), max_length=255)
    description = models.TextField(_("Description"), blank=True)
    start_date = models.DateTimeField(_("Start Date/Time"))
    end_date = models.DateTimeField(_("End Date/Time"), blank=True, null=True)
    location = models.CharField(_("Location"), max_length=255, blank=True)
    max_participants = models.PositiveIntegerField(
        _("Maximum Participants"), blank=True, null=True
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)
    updated_at = models.DateTimeField(_("Updated At"), auto_now=True)
    is_active = models.BooleanField(_("Active"), default=True)
    price_incl_tax = models.DecimalField(
        _("Price (incl tax)"), max_digits=12, decimal_places=2, default=0
    )
    currency = models.CharField(_("Currency"), max_length=8, default="SGD")
    json_schema = models.JSONField(
        _("JSON schema"),
        blank=True,
        null=True,
        help_text=_("Optional JSON schema for additional participant data"),
    )
    price_tiers = models.JSONField(
        _("Price Tiers"),
        blank=True,
        null=True,
        help_text=_(
            "Optional list of price tier rules. Example: "
            '[{"code":"student","name":"Under 19","rule":"age:<19","price_incl_tax":10.0}, {"code":"adult","name":"Adult","rule":"*","price_incl_tax":15.0}]'
        ),
    )
    max_qty = models.PositiveIntegerField(
        _("Max quantity per registration"),
        default=5,
        help_text=_("Maximum number of tickets a single registration can book"),
    )
    image = models.ForeignKey(
        "EventImage",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="events",
        verbose_name=_("Image"),
    )
    validate_participant_data = models.BooleanField(
        _("Validate participant data"),
        default=False,
        help_text=_(
            "If true, participant data will be validated against the JSON schema"
        ),
    )
    registration_required = models.BooleanField(
        _("Registration required"),
        default=True,
        help_text=_(
            "If false, the event page shows info only with no registration form"
        ),
    )
    confirmed_email_template = models.TextField(
        _("Payment Confirmation Email Template"),
        blank=True,
        null=True,
        help_text=_(
            "HTML email template sent when payment is confirmed. Available variables: {{first_name}}, {{last_name}}, {{email}}, {{phone_number}}, {{quantity}}, {{event_title}}, {{event_date}}, {{event_location}}, {{amount}}, {{currency}}, {{participant_details}}"
        ),
    )
    post_registration_message = models.TextField(
        _("Post-registration message"),
        blank=True,
        null=True,
        help_text=_(
            "Custom message shown on the confirmation page after a participant registers (plain text or simple HTML)."
        ),
    )
    tags = models.JSONField(
        _("Tags"),
        blank=True,
        null=True,
        default=list,
        help_text=_("List of tag strings for categorising this event"),
    )
    registration_open = models.BooleanField(
        _("Registration open"),
        default=True,
        help_text=_(
            "When unchecked, the registration form is closed even if the event is active. "
            "Use this to manually pause registrations for a specific event."
        ),
    )
    waitlist_enabled = models.BooleanField(
        _("Waitlist enabled"),
        default=False,
        help_text=_(
            "When enabled, users can join a waiting list when the event is full."
        ),
    )
    registration_start = models.DateTimeField(
        _("Registration start"),
        blank=True,
        null=True,
        help_text=_(
            "If set, registration opens at this date/time. Before this, registration is closed regardless of the manual toggle."
        ),
    )
    registration_end = models.DateTimeField(
        _("Registration end"),
        blank=True,
        null=True,
        help_text=_(
            "If set, registration closes at this date/time. After this, registration is closed regardless of the manual toggle."
        ),
    )

    class Meta:
        ordering = ["-start_date"]
        verbose_name = _("Organized Event")
        verbose_name_plural = _("Organized Events")

    def __str__(self):
        return self.title

    @property
    def is_registration_open(self):
        if not self.registration_open:
            return False
        now = timezone.now()
        if self.registration_start and now < self.registration_start:
            return False
        if self.registration_end and now > self.registration_end:
            return False
        return True

    @property
    def participant_count(self):
        """Returns number of confirmed participants (sum of quantities)."""
        return sum(
            ep.participant.quantity
            for ep in self.eventparticipant_set.select_related("participant")
            .filter(is_confirmed=True, is_cancelled=False)
            .all()
        )

    @property
    def unique_participant_count(self):
        """Returns the number of unique participant records (ignoring quantity)"""
        return self.eventparticipant_set.count()

    @property
    def pending_count(self):
        """Count of reserved (pending payment) participants."""
        # Sum quantities of pending registrations whose EventParticipant is not cancelled
        qs = self.eventregistration_set.select_related("participant").filter(
            status="pending"
        )
        # Exclude participants explicitly cancelled for this event
        qs = qs.exclude(
            participant__eventparticipant__event=self,
            participant__eventparticipant__is_cancelled=True,
        )
        return sum(r.participant.quantity for r in qs)

    @property
    def is_full(self):
        """True if event reached max participants including pending."""
        if self.max_participants is None:
            return False
        return (self.participant_count + self.pending_count) >= self.max_participants

    @property
    def waitlist_count(self):
        """Number of non-cancelled waitlisted entries."""
        return self.eventparticipant_set.filter(is_waitlisted=True, is_cancelled=False).count()

    def add_participant(self, participant, **kwargs):
        """Add a participant to the event"""
        # Check if adding this participant would exceed the limit
        if self.json_schema and self.validate_participant_data:
            extra = kwargs.get("extra_json")
            if not extra:
                raise ValueError("Missing extra_json for participant data validation.")

            try:
                schema = (
                    json.loads(self.json_schema)
                    if isinstance(self.json_schema, str)
                    else self.json_schema
                )
            except json.JSONDecodeError:
                raise ValueError("Invalid JSON schema configured.")

            items = extra if isinstance(extra, list) else [extra]
            for item in items:
                try:
                    jsonschema.validate(instance=item, schema=schema)
                except jsonschema.ValidationError:
                    raise ValueError("Participant data is invalid.")

        if self.max_participants is not None:
            current_count = self.participant_count
            if current_count + participant.quantity > self.max_participants:
                raise ValueError(
                    f"Cannot add participant. Only {self.max_participants - current_count} spots remaining, but participant requires {participant.quantity}."
                )

        # Allow duplicate emails

        return EventParticipant.objects.create(
            event=self, participant=participant, **kwargs
        )

    def remove_participant(self, participant):
        """Remove a participant from the event"""
        return EventParticipant.objects.filter(
            event=self, participant=participant
        ).delete()

    # ----- Pricing helpers: lightweight JSON-configured tiers -----
    def _coerce_decimal(self, value, default: Decimal) -> Decimal:
        try:
            return Decimal(str(value))
        except (InvalidOperation, TypeError, ValueError):
            return default

    def _match_rule(self, rule: str, extra: dict) -> bool:
        """
        Very simple matcher supporting patterns like:
        - "*" → always matches
        - "age:<19"  (operators: <, <=, >, >=, ==)
        Values are compared numerically if possible, else string compare for ==.
        """
        if not rule or rule == "*":
            return True
        if ":" not in rule:
            return False
        field, cond = rule.split(":", 1)
        field = field.strip()
        cond = cond.strip()
        if not isinstance(extra, dict):
            return False
        if field not in extra:
            return False
        val = extra.get(field)

        # Determine operator and threshold
        ops = ["<=", ">=", "<", ">", "=="]
        op = None
        threshold = cond
        for candidate in ops:
            if cond.startswith(candidate):
                op = candidate
                threshold = cond[len(candidate) :].strip()
                break
        # Support legacy style like "<19" (missing == prefix for equality not used)
        if op is None and cond and cond[0] in ("<", ">"):
            op = cond[0]
            threshold = cond[1:].strip()

        # Try numeric comparison when op involves ordering
        if op in ("<", ">", "<=", ">="):
            try:
                val_num = float(val)
                thr_num = float(threshold)
            except Exception:
                return False
            if op == "<":
                return val_num < thr_num
            if op == ">":
                return val_num > thr_num
            if op == "<=":
                return val_num <= thr_num
            if op == ">=":
                return val_num >= thr_num
        elif op == "==":
            return str(val) == threshold
        else:
            # No operator recognized; exact match on string
            return str(val) == threshold

    def get_unit_price_from_tiers(self, extra_json: dict) -> Decimal:
        """
        Resolve unit price using price_tiers rules. Falls back to event.price_incl_tax.
        Tiers are checked in list order; the first matching rule wins.
        """
        fallback = self.price_incl_tax or Decimal("0")
        tiers = self.price_tiers or []
        if not tiers:
            return fallback
        if isinstance(tiers, dict):
            # Allow a map, but prefer list; treat dict as {code: {rule, price_incl_tax}}
            tiers = [
                dict({"code": code}, **cfg)
                for code, cfg in tiers.items()
                if isinstance(cfg, dict)
            ]
        for tier in tiers:
            rule = tier.get("rule")
            if self._match_rule(str(rule or "*"), extra_json or {}):
                return self._coerce_decimal(tier.get("price_incl_tax"), fallback)
        return fallback


class Participant(models.Model):
    """
    Model representing an event participant.
    This is deliberately separate from the User model.
    """

    first_name = models.CharField(_("First Name"), max_length=100)
    last_name = models.CharField(_("Last Name"), max_length=100)
    email = models.EmailField(_("Email"))
    phone_number = models.CharField(_("Phone Number"), max_length=20, blank=True)
    emergency_contact_name = models.CharField(
        _("Emergency Contact Name"), max_length=200, blank=True
    )
    emergency_contact_phone = models.CharField(
        _("Emergency Contact Phone"), max_length=20, blank=True
    )
    quantity = models.PositiveIntegerField(
        _("Party Size"),
        default=1,
        help_text=_("Number of people this participant represents"),
    )
    created_at = models.DateTimeField(_("Created At"), auto_now_add=True)

    class Meta:
        ordering = ["last_name", "first_name"]
        verbose_name = _("Participant")
        verbose_name_plural = _("Participants")

    def __str__(self):
        qty_str = f" (+{self.quantity - 1})" if self.quantity > 1 else ""
        return f"{self.first_name} {self.last_name}{qty_str} ({self.email})"

    @property
    def full_name(self):
        qty_str = f" (+{self.quantity - 1})" if self.quantity > 1 else ""
        return f"{self.first_name} {self.last_name}{qty_str}"

    def get_events(self):
        """Return all events this participant is registered for"""
        return OrganizedEvent.objects.filter(eventparticipant__participant=self)


class EventParticipant(models.Model):
    """
    Through model connecting a participant to an event.
    Allows tracking additional information about participation.
    """

    event = models.ForeignKey(OrganizedEvent, on_delete=models.CASCADE)
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE)
    registered_at = models.DateTimeField(_("Registered At"), auto_now_add=True)
    is_confirmed = models.BooleanField(_("Confirmed"), default=False)
    is_cancelled = models.BooleanField(_("Cancelled"), default=False)
    is_main_contact = models.BooleanField(
        _("Main Contact"),
        default=True,
        help_text=_("Only main contacts receive payment confirmation emails"),
    )
    is_waitlisted = models.BooleanField(_("On waitlist"), default=False)
    attended = models.BooleanField(_("Attended"), default=False)
    notes = models.TextField(_("Notes"), blank=True)
    extra_json = models.JSONField(_("Extra data"), blank=True, null=True)

    class Meta:
        verbose_name = _("Event Participant")
        verbose_name_plural = _("Event Participants")
        # Ensure a participant can only be registered once for an event
        unique_together = ["event", "participant"]

    def __str__(self):
        return f"{self.participant.full_name} - {self.event.title}"


class EventRegistration(models.Model):
    """
    Paid registration record for events, separate from Oscar orders/basket.
    """

    STATUS_CHOICES = (
        ("pending", "Pending payment"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    )

    event = models.ForeignKey(OrganizedEvent, on_delete=models.CASCADE)
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    # Optional donation top-up for this single registration
    donation_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="SGD")
    reference = models.CharField(max_length=64, unique=True)
    emergency_contact_name = models.CharField(
        _("Emergency Contact Name"), max_length=200, blank=True
    )
    emergency_contact_phone = models.CharField(
        _("Emergency Contact Phone"), max_length=20, blank=True
    )
    # Optional link to a group registration
    group = models.ForeignKey(
        "event.EventRegistrationGroup",
        on_delete=models.CASCADE,
        related_name="registrations",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    payment_verified = models.BooleanField(default=False)
    payment_verified_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    payment_verified_on = models.DateTimeField(null=True, blank=True)
    from apps.payment.models import get_payment_proof_path

    payment_proof = models.ImageField(null=True, upload_to=get_payment_proof_path)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"EVREG-{self.id} {self.event.title} ({self.status})"

    def verify(self, user=None):
        """Mark payment as verified and confirm the participant's slot."""
        from django.utils import timezone

        if self.payment_verified:
            return True
        self.payment_verified = True
        self.status = "paid"
        self.payment_verified_by = user
        self.payment_verified_on = timezone.now()
        self.save()

        # Confirm the EventParticipant and ensure it's not cancelled
        EventParticipant.objects.filter(
            event=self.event, participant=self.participant
        ).update(is_confirmed=True, is_cancelled=False)

        # Only send individual payment confirmation email if this is NOT part of a group
        # Group payments are handled separately by the group's verify() method
        if not self.group:
            from .utils import send_payment_confirmation_email

            send_payment_confirmation_email(self)

        return True


class EventRegistrationGroup(models.Model):
    """
    A group registration/payment that covers multiple EventRegistration rows.
    Allows one payer to register and pay for multiple participants in one shot.
    """

    STATUS_CHOICES = (
        ("pending", "Pending payment"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    )

    event = models.ForeignKey(OrganizedEvent, on_delete=models.CASCADE)
    payer_name = models.CharField(_("Payer Name"), max_length=255, blank=True)
    payer_email = models.EmailField(_("Payer Email"), blank=True)
    payer_phone = models.CharField(_("Payer Phone"), max_length=32, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    amount_total = models.DecimalField(max_digits=12, decimal_places=2)
    # Optional donation top-up that applies to the whole group
    donation_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=8, default="SGD")
    reference = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    payment_verified = models.BooleanField(default=False)
    payment_verified_by = models.ForeignKey(
        to=settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    payment_verified_on = models.DateTimeField(null=True, blank=True)
    from apps.payment.models import get_payment_proof_path as _grp_payment_path

    payment_proof = models.ImageField(null=True, upload_to=_grp_payment_path)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"EVG-{self.id} {self.event.title} ({self.status})"

    def verify(self, user=None):
        """Mark group payment as verified and confirm all linked registrations/participants."""
        from django.utils import timezone

        if self.payment_verified:
            return True

        # Verify all child registrations (without sending individual emails)
        for reg in self.registrations.select_related("event", "participant").all():
            if not reg.payment_verified:
                reg.payment_verified = True
                reg.status = "paid"
                reg.payment_verified_by = user
                reg.payment_verified_on = timezone.now()
                reg.save()

                # Confirm the EventParticipant (clear cancelled bit)
                EventParticipant.objects.filter(
                    event=reg.event, participant=reg.participant
                ).update(is_confirmed=True, is_cancelled=False)

        self.payment_verified = True
        self.status = "paid"
        self.payment_verified_by = user
        self.payment_verified_on = timezone.now()
        self.save()

        # Send single group confirmation email to the payer
        from .utils import send_group_payment_confirmation_emails

        send_group_payment_confirmation_emails(self)

        return True

    @property
    def paid_for(self):
        """Return all Participants linked to this payment group."""
        return self.registrations.select_related("participant").values_list(
            "participant__first_name", "participant__last_name"
        )
