from django.db import models
from django.utils.translation import gettext_lazy as _


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

    class Meta:
        ordering = ["-start_date"]
        verbose_name = _("Organized Event")
        verbose_name_plural = _("Organized Events")

    def __str__(self):
        return self.title

    @property
    def participant_count(self):
        """Returns the number of participants, accounting for quantity field"""
        # Sum all quantities from event participants
        return sum(
            ep.participant.quantity
            for ep in self.eventparticipant_set.select_related("participant").all()
        )

    @property
    def unique_participant_count(self):
        """Returns the number of unique participant records (ignoring quantity)"""
        return self.eventparticipant_set.count()

    @property
    def is_full(self):
        """Check if event has reached maximum participants"""
        if self.max_participants is None:
            return False
        return self.participant_count >= self.max_participants

    def add_participant(self, participant, **kwargs):
        """Add a participant to the event"""
        # Check if adding this participant would exceed the limit
        if self.max_participants is not None:
            current_count = self.participant_count
            if current_count + participant.quantity > self.max_participants:
                raise ValueError(
                    f"Cannot add participant. Only {self.max_participants - current_count} spots remaining, but participant requires {participant.quantity}."
                )

        # Check if the participant is already registered
        existing = EventParticipant.objects.filter(
            event=self, participant=participant
        ).exists()

        if existing:
            raise ValueError("Participant is already registered for this event.")

        return EventParticipant.objects.create(
            event=self, participant=participant, **kwargs
        )

    def remove_participant(self, participant):
        """Remove a participant from the event"""
        return EventParticipant.objects.filter(
            event=self, participant=participant
        ).delete()


class Participant(models.Model):
    """
    Model representing an event participant.
    This is deliberately separate from the User model.
    """

    first_name = models.CharField(_("First Name"), max_length=100)
    last_name = models.CharField(_("Last Name"), max_length=100)
    email = models.EmailField(_("Email"))
    phone_number = models.CharField(_("Phone Number"), max_length=20, blank=True)
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
        qty_str = f" (+{self.quantity-1})" if self.quantity > 1 else ""
        return f"{self.first_name} {self.last_name}{qty_str} ({self.email})"

    @property
    def full_name(self):
        qty_str = f" (+{self.quantity-1})" if self.quantity > 1 else ""
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
    attended = models.BooleanField(_("Attended"), default=False)
    notes = models.TextField(_("Notes"), blank=True)

    class Meta:
        verbose_name = _("Event Participant")
        verbose_name_plural = _("Event Participants")
        # Ensure a participant can only be registered once for an event
        unique_together = ["event", "participant"]

    def __str__(self):
        return f"{self.participant.full_name} - {self.event.title}"
