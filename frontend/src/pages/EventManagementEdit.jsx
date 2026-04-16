import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 720px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Title = styled.h1`
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0.3rem 0 1.75rem;
`;

const Section = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
`;

const SectionTitle = styled.h2`
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin: 0 0 1rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: ${p => p.$cols || '1fr'};
  gap: 0.75rem 1rem;
  margin-bottom: 0.75rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const Label = styled.label`
  font-size: 0.8rem;
  font-weight: 500;
  color: #374151;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const Textarea = styled.textarea`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
`;

const Hint = styled.p`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
`;

const Button = styled.button`
  padding: 0.55rem 1.25rem;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
  background: var(--link-text);
  color: #fff;
  &:hover:not(:disabled) { opacity: 0.88; }
`;

const SecondaryButton = styled(Button)`
  background: #fff;
  border-color: #d1d5db;
  color: var(--text-primary);
  &:hover:not(:disabled) { background: #f9fafb; }
`;

const AdvancedToggle = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 1rem;
  &:hover { color: var(--text-primary); }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  // datetime-local input wants "YYYY-MM-DDTHH:mm"
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function jsonOrNull(str) {
  if (!str || !str.trim()) return null;
  try { return JSON.parse(str); } catch { return str; }
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  location: '',
  max_participants: '',
  is_active: true,
  price_incl_tax: '0.00',
  currency: 'SGD',
  json_schema: '',
  price_tiers: '',
  validate_participant_data: false,
  confirmed_email_template: '',
};

export default function EventManagementEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (isNew) return;
    consoleEventService.getEvent(id)
      .then(event => {
        setForm({
          title: event.title || '',
          description: event.description || '',
          start_date: toLocalDatetimeInput(event.start_date),
          end_date: toLocalDatetimeInput(event.end_date),
          location: event.location || '',
          max_participants: event.max_participants ?? '',
          is_active: event.is_active,
          price_incl_tax: event.price_incl_tax || '0.00',
          currency: event.currency || 'SGD',
          json_schema: event.json_schema ? JSON.stringify(event.json_schema, null, 2) : '',
          price_tiers: event.price_tiers ? JSON.stringify(event.price_tiers, null, 2) : '',
          validate_participant_data: event.validate_participant_data || false,
          confirmed_email_template: event.confirmed_email_template || '',
        });
        // Show advanced section if any advanced field has content
        if (event.json_schema || event.price_tiers || event.confirmed_email_template) {
          setShowAdvanced(true);
        }
      })
      .catch(() => toast.error('Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.start_date) { toast.error('Start date is required'); return; }

    // Validate JSON fields
    const jsonFields = ['json_schema', 'price_tiers'];
    for (const f of jsonFields) {
      if (form[f].trim()) {
        try { JSON.parse(form[f]); }
        catch { toast.error(`${f} is not valid JSON`); return; }
      }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      location: form.location.trim(),
      max_participants: form.max_participants !== '' ? Number(form.max_participants) : null,
      is_active: form.is_active,
      price_incl_tax: form.price_incl_tax,
      currency: form.currency.trim() || 'SGD',
      json_schema: jsonOrNull(form.json_schema),
      price_tiers: jsonOrNull(form.price_tiers),
      validate_participant_data: form.validate_participant_data,
      confirmed_email_template: form.confirmed_email_template.trim() || null,
    };

    setSaving(true);
    try {
      if (isNew) {
        const event = await consoleEventService.createEvent(payload);
        toast.success('Event created');
        navigate(`/console/events/${event.id}`);
      } else {
        await consoleEventService.updateEvent(id, payload);
        toast.success('Event saved');
        navigate(`/console/events/${id}`);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to save event';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;

  const backPath = isNew ? '/console/events' : `/console/events/${id}`;
  const backLabel = isNew ? '← Events' : '← Back to event';

  return (
    <Page>
      <BackLink to={backPath}>{backLabel}</BackLink>
      <Title>{isNew ? 'New Event' : 'Edit Event'}</Title>

      <form onSubmit={handleSubmit}>
        {/* Basic info */}
        <Section>
          <SectionTitle>Basic Info</SectionTitle>

          <Row>
            <Field>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={set('title')}
                placeholder="Event title"
              />
            </Field>
          </Row>

          <Row>
            <Field>
              <Label>Description</Label>
              <Textarea
                rows={4}
                style={{ fontFamily: 'inherit' }}
                value={form.description}
                onChange={set('description')}
                placeholder="Event description (shown to attendees)"
              />
            </Field>
          </Row>

          <Row $cols="1fr 1fr">
            <Field>
              <Label>Start Date & Time *</Label>
              <Input
                type="datetime-local"
                value={form.start_date}
                onChange={set('start_date')}
              />
            </Field>
            <Field>
              <Label>End Date & Time</Label>
              <Input
                type="datetime-local"
                value={form.end_date}
                onChange={set('end_date')}
              />
            </Field>
          </Row>

          <Row>
            <Field>
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={set('location')}
                placeholder="Venue or address"
              />
            </Field>
          </Row>

          <Row $cols="1fr 1fr">
            <Field>
              <Label>Max Participants</Label>
              <Input
                type="number"
                min="1"
                value={form.max_participants}
                onChange={set('max_participants')}
                placeholder="Unlimited"
              />
            </Field>
            <div />
          </Row>

          <Row>
            <Field>
              <CheckboxRow>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={set('is_active')}
                />
                Active (visible on the events page)
              </CheckboxRow>
            </Field>
          </Row>
        </Section>

        {/* Pricing */}
        <Section>
          <SectionTitle>Pricing</SectionTitle>
          <Row $cols="1fr 1fr">
            <Field>
              <Label>Base Price (incl. tax)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price_incl_tax}
                onChange={set('price_incl_tax')}
              />
              <Hint>Set to 0 for a free event.</Hint>
            </Field>
            <Field>
              <Label>Currency</Label>
              <Input
                value={form.currency}
                onChange={set('currency')}
                placeholder="SGD"
              />
            </Field>
          </Row>
        </Section>

        {/* Advanced */}
        <Section>
          <AdvancedToggle type="button" onClick={() => setShowAdvanced(v => !v)}>
            {showAdvanced ? '▾' : '▸'} Advanced settings
          </AdvancedToggle>

          {showAdvanced && (
            <>
              <Row>
                <Field>
                  <Label>Price Tiers (JSON)</Label>
                  <Textarea
                    rows={6}
                    value={form.price_tiers}
                    onChange={set('price_tiers')}
                    placeholder={`[\n  {"code":"student","name":"Student","rule":"age:<25","price_incl_tax":10},\n  {"code":"adult","name":"Adult","rule":"*","price_incl_tax":15}\n]`}
                  />
                  <Hint>List of pricing rules. First matching rule wins. Use "rule": "*" as a catch-all.</Hint>
                </Field>
              </Row>

              <Row>
                <Field>
                  <Label>Participant Data Schema (JSON)</Label>
                  <Textarea
                    rows={6}
                    value={form.json_schema}
                    onChange={set('json_schema')}
                    placeholder={`{\n  "type": "object",\n  "properties": {\n    "age": { "type": "number" }\n  }\n}`}
                  />
                  <Hint>JSON Schema for additional participant fields shown on the registration form.</Hint>
                </Field>
              </Row>

              <Row>
                <Field>
                  <CheckboxRow>
                    <input
                      type="checkbox"
                      checked={form.validate_participant_data}
                      onChange={set('validate_participant_data')}
                    />
                    Validate participant data against the schema
                  </CheckboxRow>
                </Field>
              </Row>

              <Row>
                <Field>
                  <Label>Payment Confirmation Email Template (HTML)</Label>
                  <Textarea
                    rows={10}
                    value={form.confirmed_email_template}
                    onChange={set('confirmed_email_template')}
                    placeholder="Leave blank to use the default template. Available variables: {{first_name}}, {{last_name}}, {{email}}, {{event_title}}, {{event_date}}, {{event_location}}, {{amount}}, {{currency}}, {{registration_reference}}"
                  />
                </Field>
              </Row>
            </>
          )}
        </Section>

        <ButtonRow>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Changes'}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => navigate(backPath)}>
            Cancel
          </SecondaryButton>
        </ButtonRow>
      </form>
    </Page>
  );
}
