import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { Star } from 'lucide-react';
import { Button, Input, TextArea, Select } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import { formService } from '../services/forms';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 640px;
  margin: 2rem auto 4rem;
  padding: 0 1rem;
`;

const Sheet = styled.div`
  background: #fff;
  border: 1px solid var(--bs-rule);
  border-radius: 10px;
  padding: 2rem 1.75rem;

  @media (max-width: 600px) {
    padding: 1.5rem 1.1rem;
  }
`;

const Title = styled.h1`
  font-family: var(--bs-display);
  font-size: 1.75rem;
  line-height: 1.2;
  color: var(--bs-text);
  margin: 0 0 0.5rem;
`;

const Greeting = styled.p`
  font-weight: 600;
  color: var(--bs-accent);
  margin: 0 0 0.75rem;
`;

const Description = styled.p`
  color: var(--bs-text-dim);
  white-space: pre-line;
  margin: 0 0 1.5rem;
`;

const Notice = styled.div`
  background: var(--bs-accent-tint);
  border: 1px solid var(--bs-accent-soft);
  color: var(--bs-accent-dim);
  border-radius: 6px;
  padding: 0.65rem 0.9rem;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
`;

const Question = styled.div`
  padding: 1.25rem 0;
  border-top: 1px solid var(--bs-rule-soft);
  &:first-of-type { border-top: none; padding-top: 0; }
`;

const QLabel = styled.div`
  font-weight: 600;
  color: var(--bs-text);
  margin-bottom: 0.35rem;
  font-size: 1rem;
`;

const Required = styled.span`
  color: var(--bs-danger);
  margin-left: 0.2rem;
`;

const Help = styled.div`
  font-size: 0.85rem;
  color: var(--bs-text-mute);
  margin-bottom: 0.6rem;
`;

const FieldError = styled.div`
  color: var(--bs-danger);
  font-size: 0.85rem;
  margin-top: 0.4rem;
`;

// ─── Rating / scale controls ─────────────────────────────────────────────────

const StarRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const StarBtn = styled.button`
  background: none;
  border: none;
  padding: 0.2rem;
  cursor: pointer;
  color: ${p => (p.$on ? '#d6a21e' : '#c9cfc8')};
  line-height: 0;
  &:focus-visible { outline: 2px solid var(--bs-accent); border-radius: 4px; }
`;

const StarCaption = styled.span`
  margin-left: 0.5rem;
  font-size: 0.85rem;
  color: var(--bs-text-dim);
`;

const ScaleRow = styled.div`
  display: grid;
  grid-template-columns: repeat(11, 1fr);
  gap: 0.3rem;
`;

const Pill = styled.button`
  min-height: 40px;
  border-radius: 6px;
  border: 1px solid ${p => (p.$on ? 'var(--bs-accent)' : 'var(--bs-rule)')};
  background: ${p => (p.$on ? 'var(--bs-accent)' : 'var(--bs-panel)')};
  color: ${p => (p.$on ? 'var(--bs-on-accent)' : 'var(--bs-text)')};
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.4rem 0.8rem;
  &:hover { border-color: var(--bs-accent); }
`;

const ScaleEnds = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.78rem;
  color: var(--bs-text-mute);
  margin-top: 0.3rem;
`;

const ChoiceRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const CheckLine = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.3rem 0;
  cursor: pointer;
  color: var(--bs-text);
  input { margin-top: 0.3rem; accent-color: var(--bs-accent); }
`;

const Actions = styled.div`
  margin-top: 1.5rem;
`;

const ThankYou = styled.div`
  text-align: center;
  padding: 1rem 0;
  p { color: var(--bs-text-dim); }
`;

const RATING_CAPTIONS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

function RatingInput({ name, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <StarRow onMouseLeave={() => setHover(0)} role="radiogroup" aria-label={name}>
      {[1, 2, 3, 4, 5].map(n => (
        <StarBtn
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          $on={n <= shown}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? null : n)}
        >
          <Star size={30} fill={n <= shown ? 'currentColor' : 'none'} strokeWidth={1.6} />
        </StarBtn>
      ))}
      {shown > 0 && <StarCaption>{RATING_CAPTIONS[shown]}</StarCaption>}
    </StarRow>
  );
}

function ScaleInput({ name, value, onChange }) {
  return (
    <>
      <ScaleRow role="radiogroup" aria-label={name}>
        {Array.from({ length: 11 }, (_, n) => (
          <Pill
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            $on={value === n}
            style={{ padding: 0 }}
            onClick={() => onChange(value === n ? null : n)}
          >
            {n}
          </Pill>
        ))}
      </ScaleRow>
      <ScaleEnds><span>Not at all likely</span><span>Extremely likely</span></ScaleEnds>
    </>
  );
}

function FieldInput({ field, value, onChange, hasError }) {
  const common = { id: `f-${field.key}`, placeholder: field.placeholder || undefined, hasError };
  switch (field.type) {
    case 'rating':
      return <RatingInput name={field.label} value={value} onChange={onChange} />;
    case 'scale':
      return <ScaleInput name={field.label} value={value} onChange={onChange} />;
    case 'textarea':
      return <TextArea {...common} value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'select':
      if ((field.choices || []).length <= 6) {
        return (
          <ChoiceRow role="radiogroup" aria-label={field.label}>
            {field.choices.map(c => (
              <Pill
                key={c}
                type="button"
                role="radio"
                aria-checked={value === c}
                $on={value === c}
                onClick={() => onChange(value === c ? null : c)}
              >
                {c}
              </Pill>
            ))}
          </ChoiceRow>
        );
      }
      return (
        <Select {...common} value={value || ''} onChange={e => onChange(e.target.value || null)}>
          <option value="">Choose…</option>
          {field.choices.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>
      );
    case 'multiselect': {
      const selected = Array.isArray(value) ? value : [];
      return (
        <div>
          {(field.choices || []).map(c => (
            <CheckLine key={c}>
              <input
                type="checkbox"
                checked={selected.includes(c)}
                onChange={e => onChange(e.target.checked ? [...selected, c] : selected.filter(x => x !== c))}
              />
              {c}
            </CheckLine>
          ))}
        </div>
      );
    }
    case 'checkbox':
      return (
        <CheckLine>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {field.placeholder || 'Yes'}
        </CheckLine>
      );
    case 'number':
      return <Input {...common} type="number" value={value ?? ''} onChange={e => onChange(e.target.value)} />;
    case 'email':
      return <Input {...common} type="email" value={value || ''} onChange={e => onChange(e.target.value)} />;
    case 'date':
      return <Input {...common} type="date" value={value || ''} onChange={e => onChange(e.target.value)} />;
    default:
      return <Input {...common} type="text" value={value || ''} onChange={e => onChange(e.target.value)} />;
  }
}

const isBlank = (v) => v === null || v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0);

// A choice matches the respondent's event if it is the title or its suffix,
// e.g. "Bidadari Park" for "October Big Day 2026: Bidadari Park".
const matchesEvent = (choice, event) => event === choice || event.endsWith(`: ${choice}`);

function initialValues(form) {
  const values = {};
  for (const f of form.fields) {
    if (f.default_value) values[f.key] = f.default_value;
    // Personal links know the respondent's site, so preselect it in a site dropdown.
    const event = form.respondent?.event;
    const match = event && f.type === 'select' && (f.choices || []).find(c => matchesEvent(c, event));
    if (match) values[f.key] = match;
  }
  return { ...values, ...(form.existing_response?.data || {}) };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function FeedbackForm() {
  const { slug, token } = useParams();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setForm(null);
    setLoadError(null);
    formService.getForm(slug, token)
      .then(data => {
        if (cancelled) return;
        setForm(data);
        setValues(initialValues(data));
      })
      .catch(err => {
        if (cancelled) return;
        setLoadError(err.response?.status === 404
          ? (token ? "This feedback link isn't valid. Please check the link in your email." : "We couldn't find this form.")
          : 'Something went wrong loading this form. Please try again.');
      });
    return () => { cancelled = true; };
  }, [slug, token]);

  const visibleFields = useMemo(() => (form?.fields || []).filter(f => f.display !== false), [form]);

  const setValue = (key, v) => {
    setValues(prev => ({ ...prev, [key]: v }));
    setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const missing = {};
    for (const f of visibleFields) {
      if (f.required && isBlank(values[f.key])) missing[f.key] = 'Please answer this question.';
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      document.getElementById(`q-${Object.keys(missing)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(values)) {
        if (!isBlank(v) || v === false) payload[k] = v;
      }
      const res = await formService.submit(slug, token, payload);
      if (token) setForm(prev => ({ ...prev, existing_response: { data: payload } }));
      setDone(res.message || form.success_message || 'Thanks for your response!');
      window.scrollTo(0, 0);
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) {
        setErrors(data.errors);
      } else {
        setErrors({ _form: data?.detail || 'Could not submit. Please try again.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return <Page><Sheet><Title>Feedback</Title><Description>{loadError}</Description></Sheet></Page>;
  }
  if (!form) return <Page><Loading text="Loading form…" /></Page>;

  const closed = !form.accept_submissions;
  const needsToken = !token && !form.allow_anonymous;

  if (done) {
    return (
      <Page>
        <Sheet>
          <ThankYou>
            <Title>Thank you</Title>
            <p>{done}</p>
            {token && (
              <Button type="button" variant="secondary" size="small" onClick={() => setDone(null)}>
                Edit my answers
              </Button>
            )}
          </ThankYou>
        </Sheet>
      </Page>
    );
  }

  return (
    <Page>
      <Sheet>
        <Title>{form.name}</Title>
        {form.respondent && (
          <Greeting>
            Hi {form.respondent.first_name}, thanks for joining us at {form.respondent.event}.
          </Greeting>
        )}
        {form.description && <Description>{form.description}</Description>}

        {closed ? (
          <Notice>This form is no longer accepting responses. Thank you for your interest.</Notice>
        ) : needsToken ? (
          <Notice>Please use the personal link from your email to respond to this form.</Notice>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            {form.existing_response && (
              <Notice>
                We already have your response. You can change any answers below and submit again.
              </Notice>
            )}
            {visibleFields.map(f => (
              <Question key={f.key} id={`q-${f.key}`} role="group" aria-labelledby={`l-${f.key}`}>
                <QLabel id={`l-${f.key}`}>
                  {f.label}
                  {f.required && <Required aria-hidden="true">*</Required>}
                </QLabel>
                {f.help_text && <Help>{f.help_text}</Help>}
                <FieldInput
                  field={f}
                  value={values[f.key]}
                  onChange={v => setValue(f.key, v)}
                  hasError={!!errors[f.key]}
                />
                {errors[f.key] && <FieldError role="alert">{errors[f.key]}</FieldError>}
              </Question>
            ))}
            {errors._form && <FieldError role="alert">{errors._form}</FieldError>}
            <Actions>
              <Button type="submit" fullWidth disabled={submitting}>
                {submitting ? 'Submitting…' : form.existing_response ? 'Update my response' : 'Submit'}
              </Button>
            </Actions>
          </form>
        )}
      </Sheet>
    </Page>
  );
}
