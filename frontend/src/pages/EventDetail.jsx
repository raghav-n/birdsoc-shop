import React, { useState, useEffect, useCallback, useRef } from 'react';
import DOMPurify from 'dompurify';
import styled from 'styled-components';
import { useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Users } from 'lucide-react';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import PayNowQR from '../components/PayNowQR';
import { eventService } from '../services/misc';
import { showToast } from '../utils/toast.jsx';
import { useAuth } from '../context/AuthContext';

// ─── Layout ────────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const Card = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 1.5rem 1.75rem;
  margin-bottom: 1rem;
  overflow: hidden;
`;

const EventHeroImage = styled.img`
  display: block;
  width: calc(100% + 3.5rem);
  margin: -1.5rem -1.75rem 1.25rem;
  aspect-ratio: 3 / 2;
  object-fit: cover;
`;

// ─── Event info ────────────────────────────────────────────────────────────────

const EventTitle = styled.h1`
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
`;

const MetaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1.25rem;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const SpotsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  background: ${p => p.$full ? '#fee2e2' : p.$low ? '#fef9c3' : '#f0fdf4'};
  color: ${p => p.$full ? '#b91c1c' : p.$low ? '#854d0e' : '#15803d'};
  border: 1px solid ${p => p.$full ? '#fca5a5' : p.$low ? '#fde68a' : '#86efac'};
`;

const Description = styled.div`
  line-height: 1.7;
  color: var(--text-primary);
  font-size: 0.95rem;

  & > * + * { margin-top: 0.6em; }
  p { margin: 0; }
  h2 { font-size: 1.15em; font-weight: 700; }
  h3 { font-size: 1em; font-weight: 600; }
  ul, ol { padding-left: 1.4em; }
  li + li { margin-top: 0.15em; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 0.75em 0; }
`;

const PriceTag = styled.div`
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 0.75rem;
`;

// ─── Step indicator ────────────────────────────────────────────────────────────

const Steps = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const StepItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: ${p => p.$active ? 600 : 400};
  color: ${p => p.$active ? 'var(--text-primary)' : p.$done ? '#16a34a' : 'var(--text-secondary)'};
`;

const StepNum = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
  background: ${p => p.$active ? 'var(--link-text)' : p.$done ? '#16a34a' : '#e5e7eb'};
  color: ${p => p.$active || p.$done ? '#fff' : '#9ca3af'};
`;

const StepLine = styled.div`
  flex: 1;
  height: 1px;
  background: #e5e7eb;
  margin: 0 0.6rem;
`;

// ─── Form fields ───────────────────────────────────────────────────────────────

const Section = styled.div`
  margin-bottom: 1.25rem;
  &:last-child { margin-bottom: 0; }
`;

const SectionLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid #f3f4f6;
  margin: 1.25rem 0;
`;

const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: ${p => p.$cols || '1fr'};
  gap: 0.75rem 1rem;
  @media (max-width: 480px) { grid-template-columns: 1fr; }
`;

const Field = styled.div``;

const FLabel = styled.label`
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.3rem;
`;

const FInput = styled.input`
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${p => p.$err ? '#f87171' : '#d1d5db'};
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background: #fff;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const FSelect = styled.select`
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid ${p => p.$err ? '#f87171' : '#d1d5db'};
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  background: #fff;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const FHint = styled.div`
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
`;

const FError = styled.div.attrs(() => ({ 'data-field-error': '' }))`
  font-size: 0.75rem;
  color: #dc2626;
  margin-top: 0.25rem;
`;

const CheckRow = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  font-size: 0.875rem;
  cursor: pointer;
  line-height: 1.5;
  color: var(--text-primary);
  input { margin-top: 3px; flex-shrink: 0; }
`;

// ─── Price preview ─────────────────────────────────────────────────────────────

const PriceBox = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.875rem 1.1rem;
`;

const PriceLine = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.875rem;
  color: ${p => p.$total ? 'var(--text-primary)' : 'var(--text-secondary)'};
  font-weight: ${p => p.$total ? 600 : 400};
  padding-top: ${p => p.$total ? '0.5rem' : '0.1rem'};
  border-top: ${p => p.$total ? '1px solid #e2e8f0' : 'none'};
  margin-top: ${p => p.$total ? '0.4rem' : '0'};
`;

const CapWarning = styled.div`
  font-size: 0.78rem;
  margin-top: 0.5rem;
  padding: 0.3rem 0.6rem;
  border-radius: 5px;
  background: ${p => p.$danger ? '#fee2e2' : '#fef9c3'};
  color: ${p => p.$danger ? '#b91c1c' : '#854d0e'};
`;

// ─── Buttons ───────────────────────────────────────────────────────────────────

const BtnRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
`;

const PrimaryBtn = styled.button`
  padding: 0.6rem 1.4rem;
  background: var(--link-text);
  color: #fff;
  border: none;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.88; }
`;

const SecondaryBtn = styled.button`
  padding: 0.6rem 1.1rem;
  background: #fff;
  color: var(--text-primary);
  border: 1px solid #d1d5db;
  border-radius: 7px;
  font-size: 0.9rem;
  cursor: pointer;
  &:hover { background: #f9fafb; }
`;

// ─── Review ────────────────────────────────────────────────────────────────────

const ReviewRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.4rem 0;
  font-size: 0.875rem;
  border-bottom: 1px solid #f3f4f6;
  &:last-child { border-bottom: none; }
`;

const RKey = styled.span`color: var(--text-secondary);`;
const RVal = styled.span`
  font-weight: 500;
  color: var(--text-primary);
  max-width: 60%;
  text-align: right;
  word-break: break-word;
`;

// ─── Success ───────────────────────────────────────────────────────────────────

const SlotWarning = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  background: #fef9c3;
  border: 1px solid #fde68a;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #713f12;
  line-height: 1.5;
`;

const CountdownBadge = styled.span`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

function PaymentCountdown({ registeredAt }) {
  const WINDOW_MS = 15 * 60 * 1000;
  const deadline = new Date(registeredAt).getTime() + WINDOW_MS;

  const [remaining, setRemaining] = useState(() => Math.max(0, deadline - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const expired = remaining === 0;

  return (
    <SlotWarning>
      <span>⏳</span>
      <span>
        {expired ? (
          <>Your slot has been released as payment was not received in time. You're welcome to register again if spots are still available.</>
        ) : (
          <>
            Please complete payment within{' '}
            <CountdownBadge>{mins}:{String(secs).padStart(2, '0')}</CountdownBadge>.
            {' '}If no payment is received within 15 minutes of registration, your slot{' '}
            will be released to allow others to register.
          </>
        )}
      </span>
    </SlotWarning>
  );
}

const RefBadge = styled.div`
  display: inline-block;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  padding: 0.4rem 1rem;
  font-family: monospace;
  font-weight: 600;
  font-size: 1rem;
  letter-spacing: 0.04em;
  color: var(--text-primary);
  margin-top: 0.5rem;
`;

const DropZone = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 2px dashed ${p => p.$drag ? '#6366f1' : p.$uploaded ? '#16a34a' : '#d1d5db'};
  background: ${p => p.$drag ? '#eef2ff' : p.$uploaded ? '#f0fdf4' : '#fafafa'};
  border-radius: 10px;
  padding: 1.5rem 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  font-size: 0.875rem;
  color: ${p => p.$uploaded ? '#16a34a' : 'var(--text-secondary)'};
  text-align: center;
`;

const ConfirmedBanner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: #f0fdf4;
  border: 1px solid #86efac;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: #15803d;
  font-weight: 600;
  margin-top: 1rem;
`;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (s) => {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const fmtAmt = (n) => `S$${parseFloat(n).toFixed(2)}`;

// ─── Extra schema field ────────────────────────────────────────────────────────

function ExtraField({ fieldKey, schema, value, onChange, error }) {
  const label = schema.title || fieldKey;

  if (schema.type === 'boolean') {
    return (
      <Field>
        <CheckRow>
          <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />
          {label}
        </CheckRow>
      </Field>
    );
  }

  if (schema.enum) {
    return (
      <Field>
        <FLabel>{label}</FLabel>
        <FSelect $err={!!error} value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select…</option>
          {schema.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </FSelect>
        {error && <FError>{error}</FError>}
      </Field>
    );
  }

  const isNumeric = schema.type === 'number' || schema.type === 'integer';

  return (
    <Field>
      <FLabel>{label}</FLabel>
      <FInput
        type={isNumeric ? 'number' : 'text'}
        inputMode={isNumeric ? 'numeric' : undefined}
        $err={!!error}
        value={value || ''}
        placeholder={schema.description || ''}
        onChange={e => onChange(e.target.value)}
      />
      {error && <FError>{error}</FError>}
    </Field>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // step: 'form' | 'review' | 'success'
  const [step, setStep] = useState('form');

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone_number: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    quantity: 1, donation: '',
  });
  const [extraFields, setExtraFields] = useState([{}]);
  // extra participants for qty>1: array of {name, sameEmail, email, samePhone, phone}
  const [extraParticipants, setExtraParticipants] = useState([]);
  const [pdpaAgreed, setPdpaAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const [priceData, setPriceData] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const [proofFile, setProofFile] = useState(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofUploaded, setProofUploaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const debounceRef = useRef(null);
  const pollingRef = useRef(null);
  const pollingActiveRef = useRef(false);

  useEffect(() => {
    eventService.getEvent(id)
      .then(data => {
        setEvent(data);
      })
      .catch(() => setFetchError('Failed to load event.'))
      .finally(() => setLoading(false));
  }, [id]);

  const fetchPrice = useCallback(async (qty, donation, extras) => {
    const extraJson = { ...extras };
    setPriceLoading(true);
    try {
      const data = await eventService.priceBreakdown(id, {
        participants: [{
          quantity: Number(qty) || 1,
          extra_json: Object.keys(extraJson).length ? extraJson : undefined,
        }],
        donation: donation ? Math.round(parseFloat(donation) * 100) : 0,
      });
      setPriceData(data);
    } catch { /* non-critical */ }
    finally { setPriceLoading(false); }
  }, [id]);

  useEffect(() => {
    if (!event) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPrice(form.quantity, form.donation, extraFields[0] || {});
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [event, form.quantity, form.donation, extraFields, fetchPrice]);

  useEffect(() => {
    const n = Math.max(1, Number(form.quantity) || 1);
    setExtraFields(prev => {
      if (prev.length === n) return prev;
      const arr = prev.slice(0, n);
      while (arr.length < n) arr.push({});
      return arr;
    });
    // Extra participants for slots 2..n (index 0 = participant 2)
    setExtraParticipants(prev => {
      const needed = n - 1;
      if (prev.length === needed) return prev;
      const arr = prev.slice(0, needed);
      while (arr.length < needed) arr.push({ name: '', sameEmail: true, email: '', samePhone: true, phone: '' });
      return arr;
    });
  }, [form.quantity]);

  // Gmail polling for auto-confirmation once on success screen with pending payment
  useEffect(() => {
    const regId = result?.registration?.id;
    if (step !== 'success' || !regId || !result || result.confirmed !== false || paymentConfirmed) {
      return;
    }

    const poll = async () => {
      if (pollingActiveRef.current) return;
      pollingActiveRef.current = true;
      try {
        const data = await eventService.checkEventPayNowEmail(regId);
        if (data.confirmed) {
          setPaymentConfirmed(true);
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        const code = err.response?.status;
        if (code !== 501 && code !== 502) {
          console.error('Event payment polling error:', err);
        }
      } finally {
        pollingActiveRef.current = false;
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 10000);
    return () => {
      clearInterval(pollingRef.current);
      pollingActiveRef.current = false;
    };
  }, [step, result, paymentConfirmed]);

  const handleProofFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast.error('Please upload an image file');
      return;
    }
    setProofFile(file);
  };

  const handleProofUpload = async () => {
    const regId = result?.registration?.id;
    if (!proofFile || !regId) return;
    setProofUploading(true);
    try {
      const fd = new FormData();
      fd.append('payment_proof', proofFile);
      await eventService.uploadEventProof(regId, fd);
      setProofUploaded(true);
      showToast.success('Payment proof uploaded successfully!');
    } catch {
      showToast.error('Failed to upload proof. Please try again.');
    } finally {
      setProofUploading(false);
    }
  };

  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(p => ({ ...p, [field]: val }));
    setFieldErrors(p => ({ ...p, [field]: null }));
  };

  const isValidPhone = (v) => /^[0-9+\-\s().]{6,20}$/.test(v.trim());

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim()) errs.last_name = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    if (!form.phone_number.trim()) errs.phone_number = 'Required';
    else if (!isValidPhone(form.phone_number)) errs.phone_number = 'Enter a valid phone number (digits only)';
    if (!form.emergency_contact_name.trim()) errs.emergency_contact_name = 'Required';
    if (!form.emergency_contact_phone.trim()) errs.emergency_contact_phone = 'Required';
    else if (!isValidPhone(form.emergency_contact_phone)) errs.emergency_contact_phone = 'Enter a valid phone number (digits only)';

    const qtyNum = Number(form.quantity) || 1;
    // Validate extra participants (qty>1)
    for (let i = 0; i < qtyNum - 1; i++) {
      const ep = extraParticipants[i] || {};
      if (!ep.name?.trim()) errs[`ep_${i}_name`] = 'Required';
      if (!ep.sameEmail && !ep.email?.trim()) errs[`ep_${i}_email`] = 'Required';
      if (!ep.sameEmail && ep.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ep.email)) errs[`ep_${i}_email`] = 'Invalid email';
      if (!ep.samePhone && !ep.phone?.trim()) errs[`ep_${i}_phone`] = 'Required';
      if (!ep.samePhone && ep.phone && !isValidPhone(ep.phone)) errs[`ep_${i}_phone`] = 'Enter a valid phone number';
    }

    const required = event?.json_schema?.required || [];
    for (let i = 0; i < qtyNum; i++) {
      for (const [k, prop] of Object.entries(jsonProps)) {
        const val = extraFields[i]?.[k];
        const empty = prop.type === 'boolean'
          ? val === undefined || val === null
          : val === undefined || val === '' || val === null;
        if (required.includes(k) && empty) {
          errs[`extra_${i}_${k}`] = 'Required';
        } else if (!empty) {
          if (prop.type === 'number' || prop.type === 'integer') {
            if (isNaN(parseFloat(val))) errs[`extra_${i}_${k}`] = 'Must be a number';
          } else if (prop.enum && !prop.enum.includes(val)) {
            errs[`extra_${i}_${k}`] = 'Invalid option';
          }
        }
      }
    }
    if (!pdpaAgreed) errs.pdpa = 'You must agree before continuing';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReview = () => {
    if (validate()) {
      setStep('review');
    } else {
      setTimeout(() => {
        document.querySelector('[data-field-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const qtyNum = Number(form.quantity) || 1;
      const extraJson = extraFields.map((pf, i) => {
        if (i === 0) return { ...pf };
        const ep = extraParticipants[i - 1] || {};
        return {
          _name: ep.name?.trim() || '',
          _email: ep.sameEmail ? undefined : ep.email?.trim() || undefined,
          _phone: ep.samePhone ? undefined : ep.phone?.trim() || undefined,
          ...pf,
        };
      });
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phone_number: form.phone_number.trim(),
        emergency_contact_name: form.emergency_contact_name.trim(),
        emergency_contact_phone: form.emergency_contact_phone.trim(),
        quantity: qtyNum,
        donation: form.donation ? Math.round(parseFloat(form.donation) * 100) : 0,
      };
      if (extraJson.some(o => Object.keys(o).length > 0)) payload.extra_json = extraJson;
      const res = await eventService.registerForEvent(id, payload);
      setResult(res);
      setStep('success');
      showToast.success('Registration confirmed!');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Registration failed. Please try again.';
      showToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Loading text="Loading event…" />;
  if (fetchError) return <Page><Alert variant="error">{fetchError}</Alert></Page>;
  if (!event) return <Page><Alert variant="error">Event not found.</Alert></Page>;

  const unitPrice = parseFloat(event.price_incl_tax || '0');
  const qty = Number(form.quantity) || 1;
  const donationAmt = form.donation ? parseFloat(form.donation) : 0;
  const spotsLeft = event.max_participants != null
    ? event.max_participants - (event.participant_count || 0)
    : null;

  const jsonProps = event.json_schema?.properties || {};

  const priceTotal = priceData
    ? parseFloat(priceData.totals.amount)
    : unitPrice * qty;
  const grandTotal = priceTotal + donationAmt;
  const capacityAvailable = !priceData?.capacity || priceData.capacity.available;

  // Result-derived values for success screen
  const isPaidResult = result?.confirmed === false;
  const payNowRef = result?.registration?.reference;
  const payNowAmount = result?.registration ? parseFloat(result.registration.amount) : priceTotal;
  // Only show 15-min warning when the event itself costs money (not free + optional donation)
  const hasEventFee = result?.registration && parseFloat(result.registration.amount) > 0;

  return (
    <Page>
      <div style={{ marginBottom: '0.75rem' }}>
        <Link to="/events" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Back to events
        </Link>
      </div>

      {/* ── Event info ─────────────────────────────────────────────────────── */}
      <Card>
        {event.image_url && <EventHeroImage src={event.image_url} alt={event.title} />}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <EventTitle>{event.title}</EventTitle>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {event.is_full && <SpotsBadge $full>Full</SpotsBadge>}
            {spotsLeft !== null && !event.is_full && spotsLeft <= 8 && (
              <SpotsBadge $low><Users size={11} />{spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left</SpotsBadge>
            )}
          </div>
        </div>
        <MetaRow>
          {event.start_date && <MetaItem><Calendar size={14} />{fmt(event.start_date)}</MetaItem>}
          {event.end_date && <MetaItem>to {fmt(event.end_date)}</MetaItem>}
          {event.location && <MetaItem><MapPin size={14} />{event.location}</MetaItem>}
          {spotsLeft !== null && !event.is_full && spotsLeft > 8 && (
            <MetaItem><Users size={14} />{spotsLeft} spots remaining</MetaItem>
          )}
        </MetaRow>
        {event.description && (
          <Description dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(event.description) }} />
        )}
        <PriceTag>
          {unitPrice > 0 ? `${fmtAmt(unitPrice)} per person` : 'Free'}
        </PriceTag>
      </Card>

      {/* ── Info-only ──────────────────────────────────────────────────────── */}
      {event.registration_required === false && (
        <Card style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          No registration needed — just show up!
        </Card>
      )}

      {/* ── Registration ───────────────────────────────────────────────────── */}
      {event.registration_required !== false && (() => {
        if (event.global_registration_closed) {
          return <Alert variant="warning">Registrations are temporarily closed.</Alert>;
        }
        if (event.is_active === false) {
          return <Alert variant="info">This event is not currently open for registration.</Alert>;
        }
        if (event.registration_open === false) {
          return <Alert variant="warning">Registration for this event is currently closed.</Alert>;
        }
        if (event.is_full) {
          return <Alert variant="error">This event is full.</Alert>;
        }

        return (
          <>
            {/* Step indicator */}
            {step !== 'success' && (
              <Steps>
                <StepItem $active={step === 'form'} $done={step === 'review'}>
                  <StepNum $active={step === 'form'} $done={step === 'review'}>
                    {step === 'review' ? '✓' : '1'}
                  </StepNum>
                  Your details
                </StepItem>
                <StepLine />
                <StepItem $active={step === 'review'}>
                  <StepNum $active={step === 'review'}>2</StepNum>
                  Review & pay
                </StepItem>
              </Steps>
            )}

            {/* ── Step 1: Form ─────────────────────────────────────────────── */}
            {step === 'form' && (
              <Card>
                <Section>
                  <SectionLabel>Your details</SectionLabel>
                  <FieldGrid $cols="1fr 1fr">
                    <Field>
                      <FLabel>First name *</FLabel>
                      <FInput $err={!!fieldErrors.first_name} value={form.first_name} onChange={set('first_name')} autoComplete="given-name" />
                      {fieldErrors.first_name && <FError>{fieldErrors.first_name}</FError>}
                    </Field>
                    <Field>
                      <FLabel>Last name *</FLabel>
                      <FInput $err={!!fieldErrors.last_name} value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
                      {fieldErrors.last_name && <FError>{fieldErrors.last_name}</FError>}
                    </Field>
                  </FieldGrid>
                  <FieldGrid style={{ marginTop: '0.75rem' }}>
                    <Field>
                      <FLabel>Email *</FLabel>
                      <FInput type="email" $err={!!fieldErrors.email} value={form.email} onChange={set('email')} autoComplete="email" />
                      {fieldErrors.email && <FError>{fieldErrors.email}</FError>}
                    </Field>
                  </FieldGrid>
                  <FieldGrid style={{ marginTop: '0.75rem' }}>
                    <Field>
                      <FLabel>Phone number *</FLabel>
                      <FInput type="tel" $err={!!fieldErrors.phone_number} value={form.phone_number} onChange={set('phone_number')} autoComplete="tel" />
                      {fieldErrors.phone_number && <FError>{fieldErrors.phone_number}</FError>}
                    </Field>
                  </FieldGrid>
                </Section>

                <Divider />

                <Section>
                  <SectionLabel>Emergency contact</SectionLabel>
                  <FieldGrid $cols="1fr 1fr">
                    <Field>
                      <FLabel>Name *</FLabel>
                      <FInput $err={!!fieldErrors.emergency_contact_name} value={form.emergency_contact_name} onChange={set('emergency_contact_name')} />
                      {fieldErrors.emergency_contact_name && <FError>{fieldErrors.emergency_contact_name}</FError>}
                    </Field>
                    <Field>
                      <FLabel>Phone *</FLabel>
                      <FInput type="tel" $err={!!fieldErrors.emergency_contact_phone} value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} />
                      {fieldErrors.emergency_contact_phone && <FError>{fieldErrors.emergency_contact_phone}</FError>}
                    </Field>
                  </FieldGrid>
                </Section>

                <Divider />

                <Section>
                  <SectionLabel>Registration details</SectionLabel>
                  <FieldGrid $cols="1fr 2fr">
                    <Field>
                      <FLabel>Number of participants</FLabel>
                      <FInput type="number" min="1" max={event.max_qty ?? 5} value={form.quantity} onChange={set('quantity')} />
                      <FHint>Max {event.max_qty ?? 5} per registration</FHint>
                    </Field>
                  </FieldGrid>
                </Section>

                {(qty > 1 || Object.keys(jsonProps).length > 0) && (
                  <>
                    <Divider />
                    <Section>
                      <SectionLabel>Additional information</SectionLabel>
                      {Array.from({ length: qty }, (_, i) => {
                        const isExtra = i > 0;
                        const epIdx = i - 1;
                        const ep = isExtra ? (extraParticipants[epIdx] || {}) : null;
                        const setEp = isExtra ? (patch) => setExtraParticipants(prev => {
                          const arr = [...prev];
                          arr[epIdx] = { ...arr[epIdx], ...patch };
                          return arr;
                        }) : null;
                        const hasSchema = Object.keys(jsonProps).length > 0;
                        return (
                          <div key={i} style={{ marginBottom: i < qty - 1 ? '1.25rem' : 0 }}>
                            {qty > 1 && (
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                Participant {i + 1}
                              </div>
                            )}
                            {i === 0 && qty > 1 && (
                              <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.82rem',
                                color: '#374151',
                                marginBottom: hasSchema ? '0.75rem' : 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.2rem',
                              }}>
                                <span>{form.first_name} {form.last_name}</span>
                                <span style={{ color: '#6b7280' }}>{form.email}</span>
                                {form.phone_number && <span style={{ color: '#6b7280' }}>{form.phone_number}</span>}
                              </div>
                            )}
                            {isExtra && (
                              <>
                                <FieldGrid>
                                  <Field>
                                    <FLabel>Full name *</FLabel>
                                    <FInput
                                      $err={!!fieldErrors[`ep_${epIdx}_name`]}
                                      value={ep.name || ''}
                                      onChange={e => { setEp({ name: e.target.value }); setFieldErrors(p => ({ ...p, [`ep_${epIdx}_name`]: null })); }}
                                    />
                                    {fieldErrors[`ep_${epIdx}_name`] && <FError>{fieldErrors[`ep_${epIdx}_name`]}</FError>}
                                  </Field>
                                </FieldGrid>
                                <div style={{ marginTop: '0.5rem' }}>
                                  <CheckRow>
                                    <input type="checkbox" checked={ep.sameEmail !== false} onChange={e => setEp({ sameEmail: e.target.checked })} />
                                    Use same email as main contact
                                  </CheckRow>
                                  {ep.sameEmail === false && (
                                    <Field style={{ marginTop: '0.5rem' }}>
                                      <FLabel>Email *</FLabel>
                                      <FInput
                                        type="email"
                                        $err={!!fieldErrors[`ep_${epIdx}_email`]}
                                        value={ep.email || ''}
                                        onChange={e => { setEp({ email: e.target.value }); setFieldErrors(p => ({ ...p, [`ep_${epIdx}_email`]: null })); }}
                                      />
                                      {fieldErrors[`ep_${epIdx}_email`] && <FError>{fieldErrors[`ep_${epIdx}_email`]}</FError>}
                                    </Field>
                                  )}
                                </div>
                                <div style={{ marginTop: '0.4rem', marginBottom: hasSchema ? '0.75rem' : 0 }}>
                                  <CheckRow>
                                    <input type="checkbox" checked={ep.samePhone !== false} onChange={e => setEp({ samePhone: e.target.checked })} />
                                    Use same phone number as main contact
                                  </CheckRow>
                                  {ep.samePhone === false && (
                                    <Field style={{ marginTop: '0.5rem' }}>
                                      <FLabel>Phone *</FLabel>
                                      <FInput
                                        type="tel"
                                        $err={!!fieldErrors[`ep_${epIdx}_phone`]}
                                        value={ep.phone || ''}
                                        onChange={e => { setEp({ phone: e.target.value }); setFieldErrors(p => ({ ...p, [`ep_${epIdx}_phone`]: null })); }}
                                      />
                                      {fieldErrors[`ep_${epIdx}_phone`] && <FError>{fieldErrors[`ep_${epIdx}_phone`]}</FError>}
                                    </Field>
                                  )}
                                </div>
                              </>
                            )}
                            {hasSchema && (
                              <FieldGrid>
                                {Object.entries(jsonProps).map(([key, schema]) => (
                                  <ExtraField
                                    key={key}
                                    fieldKey={key}
                                    schema={schema}
                                    value={extraFields[i]?.[key]}
                                    error={fieldErrors[`extra_${i}_${key}`]}
                                    onChange={val => {
                                      setExtraFields(prev => {
                                        const arr = [...prev];
                                        arr[i] = { ...arr[i], [key]: val };
                                        return arr;
                                      });
                                      setFieldErrors(p => ({ ...p, [`extra_${i}_${key}`]: null }));
                                    }}
                                  />
                                ))}
                              </FieldGrid>
                            )}
                          </div>
                        );
                      })}
                    </Section>
                  </>
                )}

                <Divider />

                <Section>
                  <SectionLabel>Optional donation</SectionLabel>
                  <FieldGrid $cols="1fr 2fr">
                    <Field>
                      <FLabel>Amount (S$)</FLabel>
                      <FInput
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        value={form.donation}
                        onChange={set('donation')}
                      />
                    </Field>
                  </FieldGrid>
                </Section>

                {/* Price preview */}
                <PriceBox>
                  {priceLoading ? (
                    <PriceLine><span style={{ color: 'var(--text-secondary)' }}>Computing…</span></PriceLine>
                  ) : priceData ? (
                    <>
                      {priceData.items.map((item, i) => (
                        <PriceLine key={i}>
                          <span>
                            {item.tier?.name || 'Event fee'}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                          </span>
                          <span>{parseFloat(item.line_total) === 0 ? 'Free' : fmtAmt(item.line_total)}</span>
                        </PriceLine>
                      ))}
                      {donationAmt > 0 && (
                        <PriceLine>
                          <span>Donation</span>
                          <span>{fmtAmt(donationAmt)}</span>
                        </PriceLine>
                      )}
                      <PriceLine $total>
                        <span>Total</span>
                        <span>{grandTotal === 0 ? 'Free' : fmtAmt(grandTotal)}</span>
                      </PriceLine>
                      {priceData.capacity && !priceData.capacity.available && (
                        <CapWarning $danger>Not enough spots available for this quantity.</CapWarning>
                      )}
                      {priceData.capacity?.available && priceData.capacity.remaining <= 8 && (
                        <CapWarning>
                          Only {priceData.capacity.remaining} spot{priceData.capacity.remaining !== 1 ? 's' : ''} left — register soon.
                        </CapWarning>
                      )}
                    </>
                  ) : (
                    <PriceLine>
                      <span>Event fee{qty > 1 ? ` × ${qty}` : ''}</span>
                      <span>{priceTotal === 0 ? 'Free' : fmtAmt(priceTotal)}</span>
                    </PriceLine>
                  )}
                </PriceBox>

                <Divider />

                <Section>
                  <CheckRow>
                    <input type="checkbox" checked={pdpaAgreed} onChange={e => {
                      setPdpaAgreed(e.target.checked);
                      setFieldErrors(p => ({ ...p, pdpa: null }));
                    }} />
                    <span>
                      I consent to the collection and use of my personal data for the purposes of this event registration, in accordance with the Personal Data Protection Act (PDPA).
                    </span>
                  </CheckRow>
                  {fieldErrors.pdpa && <FError style={{ marginTop: '0.4rem' }}>{fieldErrors.pdpa}</FError>}
                </Section>

                <BtnRow>
                  <PrimaryBtn onClick={handleReview} disabled={!capacityAvailable}>
                    Review →
                  </PrimaryBtn>
                </BtnRow>
              </Card>
            )}

            {/* ── Step 2: Review ────────────────────────────────────────────── */}
            {step === 'review' && (
              <>
                <Card>
                  <SectionLabel>Your details</SectionLabel>
                  <ReviewRow>
                    <RKey>Name</RKey>
                    <RVal>{form.first_name} {form.last_name}</RVal>
                  </ReviewRow>
                  <ReviewRow><RKey>Email</RKey><RVal>{form.email}</RVal></ReviewRow>
                  <ReviewRow><RKey>Phone</RKey><RVal>{form.phone_number}</RVal></ReviewRow>
                  {form.emergency_contact_name && (
                    <ReviewRow>
                      <RKey>Emergency contact</RKey>
                      <RVal>
                        {form.emergency_contact_name}
                        {form.emergency_contact_phone ? ` · ${form.emergency_contact_phone}` : ''}
                      </RVal>
                    </ReviewRow>
                  )}
                  {qty > 1 && <ReviewRow><RKey>Quantity</RKey><RVal>{qty}</RVal></ReviewRow>}
                  {extraFields.flatMap((pf, i) =>
                    Object.entries(pf)
                      .filter(([, v]) => v !== undefined && v !== '' && v !== false)
                      .map(([k, v]) => (
                        <ReviewRow key={`${i}_${k}`}>
                          <RKey>{qty > 1 ? `P${i + 1}: ` : ''}{jsonProps[k]?.title || k}</RKey>
                          <RVal>{v === true ? 'Yes' : v === false ? 'No' : String(v)}</RVal>
                        </ReviewRow>
                      ))
                  )}
                </Card>

                <Card>
                  <SectionLabel>Price summary</SectionLabel>
                  {priceData ? (
                    <>
                      {priceData.items.map((item, i) => (
                        <ReviewRow key={i}>
                          <RKey>
                            {item.tier?.name || 'Event fee'}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                          </RKey>
                          <RVal>{parseFloat(item.line_total) === 0 ? 'Free' : fmtAmt(item.line_total)}</RVal>
                        </ReviewRow>
                      ))}
                      {donationAmt > 0 && (
                        <ReviewRow><RKey>Donation</RKey><RVal>{fmtAmt(donationAmt)}</RVal></ReviewRow>
                      )}
                    </>
                  ) : (
                    <ReviewRow>
                      <RKey>Event fee{qty > 1 ? ` × ${qty}` : ''}</RKey>
                      <RVal>{priceTotal === 0 ? 'Free' : fmtAmt(priceTotal)}</RVal>
                    </ReviewRow>
                  )}
                  <ReviewRow>
                    <RKey style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total</RKey>
                    <RVal style={{ fontSize: '1.05rem' }}>{grandTotal === 0 ? 'Free' : fmtAmt(grandTotal)}</RVal>
                  </ReviewRow>
                  {grandTotal > 0 && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      After confirming, you'll be shown a PayNow QR code to complete payment.
                    </div>
                  )}
                </Card>

                <BtnRow>
                  <PrimaryBtn onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Confirming…' : 'Confirm registration'}
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => setStep('form')}>← Back</SecondaryBtn>
                </BtnRow>
              </>
            )}

            {/* ── Success ───────────────────────────────────────────────────── */}
            {step === 'success' && result && (
              <>
                <Card style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
                    {isPaidResult ? '🎉' : '✅'}
                  </div>
                  <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                    {isPaidResult ? 'Registration received!' : "You're registered!"}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
                    {isPaidResult
                      ? 'Scan the PayNow QR code below to secure your spot.'
                      : 'A confirmation email has been sent to your email address.'}
                  </p>
                  {event.post_registration_message && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      color: 'var(--text-primary)',
                      textAlign: 'left',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {event.post_registration_message}
                    </div>
                  )}
                  {payNowRef && <RefBadge>{payNowRef}</RefBadge>}
                  {hasEventFee && result.registered_at && (
                    <PaymentCountdown registeredAt={result.registered_at} />
                  )}
                </Card>

                {isPaidResult && payNowRef && (
                  <Card>
                    <SectionLabel style={{ marginBottom: '1rem' }}>Complete payment via PayNow</SectionLabel>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <PayNowQR
                        amount={payNowAmount}
                        referenceId={payNowRef}
                        donation={donationAmt}
                      />
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      <p style={{ margin: '0 0 0.4rem' }}>
                        Use <strong>exactly the reference number above</strong> in the PayNow remarks field.
                      </p>
                      <p style={{ margin: 0 }}>
                        Your spot will be confirmed once payment is verified. A confirmation email will be sent to <strong>{form.email}</strong>.
                      </p>
                    </div>

                    {paymentConfirmed ? (
                      <ConfirmedBanner>
                        ✅ Payment received! Your registration is confirmed. Check your email for details.
                      </ConfirmedBanner>
                    ) : (
                      <>
                        <div style={{ marginTop: '1.25rem' }}>
                          <SectionLabel style={{ marginBottom: '0.75rem' }}>Upload payment proof</SectionLabel>
                          <DropZone
                            $drag={dragOver}
                            $uploaded={proofUploaded}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={e => { e.preventDefault(); setDragOver(false); handleProofFile(e.dataTransfer.files[0]); }}
                          >
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={e => handleProofFile(e.target.files[0])}
                            />
                            {proofUploaded
                              ? '✅ Proof uploaded — thank you!'
                              : proofFile
                              ? `📎 ${proofFile.name}`
                              : 'Click to upload or drag and drop payment screenshot'}
                          </DropZone>
                          {!proofUploaded && (
                            <button
                              onClick={handleProofUpload}
                              disabled={!proofFile || proofUploading}
                              style={{
                                marginTop: '0.6rem', width: '100%', padding: '0.6rem',
                                background: '#4f46e5', color: '#fff', border: 'none',
                                borderRadius: '7px', fontWeight: 600,
                                cursor: (!proofFile || proofUploading) ? 'not-allowed' : 'pointer',
                                opacity: (!proofFile || proofUploading) ? 0.5 : 1,
                              }}
                            >
                              {proofUploading ? 'Uploading…' : 'Submit payment proof'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </Card>
                )}

                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  <Link to="/events" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    ← Back to events
                  </Link>
                </div>
              </>
            )}
          </>
        );
      })()}
    </Page>
  );
}
