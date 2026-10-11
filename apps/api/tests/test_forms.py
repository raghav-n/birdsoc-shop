from __future__ import annotations

import uuid

from django.contrib.auth.models import Group
from django.core import mail
from oscar.core.loading import get_model
from rest_framework.test import APITestCase

from apps.api.tests.utils import auth_client, create_event, create_user
from apps.form.models import Form, FormField, FormInvite, FormSubmission


EventGroup = get_model("event", "EventGroup")
Participant = get_model("event", "Participant")
EventParticipant = get_model("event", "EventParticipant")


def _events_staff_client(client):
    group, _ = Group.objects.get_or_create(name="Events")
    user = create_user(email="events_staff@example.com")
    user.groups.add(group)
    auth_client(client, email="events_staff@example.com")
    return client


def _book(event, first, email, **kwargs):
    p = Participant.objects.create(first_name=first, last_name="Birder", email=email)
    defaults = {"is_confirmed": True}
    defaults.update(kwargs)
    return EventParticipant.objects.create(event=event, participant=p, **defaults)


class FeedbackFormBase(APITestCase):
    def setUp(self):
        self.group = EventGroup.objects.create(name="October Big Day 2026", slug="obd-2026")
        self.site_a = create_event(title="Site A")
        self.site_b = create_event(title="Site B")
        for e in (self.site_a, self.site_b):
            e.group = self.group
            e.save()
        self.form = Form.objects.create(name="OBD feedback", slug="obd-feedback", event_group=self.group)
        FormField.objects.create(form=self.form, key="overall", label="Overall", field_type="rating", order=0)
        FormField.objects.create(form=self.form, key="recommend", label="Recommend", field_type="scale", order=1)
        FormField.objects.create(
            form=self.form, key="again", label="Again?", field_type="select",
            choices="Yes\nMaybe\nNo", required=False, order=2,
        )
        FormField.objects.create(
            form=self.form, key="comments", label="Comments", field_type="textarea", required=False, order=3,
        )
        self.ep_a = _book(self.site_a, "Alice", "alice@example.com", attended=True)
        self.ep_b = _book(self.site_b, "Bob", "bob@example.com")
        # Not eligible: cancelled, waitlisted, no email.
        _book(self.site_a, "Cat", "cat@example.com", is_cancelled=True)
        _book(self.site_a, "Dan", "dan@example.com", is_waitlisted=True)
        _book(self.site_b, "Eve", "")


class PublicFormTests(FeedbackFormBase):
    def test_schema_includes_rating_fields(self):
        r = self.client.get("/api/v1/forms/obd-feedback/schema")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([f["type"] for f in r.data["fields"]], ["rating", "scale", "select", "textarea"])
        self.assertIsNone(r.data["respondent"])

    def test_anonymous_submit(self):
        r = self.client.post(
            "/api/v1/forms/obd-feedback/submit", {"overall": 5, "recommend": 9}, format="json"
        )
        self.assertEqual(r.status_code, 201, r.data)
        sub = FormSubmission.objects.get()
        self.assertEqual(sub.data, {"overall": 5, "recommend": 9})
        self.assertIsNone(sub.invite)

    def test_rating_out_of_range(self):
        for bad in (0, 6, "4.5", "great"):
            r = self.client.post(
                "/api/v1/forms/obd-feedback/submit", {"overall": bad, "recommend": 9}, format="json"
            )
            self.assertEqual(r.status_code, 400, bad)
            self.assertIn("overall", r.data["errors"])
        r = self.client.post(
            "/api/v1/forms/obd-feedback/submit", {"overall": 3, "recommend": 11}, format="json"
        )
        self.assertIn("recommend", r.data["errors"])

    def test_anonymous_blocked_when_disallowed(self):
        self.form.allow_anonymous = False
        self.form.save()
        r = self.client.post(
            "/api/v1/forms/obd-feedback/submit", {"overall": 5, "recommend": 9}, format="json"
        )
        self.assertEqual(r.status_code, 403)

    def test_personal_link_attributes_and_edits_response(self):
        invite = FormInvite.objects.create(form=self.form, event_participant=self.ep_a)
        url = f"/api/v1/forms/obd-feedback/submit?token={invite.token}"
        r = self.client.post(url, {"overall": 4, "recommend": 8}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        r = self.client.post(url, {"overall": 5, "recommend": 10, "again": "Yes"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        sub = FormSubmission.objects.get()
        self.assertEqual(sub.invite, invite)
        self.assertEqual(sub.data["overall"], 5)

        r = self.client.get(f"/api/v1/forms/obd-feedback/schema?token={invite.token}")
        self.assertEqual(r.data["respondent"], {"first_name": "Alice", "event": "Site A"})
        self.assertEqual(r.data["existing_response"]["data"]["again"], "Yes")

    def test_bad_token_404(self):
        for token in (uuid.uuid4(), "not-a-uuid"):
            r = self.client.get(f"/api/v1/forms/obd-feedback/schema?token={token}")
            self.assertEqual(r.status_code, 404)

    def test_token_for_other_form_rejected(self):
        other = Form.objects.create(name="Other", slug="other", event_group=self.group)
        invite = FormInvite.objects.create(form=other, event_participant=self.ep_a)
        r = self.client.get(f"/api/v1/forms/obd-feedback/schema?token={invite.token}")
        self.assertEqual(r.status_code, 404)


class ConsoleFormTests(FeedbackFormBase):
    def test_requires_events_staff(self):
        self.assertIn(self.client.get("/api/v1/console/forms").status_code, (401, 403))
        create_user(email="plain@example.com")
        auth_client(self.client, email="plain@example.com")
        self.assertEqual(self.client.get("/api/v1/console/forms").status_code, 403)

    def test_create_form_with_fields(self):
        _events_staff_client(self.client)
        r = self.client.post(
            "/api/v1/console/forms",
            {
                "name": "Night walk feedback",
                "event_group_id": self.group.id,
                "fields": [
                    {"label": "How was it?", "type": "rating", "required": True},
                    {"label": "How was it?", "type": "textarea"},
                    {"label": "Pick", "type": "select", "choices": ["A", "B"]},
                ],
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["slug"], "night-walk-feedback")
        self.assertEqual([f["key"] for f in r.data["fields"]], ["how_was_it", "how_was_it_2", "pick"])
        self.assertEqual(r.data["fields"][2]["choices"], ["A", "B"])

    def test_select_needs_options(self):
        _events_staff_client(self.client)
        r = self.client.post(
            "/api/v1/console/forms",
            {"name": "X", "fields": [{"label": "Pick", "type": "select"}]},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_duplicate_slug_rejected(self):
        _events_staff_client(self.client)
        r = self.client.post("/api/v1/console/forms", {"name": "X", "slug": "obd-feedback"}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_reorder_keeps_keys_and_drops_removed(self):
        _events_staff_client(self.client)
        fields = self.client.get(f"/api/v1/console/forms/{self.form.id}").data["fields"]
        by_key = {f["key"]: f for f in fields}
        new_order = [by_key["recommend"], by_key["overall"], {"label": "New one", "type": "text"}]
        r = self.client.patch(
            f"/api/v1/console/forms/{self.form.id}", {"fields": new_order}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([f["key"] for f in r.data["fields"]], ["recommend", "overall", "new_one"])
        self.assertEqual(r.data["fields"][0]["id"], by_key["recommend"]["id"])

    def test_responses_summary_and_csv(self):
        invite = FormInvite.objects.create(form=self.form, event_participant=self.ep_a)
        FormSubmission.objects.create(
            form=self.form, invite=invite, data={"overall": 4, "recommend": 10, "again": "Yes"}
        )
        FormSubmission.objects.create(form=self.form, data={"overall": 2, "recommend": 5})
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/forms/{self.form.id}/responses")
        self.assertEqual(r.status_code, 200)
        summary = {s["key"]: s for s in r.data["summary"]}
        self.assertEqual(summary["overall"]["average"], 3.0)
        self.assertEqual(summary["overall"]["by_site"], [{"event": "Site A", "average": 4.0, "count": 1}])
        self.assertEqual(summary["recommend"]["nps"], 0)
        self.assertEqual(summary["again"]["counts"][0], {"value": "Yes", "count": 1})
        self.assertEqual(len(r.data["responses"]), 2)

        r = self.client.get(f"/api/v1/console/forms/{self.form.id}/responses.csv")
        self.assertEqual(r.status_code, 200)
        lines = r.content.decode().strip().splitlines()
        self.assertEqual(len(lines), 3)
        self.assertIn("Alice Birder", r.content.decode())

    def test_site_answer_drives_per_site_summary(self):
        FormField.objects.create(
            form=self.form, key="site", label="Site", field_type="select", choices="Site A\nSite B", order=9,
        )
        FormSubmission.objects.create(form=self.form, data={"site": "Site B", "overall": 5, "recommend": 9})
        FormSubmission.objects.create(form=self.form, data={"site": "Site B", "overall": 3, "recommend": 9})
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/forms/{self.form.id}/responses")
        overall = next(s for s in r.data["summary"] if s["key"] == "overall")
        self.assertEqual(overall["by_site"], [{"event": "Site B", "average": 4.0, "count": 2}])

    def test_obd_feedback_form_migration(self):
        form = Form.objects.get(slug="obd-2026-feedback")
        fields = list(form.fields.all())
        self.assertEqual(fields[0].key, "site")
        self.assertEqual([f.key for f in fields if f.required], ["site"])
        self.assertTrue(len(fields[0].choices_list()) > 0)
        self.assertEqual(form.invites.count(), 0)

    def test_invites_list_and_send_in_batches(self):
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/forms/{self.form.id}/invites")
        self.assertEqual([p["name"] for p in r.data["participants"]], ["Alice Birder", "Bob Birder"])
        self.assertIsNone(r.data["participants"][0]["link"])

        url = f"/api/v1/console/forms/{self.form.id}/invites"
        r = self.client.post(url, {"limit": 1}, format="json")
        self.assertEqual(r.data, {"sent": 1, "failed": [], "remaining": 1})
        r = self.client.post(url, {"limit": 1}, format="json")
        self.assertEqual(r.data, {"sent": 1, "failed": [], "remaining": 0})
        r = self.client.post(url, {}, format="json")
        self.assertEqual(r.data["sent"], 0)

        self.assertEqual(len(mail.outbox), 2)
        invite = FormInvite.objects.get(event_participant=self.ep_a)
        self.assertIn(f"/forms/obd-feedback/{invite.token}", mail.outbox[0].body)
        self.assertIn("Hi Alice", mail.outbox[0].body)
        self.assertIn("October Big Day 2026", mail.outbox[0].subject)

        r = self.client.get(url)
        self.assertTrue(all(p["emailed_at"] for p in r.data["participants"]))

    def test_send_attended_only(self):
        _events_staff_client(self.client)
        url = f"/api/v1/console/forms/{self.form.id}/invites"
        r = self.client.post(url, {"attended_only": True}, format="json")
        self.assertEqual(r.data["sent"], 1)
        self.assertEqual(mail.outbox[0].to, ["alice@example.com"])

    def test_send_requires_group_and_open_form(self):
        _events_staff_client(self.client)
        url = f"/api/v1/console/forms/{self.form.id}/invites"
        self.form.accept_submissions = False
        self.form.save()
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        self.form.accept_submissions = True
        self.form.event_group = None
        self.form.save()
        self.assertEqual(self.client.post(url, {}, format="json").status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_group_detail_lists_forms(self):
        _events_staff_client(self.client)
        r = self.client.get(f"/api/v1/console/event-groups/{self.group.id}")
        self.assertEqual(r.data["forms"], [{"id": self.form.id, "name": "OBD feedback"}])
