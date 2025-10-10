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
from django.utils import timezone
import datetime
from django.db import models
import csv
import io
import re
from django.http import HttpResponseRedirect
from django.views.generic.edit import FormMixin
from django.core.mail import EmailMultiAlternatives
from django.conf import settings

from django import forms

from apps.event.models import OrganizedEvent, Participant, EventParticipant
from oscar.core.loading import get_model

EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")
from apps.event.forms import (
    EventForm,
    ParticipantForm,
    ParticipantAddForm,
    NewParticipantForm,
)

from django.template.loader import render_to_string
from apps.event.utils import (
    get_global_registration_closed,
    set_global_registration_closed,
)


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

    def get_queryset(self):
        # Prefetch related data to optimize queries for pending count calculations
        return (
            super()
            .get_queryset()
            .prefetch_related(
                "eventregistration_set__participant",
                "eventparticipant_set__participant",
            )
        )

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ctx["global_registration_closed"] = get_global_registration_closed()
        return ctx


class EventDetailView(DashboardMixin, DetailView):
    model = OrganizedEvent
    context_object_name = "event"
    template_name = "dashboard/event/event_detail.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        event = self.object
        # Include group registrations/payments for bulk flows
        groups = EventRegistrationGroup._default_manager.filter(event=event).order_by(
            "-created_at"
        )
        ctx["groups"] = groups

        # Include individual registrations/payments (not part of a group)
        individual_registrations = (
            event.eventregistration_set.filter(group__isnull=True)
            .select_related("participant")
            .order_by("-created_at")
        )
        ctx["individual_registrations"] = individual_registrations

        ctx["pending_count"] = event.pending_count

        # Calculate total donation amounts
        individual_donations = (
            event.eventregistration_set.aggregate(total=models.Sum("donation_amount"))[
                "total"
            ]
            or 0
        )

        group_donations = (
            groups.aggregate(total=models.Sum("donation_amount"))["total"] or 0
        )

        ctx["total_donations"] = individual_donations + group_donations
        ctx["individual_donations"] = individual_donations
        ctx["group_donations"] = group_donations

        # Annotate event participants with their registration references
        event_participants = []
        for ep in event.eventparticipant_set.select_related("participant").all():
            # Find the registration for this participant for this event
            registration = event.eventregistration_set.filter(
                participant=ep.participant
            ).first()
            ep.registration_reference = registration.reference if registration else None
            event_participants.append(ep)
        ctx["event_participants"] = event_participants

        return ctx


class EventRegistrationVerifyView(DashboardMixin, View):
    def post(self, request, *args, **kwargs):
        reg_id = kwargs.get("reg_id")
        reg = get_object_or_404(EventRegistration, id=reg_id)
        reg.verify(user=request.user)
        messages.success(
            request, f"Registration {reg.reference} marked as paid and confirmed."
        )
        return redirect("event-dashboard:event-detail", pk=reg.event_id)


class EventRegistrationGroupVerifyView(DashboardMixin, View):
    def post(self, request, *args, **kwargs):
        group_id = kwargs.get("group_id")
        grp = get_object_or_404(EventRegistrationGroup, id=group_id)
        count = grp.registrations.count()
        grp.verify(user=request.user)
        messages.success(
            request,
            f"Group {grp.reference} marked as paid and confirmed for {count} registration(s).",
        )
        return redirect("event-dashboard:event-detail", pk=grp.event_id)


class GlobalRegistrationToggleView(DashboardMixin, View):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        currently_closed = get_global_registration_closed()
        # Toggle state
        set_global_registration_closed(not currently_closed)
        if not currently_closed:
            messages.success(request, "Registration has been closed for all events.")
        else:
            messages.success(request, "Registration has been reopened for all events.")
        return redirect("event-dashboard:event-list")


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
    # Optional date range filters (sign-up dates)
    start_date = forms.DateField(
        required=False,
        label="Signup start date",
        widget=forms.DateInput(attrs={"type": "date"}),
        help_text="Only include signups on/after this date (optional)",
    )
    end_date = forms.DateField(
        required=False,
        label="Signup end date",
        widget=forms.DateInput(attrs={"type": "date"}),
        help_text="Only include signups on/before this date (optional)",
    )
    bcc_sales = forms.BooleanField(
        required=False,
        initial=False,
        label="BCC birdsocsgsales@gmail.com",
        help_text="Also send a blind carbon copy to birdsocsgsales@gmail.com",
    )
    recipient_mode = forms.ChoiceField(
        choices=(
            ("participants", "All event participants (one email per participant)"),
            (
                "verified_groups",
                "Verified payment groups (one email per group payer)",
            ),
        ),
        required=True,
        initial="participants",
        label="Recipients",
    )
    attachment1 = forms.FileField(required=False, label="Attachment 1")
    attachment2 = forms.FileField(required=False, label="Attachment 2")
    attachment3 = forms.FileField(required=False, label="Attachment 3")
    attachment4 = forms.FileField(required=False, label="Attachment 4")
    attachment5 = forms.FileField(required=False, label="Attachment 5")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["message"].help_text = (
            "You can use the following variables: {{first_name}}, {{last_name}}, "
            "{{email}}, {{phone_number}}, {{event_title}}, {{event_date}}, {{event_location}}, "
            "{{registration_reference}}"
        )

    def get_attachments(self):
        """Get all non-empty attachments from the form"""
        attachments = []
        for i in range(1, 6):
            field_name = f"attachment{i}"
            if self.cleaned_data.get(field_name):
                attachments.append(self.cleaned_data[field_name])
        return attachments


class EventBatchEmailView(DashboardMixin, SingleObjectMixin, FormView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_batch_email.html"
    form_class = BatchEmailForm

    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        context = super().get_context_data(**kwargs)
        context["event"] = self.object
        context["participant_count"] = self.object.eventparticipant_set.count()
        context["verified_group_count"] = (
            EventRegistrationGroup._default_manager.filter(
                event=self.object, payment_verified=True
            )
            .exclude(payer_email__isnull=True)
            .exclude(payer_email="")
            .count()
        )
        return context

    def form_valid(self, form):
        event = self.get_object()
        subject = form.cleaned_data["subject"]
        message_template = form.cleaned_data["message"]
        recipient_mode = form.cleaned_data.get("recipient_mode") or "participants"
        bcc_sales = form.cleaned_data.get("bcc_sales") is True
        start_date = form.cleaned_data.get("start_date")
        end_date = form.cleaned_data.get("end_date")

        # Resolve date range to timezone-aware datetimes (inclusive bounds)
        start_dt = None
        end_dt = None
        if start_date:
            start_dt = timezone.make_aware(
                datetime.datetime.combine(start_date, datetime.time.min)
            ) if timezone.is_naive(datetime.datetime.combine(start_date, datetime.time.min)) else datetime.datetime.combine(start_date, datetime.time.min)
        if end_date:
            # inclusive: end of the given day
            end_dt = timezone.make_aware(
                datetime.datetime.combine(end_date, datetime.time.max)
            ) if timezone.is_naive(datetime.datetime.combine(end_date, datetime.time.max)) else datetime.datetime.combine(end_date, datetime.time.max)

        # Get attachments
        attachments = form.get_attachments()
        attachments = [(attachment, attachment.read()) for attachment in attachments]

        # Keep track of successful and failed emails
        successful = 0
        failed = 0

        # Build BCC list
        reply_to_email = getattr(settings, "REPLY_TO_EMAIL", None)
        bcc_list = []
        if reply_to_email:
            bcc_list.append(reply_to_email)
        if bcc_sales:
            bcc_list.append("birdsocsgsales@gmail.com")
        # Deduplicate while preserving order
        seen = set()
        bcc_list = [x for x in bcc_list if not (x.lower() in seen or seen.add(x.lower()))]

        if recipient_mode == "verified_groups":
            # Send one email per verified group payer
            groups_qs = (
                EventRegistrationGroup._default_manager.filter(
                    event=event, payment_verified=True
                )
                .exclude(payer_email__isnull=True)
                .exclude(payer_email="")
            )
            if start_dt:
                groups_qs = groups_qs.filter(created_at__gte=start_dt)
            if end_dt:
                groups_qs = groups_qs.filter(created_at__lte=end_dt)

            seen_emails = set()
            for grp in groups_qs:
                if grp.payer_email.lower() in seen_emails:
                    # Avoid duplicate emails if multiple groups share an email
                    continue
                seen_emails.add(grp.payer_email.lower())

                registrations = list(
                    grp.registrations.select_related("participant").all()
                )
                primary_participant = None
                for registration in registrations:
                    participant_candidate = registration.participant
                    candidate_first_name = (participant_candidate.first_name or "").strip()
                    if candidate_first_name and not re.search(r"\(\d+\)\s*$", candidate_first_name):
                        primary_participant = participant_candidate
                        break
                if primary_participant is None and registrations:
                    primary_participant = registrations[0].participant

                if primary_participant:
                    first_name = primary_participant.first_name or ""
                    last_name = primary_participant.last_name or ""
                else:
                    first_name = grp.payer_name or ""
                    last_name = ""

                # Create context for template variables
                context = {
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": grp.payer_email,
                    "phone_number": grp.payer_phone or "",
                    "event_title": event.title,
                    "event_date": event.start_date.strftime("%B %d, %Y"),
                    "event_location": event.location or "TBD",
                    "registration_reference": grp.reference,
                }

                # Replace template variables in the message
                personalized_message = message_template
                for key, value in context.items():
                    personalized_message = personalized_message.replace(
                        f"{{{{{key}}}}}", str(value)
                    )

                email_context = {
                    "subject": subject,
                    "message": personalized_message,
                    "group": grp,
                    "event": event,
                }

                try:
                    # Render HTML email using the base template
                    html_message = render_to_string(
                        "dashboard/event/email/batch_email.html", email_context
                    )

                    email = EmailMultiAlternatives(
                        subject,
                        html_message,
                        settings.DEFAULT_FROM_EMAIL,
                        [grp.payer_email],
                        bcc=bcc_list,
                    )
                    email.content_subtype = "html"

                    for attachment, read_attachment in attachments:
                        email.attach(
                            attachment.name, read_attachment, attachment.content_type
                        )

                    email.send()
                    successful += 1
                except Exception as e:
                    failed += 1
                    print(
                        f"Failed to send email to group payer {grp.payer_email}: {str(e)}"
                    )
        else:
            # Default: send to all event participants
            event_participants = event.eventparticipant_set.all()
            if start_dt:
                event_participants = event_participants.filter(registered_at__gte=start_dt)
            if end_dt:
                event_participants = event_participants.filter(registered_at__lte=end_dt)
            # Optional: prefetch registrations for potential registration_reference
            for ep in event_participants:
                participant = ep.participant

                # Attempt to find a registration reference if any (most recent)
                reg = (
                    EventRegistration._default_manager.filter(
                        event=event, participant=participant
                    )
                    .order_by("-created_at")
                    .first()
                )
                registration_reference = reg.reference if reg else ""

                # Create context for template variables
                context = {
                    "first_name": participant.first_name,
                    "last_name": participant.last_name,
                    "email": participant.email,
                    "phone_number": participant.phone_number or "",
                    "event_title": event.title,
                    "event_date": event.start_date.strftime("%B %d, %Y"),
                    "event_location": event.location or "TBD",
                    "registration_reference": registration_reference,
                }

                # Replace template variables in the message
                personalized_message = message_template
                for key, value in context.items():
                    personalized_message = personalized_message.replace(
                        f"{{{{{key}}}}}", str(value)
                    )

                # Create context for the email template
                email_context = {
                    "subject": subject,
                    "message": personalized_message,
                    "participant": participant,
                    "event": event,
                }

                try:
                    # Render HTML email using the base template
                    html_message = render_to_string(
                        "dashboard/event/email/batch_email.html", email_context
                    )

                    # Create email
                    email = EmailMultiAlternatives(
                        subject,
                        html_message,  # Plain text fallback
                        settings.DEFAULT_FROM_EMAIL,
                        [participant.email],  # Send to actual participant email
                        bcc=bcc_list,  # Optional BCCs
                    )
                    email.content_subtype = "html"

                    # Add attachments
                    for attachment, read_attachment in attachments:
                        email.attach(
                            attachment.name, read_attachment, attachment.content_type
                        )

                    email.send()
                    successful += 1
                except Exception as e:
                    failed += 1
                    # Log the error
                    print(f"Failed to send email to {participant.email}: {str(e)}")

        if failed > 0:
            messages.warning(
                self.request,
                f"Sent {successful} emails successfully, but {failed} emails failed to send.",
            )
        else:
            if recipient_mode == "verified_groups":
                messages.success(
                    self.request,
                    f"Successfully sent emails to all {successful} group payers.",
                )
            else:
                messages.success(
                    self.request,
                    f"Successfully sent emails to all {successful} participants.",
                )

        return redirect("event-dashboard:event-detail", pk=event.pk)


class EventBatchEmailPreviewView(DashboardMixin, View):
    """View for previewing batch emails before sending"""

    def post(self, request, *args, **kwargs):
        event = get_object_or_404(OrganizedEvent, pk=kwargs.get("pk"))
        subject = request.POST.get("subject", "")
        message_template = request.POST.get("message", "")
        recipient_mode = request.POST.get("recipient_mode", "participants")

        if recipient_mode == "verified_groups":
            grp = (
                EventRegistrationGroup._default_manager.filter(
                    event=event, payment_verified=True
                )
                .exclude(payer_email__isnull=True)
                .exclude(payer_email="")
                .first()
            )
            if not grp:
                # Dummy group-like object
                grp = type(
                    "grp",
                    (object,),
                    {
                        "payer_name": "Jane Doe",
                        "payer_email": "jane@example.com",
                        "payer_phone": "555-987-6543",
                        "reference": "EVG-EXAMPLE",
                    },
                )

            first_name = (grp.payer_name or "").split(" ")[0] if getattr(grp, "payer_name", None) else ""
            last_name = (
                " ".join((grp.payer_name or "").split(" ")[1:]) if getattr(grp, "payer_name", None) else ""
            )
            context = {
                "first_name": first_name,
                "last_name": last_name,
                "email": getattr(grp, "payer_email", ""),
                "phone_number": getattr(grp, "payer_phone", "") or "",
                "event_title": event.title,
                "event_date": event.start_date.strftime("%B %d, %Y"),
                "event_location": event.location or "TBD",
                "registration_reference": getattr(grp, "reference", ""),
            }
            email_context_extra = {"group": grp}
        else:
            # Use a sample participant for the preview
            sample_participant = event.eventparticipant_set.first()

            if not sample_participant:
                # If there are no participants, create a dummy one for preview purposes
                sample_participant = type(
                    "obj",
                    (object,),
                    {
                        "participant": type(
                            "obj",
                            (object,),
                            {
                                "first_name": "John",
                                "last_name": "Doe",
                                "email": "john.doe@example.com",
                                "phone_number": "555-123-4567",
                            },
                        )
                    },
                )

            participant = sample_participant.participant

            # Attempt to find a registration reference if any
            reg = (
                EventRegistration._default_manager.filter(
                    event=event, participant__email=participant.email
                )
                .order_by("-created_at")
                .first()
            )

            # Create context for template variables
            context = {
                "first_name": participant.first_name,
                "last_name": participant.last_name,
                "email": participant.email,
                "phone_number": participant.phone_number or "",
                "event_title": event.title,
                "event_date": event.start_date.strftime("%B %d, %Y"),
                "event_location": event.location or "TBD",
                "registration_reference": reg.reference if reg else "",
            }
            email_context_extra = {"participant": participant}

        # Replace template variables in the message
        personalized_message = message_template
        for key, value in context.items():
            personalized_message = personalized_message.replace(
                f"{{{{{key}}}}}", str(value)
            )

        # Create context for the email template
        email_context = {"subject": subject, "message": personalized_message, "event": event}
        email_context.update(email_context_extra)

        # Render HTML email using the base template
        html_message = render_to_string(
            "dashboard/event/email/batch_email.html", email_context
        )

        return JsonResponse(
            {
                "html": html_message,
                "subject": subject,
            }
        )


class EventBatchEmailCountView(DashboardMixin, View):
    """Return dynamic recipient count for batch email based on filters."""

    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        from django.utils.dateparse import parse_date

        event = get_object_or_404(OrganizedEvent, pk=kwargs.get("pk"))
        recipient_mode = request.POST.get("recipient_mode", "participants")
        start_date_str = request.POST.get("start_date")
        end_date_str = request.POST.get("end_date")

        # Parse dates safely
        start_dt = end_dt = None
        start_date = parse_date(start_date_str) if start_date_str else None
        end_date = parse_date(end_date_str) if end_date_str else None
        if start_date:
            start_naive = datetime.datetime.combine(start_date, datetime.time.min)
            start_dt = timezone.make_aware(start_naive) if timezone.is_naive(start_naive) else start_naive
        if end_date:
            end_naive = datetime.datetime.combine(end_date, datetime.time.max)
            end_dt = timezone.make_aware(end_naive) if timezone.is_naive(end_naive) else end_naive

        if recipient_mode == "verified_groups":
            qs = (
                EventRegistrationGroup._default_manager.filter(
                    event=event, payment_verified=True
                )
                .exclude(payer_email__isnull=True)
                .exclude(payer_email="")
            )
            if start_dt:
                qs = qs.filter(created_at__gte=start_dt)
            if end_dt:
                qs = qs.filter(created_at__lte=end_dt)

            # Deduplicate by payer email to reflect sending behavior
            emails = set(qs.values_list("payer_email", flat=True).iterator())
            count = len({(e or "").lower() for e in emails if e})
            label = "group payers"
        else:
            qs = event.eventparticipant_set.all()
            if start_dt:
                qs = qs.filter(registered_at__gte=start_dt)
            if end_dt:
                qs = qs.filter(registered_at__lte=end_dt)
            count = qs.count()
            label = "participants"

        return JsonResponse({"count": count, "label": label, "mode": recipient_mode})


# EventParticipant detail view
class EventParticipantDetailView(DashboardMixin, DetailView):
    model = EventParticipant
    context_object_name = "event_participant"
    template_name = "dashboard/event/event_participant_detail.html"

    def get_queryset(self):
        # Pull related objects for efficient template rendering
        return super().get_queryset().select_related("event", "participant")

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        ep = self.object
        ctx["event"] = ep.event
        ctx["participant"] = ep.participant
        ctx["title"] = f"{ep.participant.full_name} @ {ep.event.title}"
        # Prepare extra_json for table display in template
        extra = ep.extra_json or {}
        ctx["extra_items"] = extra.items() if isinstance(extra, dict) else []
        ctx["extra_is_dict"] = isinstance(extra, dict)
        ctx["extra_raw"] = extra
        return ctx


# Manual registration helper page (dashboard)
from django.views.generic import TemplateView


class EventManualRegisterView(DashboardMixin, SingleObjectMixin, TemplateView):
    model = OrganizedEvent
    template_name = "dashboard/event/event_manual_register.html"

    def get_context_data(self, **kwargs):
        self.object = self.get_object()
        ctx = super().get_context_data(**kwargs)
        ctx["event"] = self.object
        ctx["title"] = f"Manually Register – {self.object.title}"
        return ctx
