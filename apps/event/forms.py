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
            "json_schema",
            "price_tiers",
            "validate_participant_data",
            "price_incl_tax",
            "currency",
            "is_active",
        ]
        widgets = {
            "start_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            "end_date": forms.DateTimeInput(attrs={"type": "datetime-local"}),
            # Allow editing JSON comfortably
            "json_schema": forms.Textarea(attrs={"rows": 6, "spellcheck": "false", "placeholder": "{}"}),
            "price_tiers": forms.Textarea(attrs={"rows": 6, "spellcheck": "false", "placeholder": "{}"}),
        }

    def clean(self):
        cleaned = super().clean()
        schema_val = cleaned.get("json_schema")
        should_validate = cleaned.get("validate_participant_data")

        # Normalize schema: accept dict/list or JSON string
        if schema_val in (None, ""):
            if should_validate:
                self.add_error(
                    "json_schema",
                    "JSON schema is required when validation is enabled.",
                )
        elif isinstance(schema_val, str):
            import json
            try:
                cleaned["json_schema"] = json.loads(schema_val)
            except Exception as e:
                self.add_error("json_schema", f"Invalid JSON: {e}")
        elif isinstance(schema_val, (dict, list)):
            # OK
            pass
        else:
            self.add_error("json_schema", "Invalid type for JSON schema.")

        return cleaned


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
