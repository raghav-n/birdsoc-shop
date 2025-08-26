from django import forms
from .models import OrganizedEvent, Participant, EventParticipant


class EventForm(forms.ModelForm):
    class Meta:
        model = OrganizedEvent
        fields = [
            "title",
            "description",
            "start_date",
            "end_date",
            "location",
            "max_participants",
            "price_incl_tax",
            "currency",
            "is_active",
        ]
        widgets = {
            "start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "end_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
        }


class ParticipantForm(forms.ModelForm):
    class Meta:
        model = Participant
        fields = ["first_name", "last_name", "email", "phone_number", "quantity"]
        help_texts = {
            "quantity": "Number of people this participant represents (including themselves)"
        }
        widgets = {"quantity": forms.NumberInput(attrs={"min": "1", "max": "50"})}


class EventParticipantForm(forms.ModelForm):
    class Meta:
        model = EventParticipant
        fields = ["participant", "attended", "notes"]


class ParticipantAddForm(forms.Form):
    """Form for adding an existing participant to an event"""

    participant = forms.ModelChoiceField(
        queryset=Participant.objects.all(), label="Participant"
    )


class NewParticipantForm(ParticipantForm):
    """Form for creating and adding a new participant to an event"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs["class"] = "form-control"
