from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.http import JsonResponse
from django.views.generic import (
    ListView,
    DetailView,
    CreateView,
    UpdateView,
    DeleteView,
    FormView,
)
from django.views.generic.detail import SingleObjectMixin
from django.views import View
import csv
import io
from django.http import HttpResponseRedirect
from django.views.generic.edit import FormMixin
from django.core.mail import send_mail
from django.conf import settings

from django import forms

from apps.event.models import OrganizedEvent, Participant, EventParticipant
from apps.event.forms import (
    EventForm,
    ParticipantForm,
    ParticipantAddForm,
    NewParticipantForm,
)

from django.template.loader import render_to_string


# Create a custom dashboard mixin to replace the missing one
class DashboardMixin(LoginRequiredMixin, PermissionRequiredMixin):
    permission_required = ["is_staff"]

    def has_permission(self):
        # Allow access to staff users regardless of specific permissions
        return self.request.user.is_staff


class EventListView(DashboardMixin, ListView):
    model = OrganizedEvent
    context_object_name = "events"
    template_name = "dashboard/event/event_list.html"
    paginate_by = 20


class EventDetailView(DashboardMixin, DetailView):
    model = OrganizedEvent
    context_object_name = "event"
    template_name = "dashboard/event/event_detail.html"


class EventCreateView(DashboardMixin, CreateView):
    model = OrganizedEvent
    form_class = EventForm
    template_name = "dashboard/event/event_form.html"

    def get_success_url(self):
        return reverse("event-dashboard:event-detail", kwargs={"pk": self.object.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = "Create New Event"
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(
            self.request, f"Event '{self.object.title}' created successfully"
        )
        return response


class CSVImportForm(forms.Form):
    """Form for importing participants from CSV"""

    csv_file = forms.FileField(
        label="CSV File",
        help_text="CSV file should have headers: Email, First Name, Last Name, Quantity, Cell Phone",
    )


class EventUpdateView(DashboardMixin, UpdateView):
    model = OrganizedEvent
    form_class = EventForm
    template_name = "dashboard/event/event_form.html"

    def get_success_url(self):
        return reverse("event-dashboard:event-detail", kwargs={"pk": self.object.pk})

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = f"Update Event: {self.object.title}"
        ctx["import_form"] = CSVImportForm()  # Add the import form to context
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(
            self.request, f"Event '{self.object.title}' updated successfully"
        )
        return response

    def post(self, request, *args, **kwargs):
        # If CSV import form was submitted
        if "csv_file" in request.FILES:
            self.object = self.get_object()
            csv_import_form = CSVImportForm(request.POST, request.FILES)

            if csv_import_form.is_valid():
                return self.import_from_csv(request)
            else:
                # If CSV form not valid, still show the event form
                form = self.get_form()
                return self.render_to_response(self.get_context_data(form=form))

        # Regular form submission for event update
        return super().post(request, *args, **kwargs)

    def import_from_csv(self, request):
        """Import participants from CSV file"""
        csv_file = request.FILES["csv_file"]
        event = self.object

        # Initialize counters for report
        created_count = 0
        error_count = 0
        errors = []

        # Process the CSV file
        try:
            # Read the CSV file
            csv_data = csv_file.read().decode("utf-8")
            csv_reader = csv.DictReader(io.StringIO(csv_data))

            # Validate headers
            required_headers = [
                "Email",
                "First Name",
                "Last Name",
                "Quantity",
                "Cell Phone",
            ]
            csv_headers = csv_reader.fieldnames

            # Check if all required headers exist
            if not all(header in csv_headers for header in required_headers):
                messages.error(
                    request,
                    f"CSV file must contain headers: {', '.join(required_headers)}. Found: {', '.join(csv_headers)}",
                )
                return HttpResponseRedirect(self.get_success_url())

            # Process each row in the CSV
            for row in csv_reader:
                try:
                    # Validate email and skip rows with invalid emails
                    email = row["Email"].strip()

                    if not email or "@" not in email:
                        error_count += 1
                        errors.append(
                            f"Skipping row: Invalid or missing email: '{email}'"
                        )
                        continue

                    first_name = row["First Name"].strip()
                    last_name = row["Last Name"].strip()
                    phone = row.get("Cell Phone", "").strip()

                    # Handle quantity field - default to 1 if not provided or invalid
                    try:
                        quantity = int(row["Quantity"].strip())
                        if quantity < 1:
                            quantity = 1
                    except (ValueError, AttributeError):
                        quantity = 1

                    # Try to find existing participant or create a new one
                    # We'll create a single participant with the quantity field
                    participant, created = Participant.objects.get_or_create(
                        email=email,
                        defaults={
                            "first_name": first_name,
                            "last_name": last_name,
                            "phone_number": phone,
                            "quantity": quantity,
                        },
                    )

                    # If participant existed but with different quantity, update it
                    if not created and participant.quantity != quantity:
                        participant.quantity = quantity
                        participant.save()

                    # Try to add participant to the event
                    try:
                        event.add_participant(participant)
                        created_count += 1
                    except ValueError as e:
                        # Participant already registered for this event
                        # We'll consider this a successful import since the participant exists
                        pass

                except Exception as e:
                    error_count += 1
                    errors.append(
                        f"Error in row ({row.get('Email', 'Unknown')}): {str(e)}"
                    )

            # Show success/error messages
            if created_count > 0:
                messages.success(
                    request, f"Successfully imported {created_count} participants."
                )

            if error_count > 0:
                error_message = f"Encountered {error_count} errors during import."
                if errors:
                    # Show first 5 errors
                    error_examples = "; ".join(errors[:5])
                    if len(errors) > 5:
                        error_examples += f"; and {len(errors) - 5} more errors."
                    error_message += f" Examples: {error_examples}"

                messages.error(request, error_message)

        except Exception as e:
            messages.error(request, f"Error processing CSV file: {str(e)}")

        return HttpResponseRedirect(self.get_success_url())


class EventDeleteView(DashboardMixin, DeleteView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_confirm_delete.html"
    success_url = reverse_lazy("event-dashboard:event-list")

    def delete(self, request, *args, **kwargs):
        event = self.get_object()
        event_title = event.title
        response = super().delete(request, *args, **kwargs)
        messages.success(request, f"Event '{event_title}' deleted successfully")
        return response


# Participant Views
class ParticipantListView(DashboardMixin, ListView):
    model = Participant
    context_object_name = "participants"
    template_name = "dashboard/event/participant_list.html"
    paginate_by = 20


class ParticipantDetailView(DashboardMixin, DetailView):
    model = Participant
    context_object_name = "participant"
    template_name = "dashboard/event/participant_detail.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # Get events and inject attendance status directly
        events_with_attendance = []

        for event in self.object.get_events():
            # Get the corresponding EventParticipant
            event_participant = EventParticipant.objects.filter(
                event=event, participant=self.object
            ).first()

            # Add attendance status to the event object
            event.attendance_status = (
                event_participant.attended if event_participant else False
            )
            events_with_attendance.append(event)

        context["events"] = events_with_attendance
        return context


class ParticipantCreateView(DashboardMixin, CreateView):
    model = Participant
    form_class = ParticipantForm
    template_name = "dashboard/event/participant_form.html"

    def get_success_url(self):
        return reverse(
            "event-dashboard:participant-detail", kwargs={"pk": self.object.pk}
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = "Create New Participant"
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(
            self.request, f"Participant '{self.object.full_name}' created successfully"
        )
        return response


class ParticipantUpdateView(DashboardMixin, UpdateView):
    model = Participant
    form_class = ParticipantForm
    template_name = "dashboard/event/participant_form.html"

    def get_success_url(self):
        return reverse(
            "event-dashboard:participant-detail", kwargs={"pk": self.object.pk}
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["title"] = f"Update Participant: {self.object.full_name}"
        return ctx

    def form_valid(self, form):
        response = super().form_valid(form)
        messages.success(
            self.request, f"Participant '{self.object.full_name}' updated successfully"
        )
        return response


class ParticipantDeleteView(DashboardMixin, DeleteView):
    model = Participant
    template_name = "dashboard/event/participant_confirm_delete.html"
    success_url = reverse_lazy("event-dashboard:participant-list")

    def delete(self, request, *args, **kwargs):
        participant = self.get_object()
        participant_name = participant.full_name
        response = super().delete(request, *args, **kwargs)
        messages.success(
            request, f"Participant '{participant_name}' deleted successfully"
        )
        return response


# Event-Participant Management Views
class EventParticipantAddView(DashboardMixin, SingleObjectMixin, FormView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_participant_form.html"
    form_class = ParticipantAddForm

    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        context = super().get_context_data(**kwargs)
        context["event"] = self.object
        context["title"] = f"Add Existing Participant to '{self.object.title}'"
        return context

    def form_valid(self, form):
        event = self.get_object()
        participant = form.cleaned_data["participant"]

        try:
            event.add_participant(participant)
            messages.success(
                self.request, f"Added {participant.full_name} to {event.title}"
            )
        except ValueError as e:
            messages.error(self.request, str(e))

        return redirect("event-dashboard:event-detail", pk=event.pk)


class EventParticipantCreateView(DashboardMixin, SingleObjectMixin, FormView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_participant_create_form.html"
    form_class = NewParticipantForm

    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        context = super().get_context_data(**kwargs)
        context["event"] = self.object
        context["title"] = f"Create & Add New Participant to '{self.object.title}'"
        return context

    def form_valid(self, form):
        event = self.get_object()
        participant = form.save()

        try:
            event.add_participant(participant)
            messages.success(
                self.request,
                f"Created and added {participant.full_name} to {event.title}",
            )
        except ValueError as e:
            messages.error(self.request, str(e))

        return redirect("event-dashboard:event-detail", pk=event.pk)


class EventParticipantRemoveView(DashboardMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        event = get_object_or_404(OrganizedEvent, pk=kwargs["event_pk"])
        participant = get_object_or_404(Participant, pk=kwargs["pk"])

        try:
            result = event.remove_participant(participant)
            if result[0] > 0:  # If participants were removed
                messages.success(
                    request, f"Removed {participant.full_name} from {event.title}"
                )
                return JsonResponse(
                    {
                        "status": "success",
                        "message": f"Removed {participant.full_name} from {event.title}",
                    }
                )
            else:
                return JsonResponse(
                    {
                        "status": "error",
                        "message": f"{participant.full_name} was not registered for this event",
                    },
                    status=400,
                )
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=500)


class BatchEmailForm(forms.Form):
    subject = forms.CharField(max_length=255, required=True)
    message = forms.CharField(widget=forms.Textarea, required=True)
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['message'].help_text = (
            "You can use the following variables: {{first_name}}, {{last_name}}, "
            "{{email}}, {{phone_number}}, {{event_title}}, {{event_date}}, {{event_location}}"
        )


class EventBatchEmailView(DashboardMixin, SingleObjectMixin, FormView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_batch_email.html"
    form_class = BatchEmailForm
    
    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        context = super().get_context_data(**kwargs)
        context["event"] = self.object
        context["participant_count"] = self.object.eventparticipant_set.count()
        return context
    
    def form_valid(self, form):
        event = self.get_object()
        subject = form.cleaned_data['subject']
        message_template = form.cleaned_data['message']
        
        # Get all participants for this event
        event_participants = event.eventparticipant_set.all()
        
        # Keep track of successful and failed emails
        successful = 0
        failed = 0
        
        for ep in event_participants:
            participant = ep.participant
            
            # Create context for template variables
            context = {
                'first_name': participant.first_name,
                'last_name': participant.last_name,
                'email': participant.email,
                'phone_number': participant.phone_number or "",
                'event_title': event.title,
                'event_date': event.start_date.strftime('%B %d, %Y'),
                'event_location': event.location or "TBD",
            }
            
            # Replace template variables in the message
            personalized_message = message_template
            for key, value in context.items():
                personalized_message = personalized_message.replace(f"{{{{{key}}}}}", str(value))
            
            # Create context for the email template
            email_context = {
                'subject': subject,
                'message': personalized_message,
                'participant': participant,
                'event': event,
            }
            
            try:
                # Render HTML email using the base template
                html_message = render_to_string('dashboard/event/email/batch_email.html', email_context)
                # Create plain text version by stripping HTML
                from django.utils.html import strip_tags
                plain_message = strip_tags(personalized_message)
                
                # Send the email with both HTML and plain text versions
                send_mail(
                    subject,
                    plain_message,  # Plain text fallback
                    settings.DEFAULT_FROM_EMAIL,
                    [participant.email],  # Send to actual participant email
                    html_message=html_message,  # HTML version
                    fail_silently=False,
                )
                successful += 1
            except Exception as e:
                failed += 1
                # Log the error
                print(f"Failed to send email to {participant.email}: {str(e)}")
            
            # Remove the break statement that was stopping the loop after first participant
        
        if failed > 0:
            messages.warning(
                self.request, 
                f"Sent {successful} emails successfully, but {failed} emails failed to send."
            )
        else:
            messages.success(
                self.request, 
                f"Successfully sent emails to all {successful} participants."
            )
        
        return redirect('event-dashboard:event-detail', pk=event.pk)


class EventBatchEmailPreviewView(DashboardMixin, View):
    """View for previewing batch emails before sending"""
    
    def post(self, request, *args, **kwargs):
        event = get_object_or_404(OrganizedEvent, pk=kwargs.get('pk'))
        subject = request.POST.get('subject', '')
        message_template = request.POST.get('message', '')
        
        # Use a sample participant for the preview
        sample_participant = event.eventparticipant_set.first()
        
        if not sample_participant:
            # If there are no participants, create a dummy one for preview purposes
            sample_participant = type('obj', (object,), {
                'participant': type('obj', (object,), {
                    'first_name': 'John',
                    'last_name': 'Doe',
                    'email': 'john.doe@example.com',
                    'phone_number': '555-123-4567',
                })
            })
        
        participant = sample_participant.participant
        
        # Create context for template variables
        context = {
            'first_name': participant.first_name,
            'last_name': participant.last_name,
            'email': participant.email,
            'phone_number': participant.phone_number or "",
            'event_title': event.title,
            'event_date': event.start_date.strftime('%B %d, %Y'),
            'event_location': event.location or "TBD",
        }
        
        # Replace template variables in the message
        personalized_message = message_template
        for key, value in context.items():
            personalized_message = personalized_message.replace(f"{{{{{key}}}}}", str(value))
        
        # Create context for the email template
        email_context = {
            'subject': subject,
            'message': personalized_message,
            'participant': participant,
            'event': event,
        }
        
        # Render HTML email using the base template
        html_message = render_to_string('dashboard/event/email/batch_email.html', email_context)
        
        return JsonResponse({
            'html': html_message,
            'subject': subject,
        })
