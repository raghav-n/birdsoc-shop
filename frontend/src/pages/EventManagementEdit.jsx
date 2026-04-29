import React, { useEffect, useRef, useState } from 'react';
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

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.875rem;
  background: #fff;
  outline: none;
  cursor: pointer;
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

// ─── Shared builder styles ────────────────────────────────────────────────────

const EmptyBuilder = styled.div`
  text-align: center;
  padding: 1.5rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  border: 1px dashed #e5e7eb;
  border-radius: 6px;
  margin-bottom: 0.5rem;
`;

const AddButton = styled.button`
  background: none;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  width: 100%;
  padding: 0.5rem;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  &:hover { border-color: var(--link-text); color: var(--link-text); background: #f0f9ff; }
`;

const IconButton = styled.button`
  background: none;
  border: none;
  padding: 0.25rem 0.4rem;
  cursor: pointer;
  color: var(--text-secondary);
  border-radius: 4px;
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
  &:hover { background: #fee2e2; color: #ef4444; }
`;

const SmallInput = styled(Input)`
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
`;

const SmallSelect = styled(Select)`
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
`;

// ─── Image picker styles ──────────────────────────────────────────────────────

const ImagePickerWrap = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
`;

const ImagePreviewBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: #fafafa;
  border-bottom: ${p => p.$open ? '1px solid #e5e7eb' : 'none'};
`;

const CurrentThumb = styled.img`
  width: 80px;
  height: 54px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const NoImagePlaceholder = styled.div`
  width: 80px;
  height: 54px;
  border-radius: 5px;
  border: 1px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 1.1rem;
  flex-shrink: 0;
  background: #f9fafb;
`;

const ImagePickerBody = styled.div`
  padding: 1rem;
`;

const ImageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.6rem;
  max-height: 260px;
  overflow-y: auto;
  margin-bottom: 0.75rem;
`;

const ImageGridItem = styled.div`
  position: relative;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid ${p => p.$selected ? 'var(--link-text)' : 'transparent'};
  &:hover { border-color: #93c5fd; }
`;

const ImageGridThumb = styled.img`
  width: 100%;
  height: 70px;
  object-fit: cover;
  display: block;
`;

const ImageGridSelected = styled.div`
  position: absolute;
  inset: 0;
  background: rgba(59,130,246,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
`;

const UploadDropZone = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 2px dashed ${p => p.$drag ? '#6366f1' : '#d1d5db'};
  background: ${p => p.$drag ? '#eef2ff' : '#fafafa'};
  border-radius: 7px;
  padding: 1rem;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text-secondary);
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
`;

// ─── Schema field builder ─────────────────────────────────────────────────────

const SchemaFieldCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.75rem 0.875rem;
  margin-bottom: 0.5rem;
  background: #fafafa;
`;

const SchemaFieldTop = styled.div`
  display: grid;
  grid-template-columns: 1fr 130px auto auto;
  gap: 0.5rem;
  align-items: center;
`;

const SchemaFieldSub = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const FIELD_TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'number',   label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox (yes/no)' },
];

function SchemaFieldBuilder({ fields, onChange }) {
  const add = () => onChange([...fields, { id: uid(), label: '', type: 'text', options: '', required: false, hint: '' }]);
  const remove = (id) => onChange(fields.filter(f => f.id !== id));
  const update = (id, patch) => onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f));

  return (
    <div>
      {fields.length === 0 && (
        <EmptyBuilder>No fields yet — click below to add one.</EmptyBuilder>
      )}
      {fields.map(f => (
        <SchemaFieldCard key={f.id}>
          <SchemaFieldTop>
            <SmallInput
              placeholder="Field label (e.g. T-shirt size)"
              value={f.label}
              onChange={e => update(f.id, { label: e.target.value })}
            />
            <SmallSelect value={f.type} onChange={e => update(f.id, { type: e.target.value })}>
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </SmallSelect>
            <CheckboxRow style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={f.required}
                onChange={e => update(f.id, { required: e.target.checked })}
              />
              Required
            </CheckboxRow>
            <IconButton type="button" onClick={() => remove(f.id)} title="Remove field">✕</IconButton>
          </SchemaFieldTop>
          <SchemaFieldSub>
            {f.type === 'dropdown' && (
              <div>
                <Hint style={{ marginBottom: '0.25rem' }}>Options (comma-separated)</Hint>
                <SmallInput
                  placeholder="e.g. Small, Medium, Large, XL"
                  value={f.options}
                  onChange={e => update(f.id, { options: e.target.value })}
                />
              </div>
            )}
            <SmallInput
              placeholder="Description / hint shown to participant (optional)"
              value={f.hint}
              onChange={e => update(f.id, { hint: e.target.value })}
            />
          </SchemaFieldSub>
        </SchemaFieldCard>
      ))}
      <AddButton type="button" onClick={add}>+ Add field</AddButton>
    </div>
  );
}

// ─── Price tier builder ───────────────────────────────────────────────────────

const TierCard = styled.div`
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.75rem 0.875rem;
  margin-bottom: 0.5rem;
  background: #fafafa;
`;

const TierCardTop = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const TierRuleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
`;

const PricePrefix = styled.span`
  font-size: 0.8rem;
  color: var(--text-secondary);
  white-space: nowrap;
`;

const RULE_OPERATORS = [
  { value: '==',  label: 'equals' },
  { value: '<',   label: 'is less than' },
  { value: '<=',  label: 'is at most' },
  { value: '>',   label: 'is greater than' },
  { value: '>=',  label: 'is at least' },
];

function TierBuilder({ tiers, onChange, schemaFields }) {
  const fieldOptions = schemaFields.filter(f => f.label.trim()).map(f => ({
    key: toKey(f.label),
    label: f.label,
  }));

  const add = () => onChange([...tiers, {
    id: uid(), name: '', price: '',
    ruleType: 'everyone',
    ruleField: fieldOptions[0]?.key || '',
    ruleOp: '==',
    ruleValue: '',
  }]);
  const remove = (id) => onChange(tiers.filter(t => t.id !== id));
  const update = (id, patch) => onChange(tiers.map(t => t.id === id ? { ...t, ...patch } : t));

  return (
    <div>
      {tiers.length === 0 && (
        <EmptyBuilder>No tiers — leave empty to use the base price for all registrations.</EmptyBuilder>
      )}
      {tiers.map(t => (
        <TierCard key={t.id}>
          <TierCardTop>
            <SmallInput
              placeholder="Tier name (e.g. Child, Adult, Member)"
              value={t.name}
              onChange={e => update(t.id, { name: e.target.value })}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <PricePrefix>S$</PricePrefix>
              <SmallInput
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={t.price}
                style={{ width: '90px' }}
                onChange={e => update(t.id, { price: e.target.value })}
              />
            </div>
            <IconButton type="button" onClick={() => remove(t.id)} title="Remove tier">✕</IconButton>
          </TierCardTop>

          <TierRuleRow>
            <SmallSelect
              value={t.ruleType}
              onChange={e => update(t.id, { ruleType: e.target.value })}
            >
              <option value="everyone">Applies to everyone (catch-all)</option>
              <option value="condition">Applies when…</option>
            </SmallSelect>

            {t.ruleType === 'condition' && (
              <>
                {fieldOptions.length > 0 ? (
                  <SmallSelect
                    value={t.ruleField}
                    onChange={e => update(t.id, { ruleField: e.target.value })}
                  >
                    <option value="">Select field…</option>
                    {fieldOptions.map(o => (
                      <option key={o.key} value={o.key}>{o.label}</option>
                    ))}
                  </SmallSelect>
                ) : (
                  <SmallInput
                    placeholder="Field name"
                    value={t.ruleField}
                    style={{ width: '120px' }}
                    onChange={e => update(t.id, { ruleField: e.target.value })}
                  />
                )}
                <SmallSelect
                  value={t.ruleOp}
                  onChange={e => update(t.id, { ruleOp: e.target.value })}
                >
                  {RULE_OPERATORS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </SmallSelect>
                <SmallInput
                  placeholder="Value"
                  value={t.ruleValue}
                  style={{ width: '80px' }}
                  onChange={e => update(t.id, { ruleValue: e.target.value })}
                />
              </>
            )}
          </TierRuleRow>
        </TierCard>
      ))}
      <AddButton type="button" onClick={add}>+ Add tier</AddButton>
      {tiers.length > 1 && (
        <Hint style={{ marginTop: '0.6rem' }}>
          Rules are checked top to bottom — first match wins. Put the catch-all tier last.
        </Hint>
      )}
    </div>
  );
}

// ─── Conversion helpers ───────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `f${++_uid}`;

function toKey(label) {
  const k = label.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  return k || 'field';
}

function schemaToFields(schema) {
  if (!schema || !schema.properties) return [];
  const required = schema.required || [];
  return Object.entries(schema.properties).map(([key, prop]) => {
    let type = 'text';
    if (prop.type === 'boolean') type = 'checkbox';
    else if (prop.type === 'number' || prop.type === 'integer') type = 'number';
    else if (prop.enum) type = 'dropdown';
    return {
      id: uid(),
      label: prop.title || key,
      type,
      options: prop.enum ? prop.enum.join(', ') : '',
      required: required.includes(key),
      hint: prop.description || '',
    };
  });
}

function fieldsToSchema(fields) {
  if (fields.length === 0) return null;
  const properties = {};
  const required = [];
  const seen = {};
  for (const f of fields) {
    let key = toKey(f.label);
    if (seen[key] !== undefined) { seen[key]++; key = `${key}_${seen[key]}`; }
    else seen[key] = 0;
    const prop = {};
    if (f.label) prop.title = f.label;
    if (f.hint.trim()) prop.description = f.hint.trim();
    if (f.type === 'checkbox') prop.type = 'boolean';
    else if (f.type === 'number') prop.type = 'number';
    else if (f.type === 'dropdown') { prop.type = 'string'; prop.enum = f.options.split(',').map(s => s.trim()).filter(Boolean); }
    else prop.type = 'string';
    properties[key] = prop;
    if (f.required) required.push(key);
  }
  const schema = { type: 'object', properties };
  if (required.length > 0) schema.required = required;
  return schema;
}

function tiersToEntries(tiers) {
  if (!Array.isArray(tiers)) return [];
  return tiers.map(t => {
    const rule = t.rule || '*';
    let ruleType = 'everyone';
    let ruleField = '';
    let ruleOp = '==';
    let ruleValue = '';
    if (rule !== '*') {
      const colon = rule.indexOf(':');
      if (colon !== -1) {
        ruleField = rule.slice(0, colon).trim();
        const cond = rule.slice(colon + 1).trim();
        const matched = ['<=', '>=', '<', '>', '=='].find(op => cond.startsWith(op));
        if (matched) {
          ruleOp = matched;
          ruleValue = cond.slice(matched.length).trim();
        } else {
          ruleOp = '==';
          ruleValue = cond;
        }
        ruleType = 'condition';
      }
    }
    return {
      id: uid(),
      name: t.name || '',
      price: t.price_incl_tax != null ? String(t.price_incl_tax) : '',
      ruleType, ruleField, ruleOp, ruleValue,
    };
  });
}

function entriesToTiers(entries) {
  if (entries.length === 0) return null;
  const seen = {};
  return entries.map(e => {
    let code = toKey(e.name) || 'tier';
    if (seen[code] !== undefined) { seen[code]++; code = `${code}_${seen[code]}`; }
    else seen[code] = 0;
    let rule = '*';
    if (e.ruleType === 'condition' && e.ruleField.trim() && e.ruleValue.trim() !== '') {
      rule = `${e.ruleField.trim()}:${e.ruleOp}${e.ruleValue.trim()}`;
    }
    return { code, name: e.name.trim(), rule, price_incl_tax: parseFloat(e.price) || 0 };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDatetimeInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  location: '',
  max_participants: '',
  max_qty: 5,
  is_active: true,
  registration_required: true,
  price_incl_tax: '0.00',
  confirmed_email_template: '',
  image_id: null,
  image_url: null,
};

export default function EventManagementEdit() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [schemaFields, setSchemaFields] = useState([]);
  const [tierEntries, setTierEntries] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [imageLibrary, setImageLibrary] = useState([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDrag, setImageDrag] = useState(false);
  const imageInputRef = useRef(null);

  useEffect(() => {
    consoleEventService.listImages()
      .then(imgs => setImageLibrary(Array.isArray(imgs) ? imgs : []))
      .catch(() => {});
  }, []);

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
          max_qty: event.max_qty ?? 5,
          is_active: event.is_active,
          registration_required: event.registration_required ?? true,
          price_incl_tax: event.price_incl_tax || '0.00',
          confirmed_email_template: event.confirmed_email_template || '',
          image_id: event.image_id || null,
          image_url: event.image_url || null,
        });
        setSchemaFields(schemaToFields(event.json_schema));
        setTierEntries(tiersToEntries(event.price_tiers));
        if (event.confirmed_email_template) setShowAdvanced(true);
      })
      .catch(() => toast.error('Failed to load event'))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = field => e => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleImageUpload = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    setImageUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const img = await consoleEventService.uploadImage(fd);
      setImageLibrary(prev => [img, ...prev]);
      setForm(prev => ({ ...prev, image_id: img.id, image_url: img.url }));
      setShowImagePicker(false);
      toast.success('Image uploaded');
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!form.start_date) { toast.error('Start date is required'); return; }

    for (const f of schemaFields) {
      if (!f.label.trim()) { toast.error('All registration fields need a label'); return; }
      if (f.type === 'dropdown' && !f.options.trim()) {
        toast.error(`Dropdown "${f.label}" needs at least one option`);
        return;
      }
    }

    for (const t of tierEntries) {
      if (!t.name.trim()) { toast.error('All pricing tiers need a name'); return; }
      if (t.price === '' || isNaN(parseFloat(t.price))) {
        toast.error(`Tier "${t.name}" needs a valid price`);
        return;
      }
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      location: form.location.trim(),
      max_participants: form.max_participants !== '' ? Number(form.max_participants) : null,
      max_qty: form.max_qty !== '' ? Number(form.max_qty) : 5,
      is_active: form.is_active,
      registration_required: form.registration_required,
      price_incl_tax: form.price_incl_tax,
      currency: 'SGD',
      json_schema: fieldsToSchema(schemaFields),
      price_tiers: entriesToTiers(tierEntries),
      validate_participant_data: true,
      confirmed_email_template: form.confirmed_email_template.trim() || null,
      image_id: form.image_id || null,
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
              <Input value={form.title} onChange={set('title')} placeholder="Event title" />
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
              <Input type="datetime-local" value={form.start_date} onChange={set('start_date')} />
            </Field>
            <Field>
              <Label>End Date & Time</Label>
              <Input type="datetime-local" value={form.end_date} onChange={set('end_date')} />
            </Field>
          </Row>

          <Row>
            <Field>
              <Label>Location</Label>
              <Input value={form.location} onChange={set('location')} placeholder="Venue or address" />
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
            <Field>
              <Label>Max Qty per Registration</Label>
              <Input
                type="number"
                min="1"
                value={form.max_qty}
                onChange={set('max_qty')}
                placeholder="5"
              />
            </Field>
          </Row>

          <Row>
            <Field>
              <Label>Event Image</Label>
              <ImagePickerWrap>
                <ImagePreviewBar $open={showImagePicker}>
                  {form.image_url
                    ? <CurrentThumb src={form.image_url} alt="Event" />
                    : <NoImagePlaceholder>🖼</NoImagePlaceholder>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                      {form.image_url ? 'Image selected' : 'No image'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <SecondaryButton
                        type="button"
                        style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
                        onClick={() => setShowImagePicker(v => !v)}
                      >
                        {showImagePicker ? 'Close picker' : form.image_url ? 'Change image' : 'Choose image'}
                      </SecondaryButton>
                      {form.image_url && (
                        <SecondaryButton
                          type="button"
                          style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem', color: '#ef4444', borderColor: '#fca5a5' }}
                          onClick={() => setForm(prev => ({ ...prev, image_id: null, image_url: null }))}
                        >
                          Remove
                        </SecondaryButton>
                      )}
                    </div>
                  </div>
                </ImagePreviewBar>

                {showImagePicker && (
                  <ImagePickerBody>
                    <UploadDropZone
                      $drag={imageDrag}
                      onDragOver={e => { e.preventDefault(); setImageDrag(true); }}
                      onDragLeave={() => setImageDrag(false)}
                      onDrop={e => { e.preventDefault(); setImageDrag(false); handleImageUpload(e.dataTransfer.files[0]); }}
                    >
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => handleImageUpload(e.target.files[0])}
                      />
                      {imageUploading
                        ? 'Uploading…'
                        : 'Click or drag an image here to upload a new one'}
                    </UploadDropZone>

                    {imageLibrary.length > 0 && (
                      <>
                        <Label style={{ display: 'block', margin: '0.75rem 0 0.4rem', fontSize: '0.75rem' }}>
                          Previously uploaded
                        </Label>
                        <ImageGrid>
                          {imageLibrary.map(img => {
                            const selected = form.image_id === img.id;
                            return (
                              <ImageGridItem
                                key={img.id}
                                $selected={selected}
                                onClick={() => {
                                  setForm(prev => ({ ...prev, image_id: img.id, image_url: img.url }));
                                  setShowImagePicker(false);
                                }}
                              >
                                <ImageGridThumb src={img.url} alt="" />
                                {selected && <ImageGridSelected>✓</ImageGridSelected>}
                              </ImageGridItem>
                            );
                          })}
                        </ImageGrid>
                      </>
                    )}
                  </ImagePickerBody>
                )}
              </ImagePickerWrap>
            </Field>
          </Row>

          <Row>
            <Field>
              <CheckboxRow>
                <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
                Active (visible on the events page)
              </CheckboxRow>
            </Field>
          </Row>

          <Row>
            <Field>
              <CheckboxRow>
                <input type="checkbox" checked={form.registration_required} onChange={set('registration_required')} />
                Registration required
              </CheckboxRow>
              <Hint>Uncheck to show an info-only page with no registration form.</Hint>
            </Field>
          </Row>
        </Section>

        {/* Registration form fields */}
        {form.registration_required && <Section>
          <SectionTitle>Registration Form Fields</SectionTitle>
          <Hint style={{ marginBottom: '0.875rem' }}>
            Add extra questions to collect from each participant at registration.
            These appear below the standard name / email / phone fields.
          </Hint>
          <SchemaFieldBuilder fields={schemaFields} onChange={setSchemaFields} />
        </Section>}

        {/* Pricing */}
        {form.registration_required && <Section>
          <SectionTitle>Pricing</SectionTitle>
          <Row $cols="1fr 2fr">
            <Field>
              <Label>Base Price (S$, incl. tax)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.price_incl_tax}
                onChange={set('price_incl_tax')}
              />
              <Hint>Set to 0 for a free event.</Hint>
            </Field>
          </Row>

          <Label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
            Pricing Tiers
          </Label>
          <Hint style={{ marginBottom: '0.75rem' }}>
            Optional. Add tiers with different prices based on participant data.
            The base price above is used when no tiers are defined.
          </Hint>
          <TierBuilder tiers={tierEntries} onChange={setTierEntries} schemaFields={schemaFields} />
        </Section>}

        {/* Advanced */}
        <Section>
          <AdvancedToggle type="button" onClick={() => setShowAdvanced(v => !v)}>
            {showAdvanced ? '▾' : '▸'} Advanced settings
          </AdvancedToggle>

          {showAdvanced && (
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
