from rest_framework import viewsets, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from oscar.core.loading import get_model
from rest_framework import status
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.utils import timezone
import json as _json
import re


OrganizedEvent = get_model("event", "OrganizedEvent")
Participant = get_model("event", "Participant")
EventParticipant = get_model("event", "EventParticipant")
EventRegistration = get_model("event", "EventRegistration")
EventRegistrationGroup = get_model("event", "EventRegistrationGroup")

# Global registration flag helpers
from apps.event.utils import get_global_registration_closed


class EventsViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [permissions.AllowAny]

    def list(self, request):
        past = request.query_params.get("past") in ("1", "true", "True")
        now = timezone.now()
        if past:
            six_months_ago = now - timezone.timedelta(days=183)
            qs = OrganizedEvent._default_manager.select_related("image").filter(
                is_active=True, start_date__lt=now, start_date__gte=six_months_ago
            ).order_by("-start_date")
            data = [
                {
                    "id": e.id,
                    "title": e.title,
                    "description": e.description,
                    "start_date": e.start_date,
                    "end_date": e.end_date,
                    "location": e.location,
                    "price_incl_tax": str(e.price_incl_tax),
                    "currency": e.currency,
                    "image_url": e.image.file.url if e.image else None,
                    "tags": e.tags or [],
                }
                for e in qs
            ]
            return Response(data)

        qs = OrganizedEvent._default_manager.select_related("image").filter(
            is_active=True, start_date__gte=now
        ).order_by("start_date")
        closed = get_global_registration_closed()
        data = [
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "start_date": e.start_date,
                "end_date": e.end_date,
                "location": e.location,
                "participant_count": e.participant_count + e.pending_count,
                "max_participants": e.max_participants,
                "is_full": e.is_full,
                "price_incl_tax": str(e.price_incl_tax),
                "currency": e.currency,
                "json_schema": e.json_schema,
                "price_tiers": e.price_tiers,
                "max_qty": e.max_qty,
                "validate_participant_data": e.validate_participant_data,
                "registration_required": e.registration_required,
                "registration_open": e.registration_open,
                "waitlist_enabled": e.waitlist_enabled,
                "waitlist_count": e.waitlist_count,
                "image_url": e.image.file.url if e.image else None,
                "global_registration_closed": closed,
                "tags": e.tags or [],
            }
            for e in qs
        ]
        return Response(data)

    def retrieve(self, request, pk=None):
        try:
            e = OrganizedEvent._default_manager.select_related("image").get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "start_date": e.start_date,
            "end_date": e.end_date,
            "location": e.location,
            "participant_count": e.participant_count,
            "max_participants": e.max_participants,
            "is_active": e.is_active,
            "is_full": e.is_full,
            "price_incl_tax": str(e.price_incl_tax),
            "currency": e.currency,
            "json_schema": e.json_schema,
            "price_tiers": e.price_tiers,
            "max_qty": e.max_qty,
            "validate_participant_data": e.validate_participant_data,
            "registration_required": e.registration_required,
            "registration_open": e.registration_open,
            "waitlist_enabled": e.waitlist_enabled,
            "waitlist_count": e.waitlist_count,
            "image_url": e.image.file.url if e.image else None,
            "global_registration_closed": get_global_registration_closed(),
            "post_registration_message": e.post_registration_message or "",
            "tags": e.tags or [],
        }
        return Response(data)

    @action(detail=True, methods=["post"], url_path="register")
    def register(self, request, pk=None):
        # Validate event
        try:
            event = OrganizedEvent._default_manager.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response(
                {"detail": "Event not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Global switch: block all registrations when closed
        if get_global_registration_closed():
            return Response(
                {
                    "detail": "Registration is temporarily closed",
                    "code": "registration_closed",
                    "global_registration_closed": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Per-event registration open/closed toggle
        if not event.registration_open:
            return Response(
                {
                    "detail": "Registration for this event is currently closed",
                    "code": "event_registration_closed",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Extract fields
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        email = (request.data.get("email") or "").strip()
        phone_number = (request.data.get("phone_number") or "").strip()
        emergency_contact_name = (
            request.data.get("emergency_contact_name") or ""
        ).strip()
        emergency_contact_phone = (
            request.data.get("emergency_contact_phone") or ""
        ).strip()
        try:
            quantity = int(request.data.get("quantity", 1))
        except Exception:
            return Response(
                {"detail": "quantity must be an integer"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not first_name or not last_name or not email:
            return Response(
                {"detail": "first_name, last_name, and email are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"detail": "Invalid email"}, status=status.HTTP_400_BAD_REQUEST
            )
        if quantity <= 0:
            return Response(
                {"detail": "quantity must be >= 1"}, status=status.HTTP_400_BAD_REQUEST
            )
        if quantity > event.max_qty:
            return Response(
                {"detail": f"Maximum {event.max_qty} tickets per registration"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Duplicate email check: reject if this email is already registered for the same event
        if EventParticipant.objects.filter(
            event=event, participant__email__iexact=email
        ).exists():
            return Response(
                {"detail": "This email is already registered for this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create a fresh participant per registration (quantity is per-registration)
        participant = Participant._default_manager.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone_number=phone_number,
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
            quantity=quantity,
        )
        # Parse optional extra JSON fields for the participant
        extra_json = request.data.get("extra_json")
        # If provided as a string via form-data, parse to dict
        if isinstance(extra_json, str) and extra_json:
            import json as _json

            try:
                extra_json = _json.loads(extra_json)
            except Exception:
                return Response(
                    {"detail": "extra_json must be valid JSON"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Compute unit price from price_tiers (fallback to event.price_incl_tax)
        unit_price = event.get_unit_price_from_tiers(extra_json or {})
        from decimal import Decimal as _D

        amount = unit_price * _D(str(quantity))
        # Optional donation top-up (parse early to determine paid flow correctly)
        donation_raw = request.data.get("donation")
        donation_int = 0
        if donation_raw is not None:
            try:
                donation_int = int(donation_raw)
            except Exception:
                return Response(
                    {"detail": "donation must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if donation_int < 0:
                return Response(
                    {"detail": "donation must be >= 0"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Paid or free? Consider donation too
        is_paid = (amount > 0) or (donation_int > 0)

        # Capacity check: include pending registrations if paid
        if event.max_participants is not None:
            confirmed = event.participant_count
            pending = event.pending_count if is_paid else 0
            if confirmed + pending + quantity > event.max_participants:
                if event.waitlist_enabled and not is_paid:
                    # Join the waitlist instead
                    event_participant = EventParticipant.objects.create(
                        event=event,
                        participant=participant,
                        is_confirmed=False,
                        is_waitlisted=True,
                        extra_json=extra_json,
                    )
                    waitlist_position = EventParticipant.objects.filter(
                        event=event,
                        is_waitlisted=True,
                        is_cancelled=False,
                        registered_at__lte=event_participant.registered_at,
                    ).count()
                    from apps.event.utils import send_waitlist_joined_email
                    send_waitlist_joined_email(event, participant, waitlist_position)
                    return Response(
                        {
                            "event": event.id,
                            "participant": {
                                "id": participant.id,
                                "first_name": participant.first_name,
                                "last_name": participant.last_name,
                                "email": participant.email,
                                "phone_number": participant.phone_number,
                                "emergency_contact_name": participant.emergency_contact_name,
                                "emergency_contact_phone": participant.emergency_contact_phone,
                                "quantity": participant.quantity,
                            },
                            "registered_at": event_participant.registered_at,
                            "confirmed": False,
                            "waitlisted": True,
                            "waitlist_position": waitlist_position,
                        },
                        status=status.HTTP_201_CREATED,
                    )
                remaining = max(event.max_participants - confirmed - pending, 0)
                return Response(
                    {
                        "detail": f"Cannot add participant. Only {remaining} spots remaining."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Create EventParticipant; confirmed if free, else pending confirmation
        try:
            event_participant = event.add_participant(
                participant, is_confirmed=not is_paid, extra_json=extra_json
            )
        except ValueError:
            return Response(
                {"detail": "Unable to add participant to this event."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If free, send confirmation email and return
        if not is_paid:
            from apps.event.utils import send_free_registration_confirmation_email
            send_free_registration_confirmation_email(event, participant)
            return Response(
                {
                    "event": event.id,
                    "participant": {
                        "id": participant.id,
                        "first_name": participant.first_name,
                        "last_name": participant.last_name,
                        "email": participant.email,
                        "phone_number": participant.phone_number,
                        "emergency_contact_name": participant.emergency_contact_name,
                        "emergency_contact_phone": participant.emergency_contact_phone,
                        "quantity": participant.quantity,
                    },
                    "registered_at": event_participant.registered_at,
                    "confirmed": True,
                },
                status=status.HTTP_201_CREATED,
            )

        # Paid flow: create EventRegistration and optionally attach payment proof
        from decimal import Decimal
        from django.core.files.base import ContentFile
        from os.path import basename

        # amount already computed using tiers

        # Create with temporary reference to get ID
        from oscar.core.loading import get_model as _get_model

        EventRegistration = _get_model("event", "EventRegistration")

        reg = EventRegistration.objects.create(
            event=event,
            participant=participant,
            amount=amount,
            currency=event.currency,
            reference="",  # set after we have an ID
            emergency_contact_name=emergency_contact_name,
            emergency_contact_phone=emergency_contact_phone,
            donation_amount=Decimal(donation_int or 0),
        )
        # Set deterministic reference now that we have an ID
        reg.reference = f"EV-{event.id}-{reg.id}"
        reg.save(update_fields=["reference"])

        upload = request.FILES.get("payment_proof")
        if upload:
            # Save with the proper upload_to using reference
            content = upload.read()
            reg.payment_proof.save(
                basename(upload.name), ContentFile(content), save=True
            )

        return Response(
            {
                "event": event.id,
                "participant": {
                    "id": participant.id,
                    "first_name": participant.first_name,
                    "last_name": participant.last_name,
                    "email": participant.email,
                    "phone_number": participant.phone_number,
                    "emergency_contact_name": participant.emergency_contact_name,
                    "emergency_contact_phone": participant.emergency_contact_phone,
                    "quantity": participant.quantity,
                },
                "registered_at": event_participant.registered_at,
                "confirmed": False,
                "registration": {
                    "id": reg.id,
                    "reference": reg.reference,
                    "amount": str(reg.amount),
                    "donation_amount": str(reg.donation_amount),
                    "amount_with_donation": str(reg.amount + reg.donation_amount),
                    "currency": reg.currency,
                    "emergency_contact_name": reg.emergency_contact_name,
                    "emergency_contact_phone": reg.emergency_contact_phone,
                    "status": reg.status,
                    "unit_price": str(unit_price),
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="register/bulk")
    def bulk_register(self, request, pk=None):
        """
        Register multiple participants for an event in one request.
        Optionally attach a single payment proof that covers all participants.
        Body supports `application/json` or `multipart/form-data` where
        `participants` may be provided as a JSON string.
        """
        # Validate event
        try:
            event = OrganizedEvent._default_manager.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response(
                {"detail": "Event not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Global switch: block all registrations when closed
        if get_global_registration_closed():
            return Response(
                {
                    "detail": "Registration is temporarily closed",
                    "code": "registration_closed",
                    "global_registration_closed": True,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Per-event registration open/closed toggle
        if not event.registration_open:
            return Response(
                {
                    "detail": "Registration for this event is currently closed",
                    "code": "event_registration_closed",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Participants payload
        participants_payload = request.data.get("participants")
        if participants_payload is None:
            return Response(
                {"detail": "participants is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Parse if needed
        if isinstance(participants_payload, str):
            try:
                participants = _json.loads(participants_payload)
            except Exception:
                return Response(
                    {"detail": "participants must be a valid JSON list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            participants = participants_payload

        if not isinstance(participants, list) or not participants:
            return Response(
                {"detail": "participants must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional payer metadata
        payer_name = (request.data.get("payer_name") or "").strip()
        payer_email = (request.data.get("payer_email") or "").strip()
        payer_phone = (request.data.get("payer_phone") or "").strip()
        if payer_email:
            try:
                validate_email(payer_email)
            except ValidationError:
                return Response(
                    {"detail": "Invalid payer_email"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        # Optional custom reference (only applies when a paid group is created)
        raw_reference = request.data.get("reference")
        provided_reference = None
        if isinstance(raw_reference, str):
            provided_reference = raw_reference.strip()
        elif raw_reference is not None:
            return Response(
                {"detail": "reference must be a string"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Optional donation for the whole group
        donation_raw = request.data.get("donation")
        donation_int = 0
        if donation_raw is not None:
            try:
                donation_int = int(donation_raw)
            except Exception:
                return Response(
                    {"detail": "donation must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if donation_int < 0:
                return Response(
                    {"detail": "donation must be >= 0"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Validate each participant and build normalized list
        normalized = []
        emails = []
        total_qty = 0
        errors = []
        for idx, item in enumerate(participants):
            if not isinstance(item, dict):
                errors.append(
                    {"index": idx, "detail": "Each participant must be an object"}
                )
                continue
            first_name = (item.get("first_name") or "").strip()
            last_name = (item.get("last_name") or "").strip()
            email = (item.get("email") or "").strip()
            phone_number = (item.get("phone_number") or "").strip()
            emergency_contact_name = (item.get("emergency_contact_name") or "").strip()
            emergency_contact_phone = (
                item.get("emergency_contact_phone") or ""
            ).strip()
            try:
                quantity = int(item.get("quantity", 1))
            except Exception:
                return Response(
                    {"detail": f"quantity must be an integer (index {idx})"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not first_name or not last_name or not email:
                errors.append(
                    {
                        "index": idx,
                        "detail": "first_name, last_name, and email are required",
                    }
                )
                continue
            try:
                validate_email(email)
            except ValidationError:
                errors.append({"index": idx, "detail": "Invalid email"})
                continue
            if quantity <= 0:
                errors.append({"index": idx, "detail": "quantity must be >= 1"})
                continue

            # Parse extra_json if provided as string
            extra_json = item.get("extra_json")
            if isinstance(extra_json, str) and extra_json:
                try:
                    extra_json = _json.loads(extra_json)
                except Exception:
                    errors.append({"index": idx, "detail": "extra_json must be valid JSON"})
                    continue

            normalized.append(
                {
                    "first_name": first_name,
                    "last_name": last_name,
                    "email": email,
                    "phone_number": phone_number,
                    "emergency_contact_name": emergency_contact_name,
                    "emergency_contact_phone": emergency_contact_phone,
                    "quantity": quantity,
                    "extra_json": extra_json,
                }
            )
            emails.append(email.lower())
            total_qty += quantity

        if errors:
            return Response(
                {"detail": "Invalid participant data", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Duplicate emails within payload are allowed (they may be different people)

        # Compute unit prices per normalized participant and total amount
        from decimal import Decimal as _D

        total_amount = _D("0")
        for item in normalized:
            unit_price = event.get_unit_price_from_tiers(item.get("extra_json") or {})
            item["_unit_price"] = unit_price
            total_amount += unit_price * _D(str(item.get("quantity", 1)))

        is_paid = total_amount > 0

        # Capacity check (include pending for paid events)
        # Determine if payment is required (consider donation)
        requires_payment = is_paid or (donation_int > 0)

        if event.max_participants is not None:
            confirmed = event.participant_count
            pending = event.pending_count if requires_payment else 0
            if confirmed + pending + total_qty > event.max_participants:
                remaining = max(event.max_participants - confirmed - pending, 0)
                return Response(
                    {
                        "detail": f"Cannot add participants. Only {remaining} spots remaining."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Duplicate email registration for same event should be allowed

        # Create group (for paid events)
        group = None
        if requires_payment:
            # If a custom reference is provided, validate format and uniqueness
            if provided_reference:
                # Format: max 25 chars, A–Z 0–9 hyphen only
                if not re.fullmatch(r"[A-Z0-9-]{1,25}", provided_reference or ""):
                    return Response(
                        {
                            "detail": "Invalid reference format. Use A–Z, 0–9, and hyphen only, max 25 characters."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Uniqueness across groups (global)
                if EventRegistrationGroup.objects.filter(
                    reference=provided_reference
                ).exists():
                    return Response(
                        {"detail": "Reference already in use"},
                        status=status.HTTP_409_CONFLICT,
                    )

            group = EventRegistrationGroup.objects.create(
                event=event,
                payer_name=payer_name,
                payer_email=payer_email,
                payer_phone=payer_phone,
                amount_total=total_amount,
                currency=event.currency,
                reference=(
                    provided_reference or ""
                ),  # set after we have an ID if not provided
                donation_amount=_D(str(donation_int or 0)),
            )
            if not provided_reference:
                group.reference = f"EVG-{event.id}-{group.id}"
                group.save(update_fields=["reference"])

            # Attach optional payment proof to group
            upload = request.FILES.get("payment_proof")
            if upload:
                from django.core.files.base import ContentFile
                from os.path import basename

                content = upload.read()
                group.payment_proof.save(
                    basename(upload.name), ContentFile(content), save=True
                )

        # Create participants, eventparticipants, and registrations
        items = []
        for item in normalized:
            p = Participant._default_manager.create(
                first_name=item["first_name"],
                last_name=item["last_name"],
                email=item["email"],
                phone_number=item["phone_number"],
                emergency_contact_name=item["emergency_contact_name"],
                emergency_contact_phone=item["emergency_contact_phone"],
                quantity=item["quantity"],
            )

            try:
                ep = event.add_participant(
                    p,
                    is_confirmed=not requires_payment,
                    extra_json=item.get("extra_json"),
                )
            except ValueError:
                return Response(
                    {"detail": "Unable to add one or more participants to this event."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            entry = {
                "participant": {
                    "id": p.id,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "email": p.email,
                    "phone_number": p.phone_number,
                    "emergency_contact_name": p.emergency_contact_name,
                    "emergency_contact_phone": p.emergency_contact_phone,
                    "quantity": p.quantity,
                },
                "registered_at": ep.registered_at,
                "confirmed": not requires_payment,
            }

            if requires_payment:
                unit_price = item.get("_unit_price") or _D("0")
                amount = unit_price * _D(str(p.quantity))
                reg = EventRegistration.objects.create(
                    event=event,
                    participant=p,
                    amount=amount,
                    currency=event.currency,
                    reference="",
                    emergency_contact_name=item.get("emergency_contact_name", ""),
                    emergency_contact_phone=item.get("emergency_contact_phone", ""),
                    group=group,
                )
                reg.reference = f"EV-{event.id}-{reg.id}"
                reg.save(update_fields=["reference"])
                entry["registration"] = {
                    "id": reg.id,
                    "reference": reg.reference,
                    "amount": str(reg.amount),
                    "unit_price": str(unit_price),
                    "currency": reg.currency,
                    "emergency_contact_name": reg.emergency_contact_name,
                    "emergency_contact_phone": reg.emergency_contact_phone,
                    "status": reg.status,
                }
            items.append(entry)

        response = {
            "event": event.id,
            "totals": {
                "quantity": total_qty,
                "amount": str(total_amount),
                "currency": event.currency,
            },
            "items": items,
        }
        if requires_payment and group:
            response["group"] = {
                "id": group.id,
                "reference": group.reference,
                "amount_total": str(group.amount_total),
                "donation_amount": str(group.donation_amount),
                "amount_total_with_donation": str(
                    group.amount_total + group.donation_amount
                ),
                "currency": group.currency,
                "status": group.status,
                "payment_proof_uploaded": bool(group.payment_proof),
            }
        else:
            response["all_confirmed"] = True

        return Response(response, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="price-breakdown")
    def price_breakdown(self, request, pk=None):
        """
        Compute a cart-style price breakdown for prospective participants without persisting anything.
        Accepts the same `participants` array shape as bulk_register.
        Returns line items with resolved unit_price and totals.
        """
        # Validate event
        try:
            event = OrganizedEvent._default_manager.get(pk=pk)
        except OrganizedEvent.DoesNotExist:
            return Response(
                {"detail": "Event not found"}, status=status.HTTP_404_NOT_FOUND
            )

        participants_payload = request.data.get("participants")
        if participants_payload is None:
            return Response(
                {"detail": "participants is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if isinstance(participants_payload, str):
            try:
                participants = _json.loads(participants_payload)
            except Exception:
                return Response(
                    {"detail": "participants must be a valid JSON list"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            participants = participants_payload

        if not isinstance(participants, list) or not participants:
            return Response(
                {"detail": "participants must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Normalize inputs
        items = []
        emails = []
        from decimal import Decimal as _D

        total_qty = 0
        total_amount = _D("0")
        # Optional donation on the preview
        donation_raw = request.data.get("donation")
        donation_int = 0
        if donation_raw is not None:
            try:
                donation_int = int(donation_raw)
            except Exception:
                return Response(
                    {"detail": "donation must be an integer"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if donation_int < 0:
                return Response(
                    {"detail": "donation must be >= 0"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        for idx, item in enumerate(participants):
            if not isinstance(item, dict):
                return Response(
                    {"detail": f"Each participant must be an object (index {idx})"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                quantity = int(item.get("quantity", 1))
            except Exception:
                return Response(
                    {"detail": f"quantity must be an integer (index {idx})"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if quantity <= 0:
                return Response(
                    {"detail": f"quantity must be >= 1 (index {idx})"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            extra_json = item.get("extra_json")
            if isinstance(extra_json, str) and extra_json:
                try:
                    extra_json = _json.loads(extra_json)
                except Exception:
                    return Response(
                        {"detail": f"extra_json must be valid JSON (index {idx})"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            unit_price = event.get_unit_price_from_tiers(extra_json or {})
            line_total = unit_price * _D(str(quantity))
            total_qty += quantity
            total_amount += line_total

            email = (item.get("email") or "").strip().lower()
            if email:
                emails.append(email)

            # Try exposing matched tier metadata, if possible, by scanning tiers
            matched_tier = None
            tiers = event.price_tiers or []
            if isinstance(tiers, dict):
                tiers = [
                    dict({"code": code}, **cfg)
                    for code, cfg in tiers.items()
                    if isinstance(cfg, dict)
                ]
            for t in tiers:
                if event._match_rule(
                    str((t or {}).get("rule") or "*"), extra_json or {}
                ):
                    matched_tier = {
                        "code": t.get("code"),
                        "name": t.get("name"),
                        "rule": t.get("rule"),
                        "price_incl_tax": str(t.get("price_incl_tax")),
                    }
                    break

            items.append(
                {
                    "index": idx,
                    "quantity": quantity,
                    "unit_price": str(unit_price),
                    "line_total": str(line_total),
                    "tier": matched_tier,
                }
            )

        # Allow duplicate emails within payload

        requires_payment = (total_amount > 0) or (donation_int > 0)

        # Capacity preview
        capacity = None
        if event.max_participants is not None:
            confirmed = event.participant_count
            pending = event.pending_count if requires_payment else 0
            remaining = max(event.max_participants - confirmed - pending, 0)
            capacity = {
                "available": total_qty <= remaining,
                "remaining": remaining,
                "considered_pending": requires_payment,
            }

        response = {
            "event": event.id,
            "currency": event.currency,
            "items": items,
            "totals": {
                "quantity": total_qty,
                "amount": str(total_amount),
                "donation": str(_D(str(donation_int or 0))),
                "amount_with_donation": str(total_amount + _D(str(donation_int or 0))),
            },
            "requires_payment": requires_payment,
            "global_registration_closed": get_global_registration_closed(),
        }
        if capacity is not None:
            response["capacity"] = capacity

        return Response(response)
