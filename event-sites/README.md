# Standalone event sites

Static microsites for one-off events, each in its own folder and deployed
independently of the shop's Django app. They read event data (sites, capacity,
registration links) from the shop's public events API (`EVENT_API.md`).

| Folder | Live at | Deploy workflow |
|---|---|---|
| `obd-2026/` | https://obd26.birdsociety.sg/ | `.github/workflows/deploy-obd-2026.yml` |

`obd-2026/` was merged in from the `raghav-n/october-big-day` repo with its full
history (`git log -- event-sites/obd-2026`).

## Adding a new event site

1. Create `event-sites/<slug>/` with its own `deploy.sh`.
2. Copy `deploy-obd-2026.yml` to `deploy-<slug>.yml` and point its `paths:` and
   `working-directory` at the new folder.
   `django.yml` already ignores `event-sites/**` and `deploy-*.yml`, so the
   shop's own CI won't run for event-site-only changes.
