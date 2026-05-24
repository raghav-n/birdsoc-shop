# PayNow Apps Script

Polls the Gmail inbox of **sales@birdsociety.sg** for Maybank "PayNow Alert"
emails. Extracts the order/event reference + amount and POSTs a signed JWT to
the shop's `verify-payment` / `verify-event-payment` endpoints, which place
the order from the matching `PendingCheckout` and mark it paid.

## Files
- `paynow-poller.gs` — main script (function: `processPayNowEmails`)
- `appsscript.json` — manifest (timezone, OAuth scopes, V8 runtime)

## One-time setup
1. Sign in to https://script.google.com as **sales@birdsociety.sg** and
   create a new project.
2. Replace the default `Code.gs` with `paynow-poller.gs` and the manifest
   with `appsscript.json` (Project Settings → "Show appsscript.json manifest").
3. Under **Project Settings → Script properties**, set:
   - `JWT_SECRET` — must match the Django app's JWT secret.
   - (Optional overrides) `ORDER_REGEX`, `AMOUNT_REGEX`, `EVENT_REG_REF_REGEX`,
     `ORDER_API_URL`, `EVENT_API_URL`, `GMAIL_QUERY`.
4. **Triggers** → add a time-driven trigger calling `processPayNowEmails`
   every 1–5 minutes.

## Deploying from this repo via `clasp`

[clasp](https://github.com/google/clasp) is Google's CLI for Apps Script.
It lets us treat the script like normal source.

```sh
npm install -g @google/clasp

# one-time: authorise clasp against the sales@birdsociety.sg account
clasp login

# one-time: link this folder to the existing script project
cd scripts/apps-script
clasp clone <SCRIPT_ID>   # SCRIPT_ID is in the Apps Script URL
# (or `clasp create --type standalone --title "PayNow Poller"` for a fresh one)

# push local changes
clasp push
```

`clasp clone` will create a `.clasp.json` with the script ID — commit it so
the rest of the team can `clasp push` without re-cloning.

## CI/CD

You can have GitHub Actions push the script on every merge to `master`.
Apps Script doesn't have a "staging" environment, so this deploys straight
to prod — gate it on the same branch you already deploy the Django app from.

### Generating CI credentials (one-time, on your laptop)

`clasp` in CI needs a saved OAuth token, not an interactive login:

```sh
clasp login --creds path/to/oauth-client.json
# produces ~/.clasprc.json
cat ~/.clasprc.json
```

The `oauth-client.json` comes from a GCP project (any project under the
birdsociety workspace works) with the Apps Script API enabled and an OAuth
2.0 Client ID of type "Desktop app". Authorise the flow with
`sales@birdsociety.sg` so the resulting refresh token lives on that account.

Copy the full `~/.clasprc.json` contents into a GitHub Actions secret called
`CLASPRC_JSON`.

### Workflow

Add `.github/workflows/apps-script.yml`:

```yaml
name: Deploy Apps Script
on:
  push:
    branches: [master]
    paths: ['scripts/apps-script/**']
  workflow_dispatch:

jobs:
  push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install -g @google/clasp
      - run: echo "$CLASPRC_JSON" > ~/.clasprc.json
        env:
          CLASPRC_JSON: ${{ secrets.CLASPRC_JSON }}
      - run: clasp push --force
        working-directory: scripts/apps-script
```

Notes / caveats:
- `JWT_SECRET` and the other script properties live in the Apps Script
  project, not in the repo. CI doesn't touch them.
- The OAuth refresh token in `CLASPRC_JSON` is sales@'s — rotate it (re-run
  `clasp login --creds` and update the secret) if that account's password
  changes or the token is revoked.
- Triggers (the cron schedule) are *not* synced by clasp — set them once in
  the UI and they stick.
