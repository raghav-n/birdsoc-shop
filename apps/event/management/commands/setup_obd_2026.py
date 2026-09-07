"""
Create (or update) the six site events for October Big Day 2026.

The six events mirror the 2025 setup: one OrganizedEvent per birding site,
title-matched by the public OBD landing page (birdsociety.sg / october-big-day),
tiered pricing (adult $28 / student $14 via an ``age:<=18`` rule) and a
participant schema (age, shirt size, dietary, experience).

Safety model — nothing is public until you say so:
  * Events are created with ``is_active=False`` (draft). The public /events
    endpoint, event detail, and registration endpoints all exclude drafts, so
    they never appear on the shop and cannot be booked until activated.
  * ``registration_start`` / ``registration_end`` bracket the tentative
    7–14 Sep 2026 window, so even after activation the form only opens in-window.

Usage:
    python manage.py setup_obd_2026                 # create/refresh drafts (idempotent)
    python manage.py setup_obd_2026 --dry-run       # show what would change
    python manage.py setup_obd_2026 --activate      # flip the six live (open registration)
    python manage.py setup_obd_2026 --deactivate    # hide them again

The command is idempotent: it matches existing events by exact title and
updates them in place, so it is safe to re-run. Re-running never resets
participant registrations.
"""
import secrets
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from oscar.core.loading import get_model

OrganizedEvent = get_model("event", "OrganizedEvent")
EventGroup = get_model("event", "EventGroup")
EventAllocation = get_model("event", "EventAllocation")

# Tentative registration window (Asia/Singapore). Adjust here or via the console.
REGISTRATION_START = "2026-09-07T09:00:00+08:00"
REGISTRATION_END = "2026-09-14T23:59:00+08:00"

# Event day timings: lunch + talks from 1pm at Fort Canning, birding 4–6pm on site.
EVENT_START = "2026-10-10T13:00:00+08:00"
EVENT_END = "2026-10-10T18:00:00+08:00"

ADULT_PRICE = Decimal("28.00")
STUDENT_PRICE = Decimal("14.00")
CAPACITY_PER_SITE = 20  # 120 places across six sites
MAX_QTY = 5

TAG = "obd-2026"

# Event group tying the six sites together as one campaign. Enables the shared
# reserved allocation below (a pool that spans all six events).
GROUP_NAME = "October Big Day 2026"
GROUP_SLUG = "october-big-day-2026"

# Reserved allocation: NParks volunteers, one flat pool shared across all six
# sites. Priced low, one ticket per registration, gated by an access code that
# is generated once and stored in the DB (never hard-coded here) — the command
# prints it on creation so it can be circulated to volunteers.
ALLOCATION_CODE = "nparks"
ALLOCATION_NAME = "NParks Volunteer"
ALLOCATION_TOTAL_SLOTS = 15
ALLOCATION_PRICE = Decimal("5.00")
ALLOCATION_MAX_QTY = 1

# Landing page this event ties back to.
EVENT_HOME = "https://obd26.birdsociety.sg"

# Shared tie-back appended to every site description, linking to the OBD 2026
# landing page (obd26.birdsociety.sg) and summarising the day.
TIE_BACK = (
    '<p>This is one of six site groups for '
    f'<a href="{EVENT_HOME}">October Big Day 2026</a> on Saturday, 10 October. '
    "The afternoon starts with lunch and talks at Fort Canning Centre from 1&nbsp;pm, "
    "then shuttles run out to the birding sites for a 4–6&nbsp;pm bioblitz — every "
    "checklist counts towards eBird's global October Big Day. One flat fee covers "
    "lunch, the talks, a shuttle to your site and an event shirt.</p>"
    f'<p>Full programme, sites and FAQ at <a href="{EVENT_HOME}">obd26.birdsociety.sg</a>.</p>'
)

# Participant schema — carried over from the 2025 events.
JSON_SCHEMA = {
    "type": "object",
    "title": "Birding Participant Info",
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "required": ["age", "shirt_size", "years_of_birding_experience"],
    "properties": {
        "age": {
            "type": "integer",
            "minimum": 0,
            "description": "Age of the participant",
        },
        "shirt_size": {
            "enum": ["2XS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "5XL", "7XL"],
            "type": "string",
            "description": "Refer to the shirt size chart",
        },
        "dietary_restrictions": {
            "type": "string",
            "examples": ["Vegetarian", "Vegan", "Gluten-free", "Halal", "None"],
            "description": "Dietary restrictions (if any)",
        },
        "years_of_birding_experience": {"type": "number", "minimum": 0},
    },
}

# Student override; the adult price is the event's price_incl_tax fallback.
PRICE_TIERS = [
    {"code": "student", "name": "Student", "rule": "age:<=18", "price_incl_tax": 14.0},
]

# Six sites, in the order shown on the landing page.
#
# Each entry carries both the shop-event description (rich HTML, shown on the
# event page with TIE_BACK appended) and the landing-page "site card" fields
# (order, eBird hotspot, start/end points, plain-text card copy, display name).
# The card fields are written to ``event.metadata["site_card"]`` and served,
# drafts included, by the /events/site-cards endpoint so the landing page can
# auto-populate its Sites section. ``end=None`` renders as a single "Start & end".
SITES = [
    {
        "name": "Bidadari Park",
        "region": "Central",
        "card_name": "Bidadari Park",
        "ebird_url": "https://ebird.org/hotspot/L38405173",
        "start": "Bidadari Park Carpark",
        "end": "Lake View Deck · Alkaff Lake",
        "card_description": (
            "Singapore's best-known migrant trap. In October the young woodland "
            "and open lawns pull in flycatchers, cuckoos and thrushes on passage."
        ),
        "description": (
            "<p>Singapore's best-known migrant trap. In October the young "
            "woodland and open lawns pull in flycatchers, cuckoos and thrushes "
            "on passage.</p>"
        ),
    },
    {
        "name": "Bishan-AMK Park",
        "region": "Central",
        "card_name": "Bishan-Ang Mo Kio Park",
        "ebird_url": "https://ebird.org/hotspot/L3901811",
        "start": "Bishan-AMK Carpark B",
        "end": "Activity Lawn · fronting Carpark B",
        "card_description": (
            "A naturalised stretch of the Kallang River through open parkland — "
            "kingfishers, herons, and raptors moving over at dusk."
        ),
        "description": (
            "<p>A naturalised stretch of the Kallang River through open "
            "parkland — kingfishers, herons, and raptors moving over at dusk.</p>"
        ),
    },
    {
        "name": "Thomson Nature Park",
        "region": "North",
        "card_name": "Thomson Nature Park",
        "ebird_url": "https://ebird.org/hotspot/L10030487",
        "start": "Thomson Nature Park Car Park · single park exit",
        "end": None,
        "card_description": (
            "Secondary forest on the site of a former Hainan village, buffering "
            "the Central Catchment. Forest birds, and a chance of the Raffles' "
            "Banded Langur."
        ),
        "description": (
            "<p>Secondary forest on the site of a former Hainan village, "
            "buffering the Central Catchment. Forest birds, and a chance of the "
            "Raffles' Banded Langur.</p>"
        ),
    },
    {
        "name": "Fort Canning Park",
        "region": "City",
        "card_name": "Fort Canning Park",
        "ebird_url": "https://ebird.org/hotspot/L922737",
        "start": "Fort Canning Centre · the venue",
        "end": None,
        "card_description": (
            "The historic hill above the venue itself. Mature trees and spice "
            "gardens hold pittas and flycatchers in season — walk straight out "
            "from the talks."
        ),
        "description": (
            "<p>The historic hill above the venue itself. Mature trees and "
            "spice gardens hold pittas and flycatchers in season — walk straight "
            "out from the talks.</p>"
        ),
    },
    {
        "name": "Jurong Lake Gardens",
        "region": "West",
        "card_name": "Jurong Lake Gardens",
        "ebird_url": "https://ebird.org/hotspot/L3267940",
        "start": "South Carpark",
        "end": "Entrance Pavilion · near North Carpark",
        "card_description": (
            "Grassland, freshwater wetland and lakeside parkland in one loop — "
            "waterbirds and munias to migrant warblers in the reeds."
        ),
        "description": (
            "<p>Grassland, freshwater wetland and lakeside parkland in one "
            "loop — waterbirds and munias to migrant warblers in the reeds.</p>"
        ),
    },
    {
        "name": "Singapore Botanic Gardens",
        "region": "Central",
        "card_name": "Singapore Botanic Gardens",
        "ebird_url": "https://ebird.org/hotspot/L952084",
        "start": "Jacob Ballas Carpark",
        "end": "Botanic Gardens MRT entrance",
        "card_description": (
            "Eco-Lake, a rainforest fragment and curated gardens at a UNESCO "
            "World Heritage Site. Easy birding with a wide range of garden and "
            "water birds."
        ),
        "description": (
            "<p>Eco-Lake, a rainforest fragment and curated gardens at a UNESCO "
            "World Heritage Site. Easy birding with a wide range of garden and "
            "water birds.</p>"
        ),
    },
]

TITLE_PREFIX = "October Big Day 2026: "


def _dt(value):
    parsed = parse_datetime(value)
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


class Command(BaseCommand):
    help = "Create or update the six October Big Day 2026 site events (drafts by default)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would change without writing to the database.",
        )
        parser.add_argument(
            "--activate",
            action="store_true",
            help="Set is_active=True on the six events (makes them public / opens registration).",
        )
        parser.add_argument(
            "--deactivate",
            action="store_true",
            help="Set is_active=False on the six events (hides them from the public shop).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        if options["activate"] and options["deactivate"]:
            self.stderr.write("Pass at most one of --activate / --deactivate.")
            return

        # is_active resolution:
        #   --activate   -> True
        #   --deactivate -> False
        #   neither      -> keep existing (default False for new events / drafts)
        force_active = None
        if options["activate"]:
            force_active = True
        elif options["deactivate"]:
            force_active = False

        start = _dt(EVENT_START)
        end = _dt(EVENT_END)
        reg_start = _dt(REGISTRATION_START)
        reg_end = _dt(REGISTRATION_END)

        # Event group (umbrella over the six sites). Created up front so each
        # event can be attached to it in the loop below.
        group = None
        if not dry_run:
            group, group_created = EventGroup._default_manager.get_or_create(
                slug=GROUP_SLUG,
                defaults={"name": GROUP_NAME},
            )
            self.stdout.write(
                f"[{'CREATE' if group_created else 'EXISTS'}] group {GROUP_NAME} ({GROUP_SLUG})"
            )
        else:
            self.stdout.write(f"[GROUP] {GROUP_NAME} ({GROUP_SLUG})")

        created, updated = 0, 0

        for order, site in enumerate(SITES, start=1):
            title = TITLE_PREFIX + site["name"]
            location = f"{site['name']} · via Fort Canning Centre"

            # Landing-page site-card data, served (drafts included) by
            # /events/site-cards. Presentation only — never read by booking logic.
            site_card = {
                "order": order,
                "name": site["card_name"],
                "region": site["region"],
                "ebird_url": site["ebird_url"],
                "start": site["start"],
                "end": site["end"],
                "description": site["card_description"],
            }

            existing = OrganizedEvent._default_manager.filter(title=title).first()

            # is_active: new drafts default False; existing keep unless forced.
            if existing is None:
                is_active = False if force_active is None else force_active
            else:
                is_active = existing.is_active if force_active is None else force_active

            fields = dict(
                description=site["description"] + TIE_BACK,
                start_date=start,
                end_date=end,
                location=location,
                max_participants=CAPACITY_PER_SITE,
                max_qty=MAX_QTY,
                price_incl_tax=ADULT_PRICE,
                currency="SGD",
                json_schema=JSON_SCHEMA,
                price_tiers=PRICE_TIERS,
                validate_participant_data=True,
                registration_required=True,
                registration_open=True,
                registration_start=reg_start,
                registration_end=reg_end,
                signup_mode=OrganizedEvent.SIGNUP_MODE_FIRST_COME,
                waitlist_enabled=False,
                tags=[TAG],
                metadata={"site_card": site_card},
                group=group,
                is_active=is_active,
            )

            action = "CREATE" if existing is None else "UPDATE"
            state = "active" if is_active else "draft"
            self.stdout.write(f"[{action}] {title} ({state}, cap {CAPACITY_PER_SITE})")

            if dry_run:
                continue

            with transaction.atomic():
                if existing is None:
                    OrganizedEvent._default_manager.create(title=title, **fields)
                    created += 1
                else:
                    for key, val in fields.items():
                        setattr(existing, key, val)
                    existing.save()
                    updated += 1

        if dry_run:
            self.stdout.write(
                f"[ALLOCATION] {ALLOCATION_NAME}: {ALLOCATION_TOTAL_SLOTS} slots @ "
                f"${ALLOCATION_PRICE}, max {ALLOCATION_MAX_QTY}/registration"
            )
            self.stdout.write(self.style.WARNING("Dry-run: no changes applied."))
            return

        # Reserved allocation for the group. Idempotent: created once with a
        # freshly generated access code stored in the DB; re-runs keep the
        # existing code and slot count so the circulated link stays valid.
        allocation, alloc_created = EventAllocation._default_manager.get_or_create(
            group=group,
            code=ALLOCATION_CODE,
            defaults={
                "name": ALLOCATION_NAME,
                "total_slots": ALLOCATION_TOTAL_SLOTS,
                "price_incl_tax": ALLOCATION_PRICE,
                "max_qty_per_registration": ALLOCATION_MAX_QTY,
                "access_code": f"NPARKS-OBD26-{secrets.token_hex(3).upper()}",
                "is_active": True,
            },
        )
        if alloc_created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"[CREATE] allocation {ALLOCATION_NAME}: {ALLOCATION_TOTAL_SLOTS} "
                    f"slots @ ${ALLOCATION_PRICE}, max {ALLOCATION_MAX_QTY}/registration"
                )
            )
        else:
            self.stdout.write(
                f"[EXISTS] allocation {ALLOCATION_NAME} "
                f"({allocation.claimed}/{allocation.total_slots} claimed) — code preserved"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. {created} created, {updated} updated. "
                f"State: {'ACTIVE (public)' if force_active else 'draft (hidden)' if force_active is False else 'unchanged'}."
            )
        )
        self.stdout.write(
            self.style.WARNING(
                f"\nNParks access code: {allocation.access_code}\n"
                "Append it to any site link as ?access=<code> and circulate to volunteers."
            )
        )
