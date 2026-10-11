import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { ArrowUp, ArrowDown, Trash2, Plus, ExternalLink } from 'lucide-react';
import { consoleFormService as svc } from '../services/forms';
import HelpModal from '../components/HelpModal';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 860px;
  margin: 2rem auto;
  padding: 0 1rem 6rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.2rem 0 1.5rem;
`;

const Section = styled.section`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
`;

const SectionTitle = styled.h2`
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin: 0 0 1rem;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1rem;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  grid-column: ${p => (p.$wide ? '1 / -1' : 'auto')};
`;

const Hint = styled.span`
  font-weight: 400;
  color: var(--text-secondary);
  font-size: 0.78rem;
`;

const inputCss = `
  padding: 0.5rem 0.65rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  font-family: inherit;
  font-weight: 400;
  background: #fff;
  &:focus { outline: none; border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(76,122,45,0.15); }
`;

const TextInput = styled.input`${inputCss}`;
const TextBox = styled.textarea`${inputCss} resize: vertical; min-height: ${p => p.$rows || 3}em;`;
const Dropdown = styled.select`${inputCss}`;

const Toggles = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  grid-column: 1 / -1;
`;

const Check = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  cursor: pointer;
  input { accent-color: var(--link-text); }
`;

const QuestionCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.9rem 1rem;
  margin-bottom: 0.75rem;
  background: #fcfcfb;
`;

const QuestionTop = styled.div`
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  @media (max-width: 640px) { flex-wrap: wrap; }
`;

const QNum = styled.span`
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 0.85rem;
  padding-top: 0.5rem;
  min-width: 1.4rem;
`;

const QuestionBody = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem 1rem;
  margin: 0.7rem 0 0 2rem;
  @media (max-width: 640px) { grid-template-columns: 1fr; margin-left: 0; }
`;

const IconBtn = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: ${p => (p.$danger ? '#dc2626' : 'var(--text-secondary)')};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  &:hover:not(:disabled) { border-color: ${p => (p.$danger ? '#f87171' : 'var(--link-text)')}; }
  &:disabled { opacity: 0.35; cursor: default; }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
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

const EmptyQuestions = styled.div`
  text-align: center;
  padding: 1.5rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const SaveBar = styled.div`
  position: sticky;
  bottom: 0;
  background: var(--page-background);
  border-top: 1px solid #e5e7eb;
  padding: 0.75rem 0;
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const UrlPreview = styled.code`
  font-size: 0.78rem;
  color: var(--text-secondary);
  word-break: break-all;
`;

// ─── Question types and template ─────────────────────────────────────────────

const FIELD_TYPES = [
  { value: 'rating', label: 'Star rating (1–5)' },
  { value: 'scale', label: 'Likelihood scale (0–10)' },
  { value: 'select', label: 'Single choice' },
  { value: 'multiselect', label: 'Multiple choice' },
  { value: 'text', label: 'Short answer' },
  { value: 'textarea', label: 'Long answer' },
  { value: 'checkbox', label: 'Yes/no checkbox' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'date', label: 'Date' },
];

const HAS_CHOICES = ['select', 'multiselect'];

let tempId = 0;
const newQuestion = (overrides = {}) => ({
  _tmp: `new-${++tempId}`,
  id: null,
  key: '',
  label: '',
  type: 'rating',
  required: false,
  help_text: '',
  placeholder: '',
  choices: [],
  ...overrides,
});

const EVENT_FEEDBACK_TEMPLATE = () => [
  newQuestion({ label: 'Overall, how would you rate the day?', type: 'rating', required: true }),
  newQuestion({ label: 'How would you rate your guide?', type: 'rating' }),
  newQuestion({
    label: 'How well organised was the event?',
    type: 'rating',
    help_text: 'Registration, briefing, timing and communication',
  }),
  newQuestion({ label: 'How likely are you to recommend our events to a friend?', type: 'scale' }),
  newQuestion({ label: 'What was the highlight of your day?', type: 'textarea' }),
  newQuestion({ label: 'What could we do better next time?', type: 'textarea' }),
  newQuestion({ label: 'Would you join us again next year?', type: 'select', choices: ['Yes', 'Maybe', 'No'] }),
  newQuestion({ label: 'Anything else you would like to tell us?', type: 'textarea' }),
];

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  event_group_id: '',
  is_active: true,
  accept_submissions: true,
  allow_anonymous: true,
  success_message: 'Thanks for your response!',
  email_subject: '',
  email_body: '',
};

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ─── Component ────────────────────────────────────────────────────────────────

export default function FormBuilder() {
  const { id } = useParams();
  const isNew = !id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [questions, setQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [defaults, setDefaults] = useState({ subject: '', body: '' });
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [hasResponses, setHasResponses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await svc.listForms();
        if (cancelled) return;
        setGroups(list.event_groups);
        if (isNew) {
          const groupId = searchParams.get('group');
          const group = list.event_groups.find(g => String(g.id) === groupId);
          if (group) {
            const name = `${group.name} feedback`;
            setForm(f => ({ ...f, event_group_id: group.id, name, slug: slugify(name) }));
            setQuestions(EVENT_FEEDBACK_TEMPLATE());
          }
          setDefaults({ subject: list.default_email_subject, body: list.default_email_body });
          return;
        }
        const data = await svc.getForm(id);
        if (cancelled) return;
        setForm({
          ...EMPTY_FORM,
          ...Object.fromEntries(Object.keys(EMPTY_FORM).map(k => [k, data[k] ?? EMPTY_FORM[k]])),
          event_group_id: data.event_group?.id || '',
        });
        setDefaults({ subject: data.default_email_subject, body: data.default_email_body });
        setHasResponses(data.response_count > 0);
        setQuestions(data.fields.map(f => ({ ...newQuestion(), ...f, _tmp: `f-${f.id}`, choices: f.choices || [] })));
      } catch {
        toast.error('Failed to load form');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew, searchParams]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const setName = (name) => {
    setForm(f => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
  };

  const updateQuestion = (idx, patch) =>
    setQuestions(qs => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const moveQuestion = (idx, delta) =>
    setQuestions(qs => {
      const next = [...qs];
      const [q] = next.splice(idx, 1);
      next.splice(idx + delta, 0, q);
      return next;
    });

  const removeQuestion = (idx) => {
    const q = questions[idx];
    if (q.id && hasResponses && !window.confirm(`Remove "${q.label}"? Answers already given to it will no longer be shown.`)) return;
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Give the form a name'); return; }
    const blank = questions.findIndex(q => !q.label.trim());
    if (blank >= 0) { toast.error(`Question ${blank + 1} needs a label`); return; }
    setSaving(true);
    const payload = {
      ...form,
      event_group_id: form.event_group_id || null,
      fields: questions.map(q => ({
        id: q.id,
        key: q.key,
        label: q.label,
        type: q.type,
        required: q.required,
        help_text: q.help_text,
        placeholder: q.placeholder,
        choices: HAS_CHOICES.includes(q.type) ? q.choices : [],
      })),
    };
    try {
      const saved = isNew ? await svc.createForm(payload) : await svc.updateForm(id, payload);
      toast.success('Form saved');
      navigate(`/console/forms/${saved.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save form');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Page>Loading…</Page>;

  const publicUrl = `${window.location.origin}/forms/${form.slug || '…'}`;

  return (
    <Page>
      <HelpModal title="How to use: Form builder">
        <h3>Settings</h3>
        <ul>
          <li><strong>Link name</strong> sets the public address, e.g. <code>/forms/obd-2026-feedback</code>.</li>
          <li>Link the form to an <strong>event group</strong> to send personal links to its participants and see responses by site.</li>
          <li>Turn off <strong>Allow anonymous responses</strong> to accept answers only through personal links.</li>
        </ul>
        <h3>Questions</h3>
        <ul>
          <li><strong>Star rating</strong> is 1 to 5. <strong>Likelihood scale</strong> is 0 to 10 and also gives a recommend score (NPS) on the responses page.</li>
          <li>Single and multiple choice questions need one option per line.</li>
          <li>Removing a question hides its existing answers, so avoid removing questions after invites have gone out.</li>
        </ul>
        <h3>Invite email</h3>
        <p>Leave blank to use the default. Placeholders: <code>{'{first_name}'}</code>, <code>{'{event}'}</code> (the site), <code>{'{group}'}</code>, <code>{'{link}'}</code> (the personal link).</p>
      </HelpModal>

      <BackLink to={isNew ? '/console/forms' : `/console/forms/${id}`}>← {isNew ? 'Forms' : 'Responses'}</BackLink>
      <Title>{isNew ? 'New form' : `Edit: ${form.name}`}</Title>

      <Section>
        <SectionTitle>Settings</SectionTitle>
        <Grid>
          <Field>
            Form name
            <TextInput value={form.name} onChange={e => setName(e.target.value)} placeholder="October Big Day 2026 feedback" />
          </Field>
          <Field>
            Link name
            <TextInput
              value={form.slug}
              onChange={e => { setSlugTouched(true); set('slug', slugify(e.target.value)); }}
              placeholder="obd-2026-feedback"
            />
            <UrlPreview>{publicUrl}</UrlPreview>
          </Field>
          <Field $wide>
            Introduction <Hint>Shown at the top of the form</Hint>
            <TextBox value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
          <Field>
            Event group <Hint>Participants who can be sent a personal link</Hint>
            <Dropdown value={form.event_group_id} onChange={e => set('event_group_id', e.target.value)}>
              <option value="">None</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Dropdown>
          </Field>
          <Field>
            Thank-you message
            <TextInput value={form.success_message} onChange={e => set('success_message', e.target.value)} />
          </Field>
          <Toggles>
            <Check><input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Form is live</Check>
            <Check><input type="checkbox" checked={form.accept_submissions} onChange={e => set('accept_submissions', e.target.checked)} /> Accepting responses</Check>
            <Check><input type="checkbox" checked={form.allow_anonymous} onChange={e => set('allow_anonymous', e.target.checked)} /> Allow anonymous responses</Check>
          </Toggles>
        </Grid>
      </Section>

      <Section>
        <SectionTitle>Questions</SectionTitle>
        {questions.length === 0 ? (
          <EmptyQuestions>
            No questions yet.
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <PrimaryButton type="button" onClick={() => setQuestions(EVENT_FEEDBACK_TEMPLATE())}>
                Start from event feedback template
              </PrimaryButton>
              <SecondaryButton type="button" onClick={() => setQuestions([newQuestion()])}>
                <Plus size={14} /> Blank question
              </SecondaryButton>
            </div>
          </EmptyQuestions>
        ) : (
          <>
            {questions.map((q, idx) => (
              <QuestionCard key={q._tmp}>
                <QuestionTop>
                  <QNum>{idx + 1}.</QNum>
                  <TextInput
                    style={{ flex: 1, minWidth: 200 }}
                    value={q.label}
                    placeholder="Question"
                    aria-label={`Question ${idx + 1}`}
                    onChange={e => updateQuestion(idx, { label: e.target.value })}
                  />
                  <Dropdown
                    value={q.type}
                    aria-label="Question type"
                    onChange={e => updateQuestion(idx, { type: e.target.value })}
                  >
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Dropdown>
                  <IconBtn type="button" title="Move up" disabled={idx === 0} onClick={() => moveQuestion(idx, -1)}>
                    <ArrowUp size={15} />
                  </IconBtn>
                  <IconBtn type="button" title="Move down" disabled={idx === questions.length - 1} onClick={() => moveQuestion(idx, 1)}>
                    <ArrowDown size={15} />
                  </IconBtn>
                  <IconBtn type="button" title="Remove" $danger onClick={() => removeQuestion(idx)}>
                    <Trash2 size={15} />
                  </IconBtn>
                </QuestionTop>
                <QuestionBody>
                  <Field>
                    Help text
                    <TextInput value={q.help_text} onChange={e => updateQuestion(idx, { help_text: e.target.value })} />
                  </Field>
                  {['text', 'textarea', 'number', 'email'].includes(q.type) && (
                    <Field>
                      Placeholder
                      <TextInput value={q.placeholder} onChange={e => updateQuestion(idx, { placeholder: e.target.value })} />
                    </Field>
                  )}
                  {q.type === 'checkbox' && (
                    <Field>
                      Checkbox text
                      <TextInput value={q.placeholder} placeholder="Yes" onChange={e => updateQuestion(idx, { placeholder: e.target.value })} />
                    </Field>
                  )}
                  {HAS_CHOICES.includes(q.type) && (
                    <Field>
                      Options <Hint>One per line</Hint>
                      <TextBox
                        $rows={4}
                        value={q.choices.join('\n')}
                        onChange={e => updateQuestion(idx, { choices: e.target.value.split('\n') })}
                      />
                    </Field>
                  )}
                  <Check style={{ gridColumn: '1 / -1' }}>
                    <input type="checkbox" checked={q.required} onChange={e => updateQuestion(idx, { required: e.target.checked })} />
                    Required
                  </Check>
                </QuestionBody>
              </QuestionCard>
            ))}
            <SecondaryButton type="button" onClick={() => setQuestions(qs => [...qs, newQuestion()])}>
              <Plus size={14} /> Add question
            </SecondaryButton>
          </>
        )}
      </Section>

      {form.event_group_id && (
        <Section>
          <SectionTitle>Invite email</SectionTitle>
          <Grid>
            <Field $wide>
              Subject <Hint>Leave blank for the default</Hint>
              <TextInput value={form.email_subject} placeholder={defaults.subject} onChange={e => set('email_subject', e.target.value)} />
            </Field>
            <Field $wide>
              Message <Hint>{'Placeholders: {first_name}, {event}, {group}, {link}'}</Hint>
              <TextBox $rows={12} value={form.email_body} placeholder={defaults.body} onChange={e => set('email_body', e.target.value)} />
            </Field>
          </Grid>
        </Section>
      )}

      <SaveBar>
        {!isNew && (
          <SecondaryButton as="a" href={`/forms/${form.slug}`} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Preview
          </SecondaryButton>
        )}
        <PrimaryButton type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save form'}
        </PrimaryButton>
      </SaveBar>
    </Page>
  );
}
