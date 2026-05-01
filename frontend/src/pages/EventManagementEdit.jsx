import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';
import HelpModal from '../components/HelpModal';
import RichTextEditor from '../components/RichTextEditor';
import { X } from 'lucide-react';

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

const DEFAULT_EMAIL_TEMPLATE = `<p>Dear {{first_name}},</p>

<p>Your registration for <strong>{{event_title}}</strong> has been confirmed.</p>

<p>
  <strong>Date:</strong> {{event_date}}<br>
  <strong>Location:</strong> {{event_location}}
</p>

<p>{{participant_details}}</p>

<p>We look forward to seeing you at the event!</p>

<p>Best regards,<br>
Bird Society of Singapore</p>`;

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
                  style={{ width: '100%', boxSizing: 'border-box' }}
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
                  <>
                    <SmallSelect
                      value={t.ruleField}
                      onChange={e => update(t.id, { ruleField: e.target.value })}
                    >
                      <option value="">Select field…</option>
                      {fieldOptions.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </SmallSelect>
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
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                    Add registration form fields above before using conditions.
                  </span>
                )}
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

// ─── Tag picker ──────────────────────────────────────────────────────────────

const TagsWrap = styled.div`
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0.4rem 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  min-height: 38px;
  align-items: center;
  cursor: text;
  background: #fff;
`;

const TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
`;

const TagInput = styled.input`
  border: none;
  outline: none;
  font-size: 0.875rem;
  min-width: 120px;
  flex: 1;
  background: transparent;
`;

const TagDropdown = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 20;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  max-height: 180px;
  overflow-y: auto;
  margin-top: 2px;
`;

const TagDropdownItem = styled.div`
  padding: 0.45rem 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover { background: #f0f9ff; }
`;

function TagPicker({ tags, onChange, existingTags }) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const suggestions = existingTags.filter(t =>
    !tags.includes(t) && t.toLowerCase().includes(input.toLowerCase())
  );

  const add = (tag) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
    setOpen(false);
  };

  const remove = (tag) => onChange(tags.filter(t => t !== tag));

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) add(input);
    } else if (e.key === 'Backspace' && !input && tags.length) {
      remove(tags[tags.length - 1]);
    }
  };

  useEffect(() => {
    const handleClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <TagsWrap onClick={() => wrapRef.current.querySelector('input')?.focus()}>
        {tags.map(t => (
          <TagChip key={t}>
            {t}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(t); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#1d4ed8' }}
            >
              <X size={11} />
            </button>
          </TagChip>
        ))}
        <TagInput
          value={input}
          onChange={e => { setInput(e.target.value); setOpen(true); }}
          onKeyDown={handleKey}
          onFocus={() => setOpen(true)}
          placeholder={tags.length ? '' : 'Type a tag and press Enter…'}
        />
      </TagsWrap>
      {open && (input || suggestions.length > 0) && (
        <TagDropdown>
          {suggestions.map(s => (
            <TagDropdownItem key={s} onMouseDown={() => add(s)}>{s}</TagDropdownItem>
          ))}
          {input.trim() && !tags.includes(input.trim()) && !suggestions.includes(input.trim()) && (
            <TagDropdownItem onMouseDown={() => add(input)}>
              Create "<strong>{input.trim()}</strong>"
            </TagDropdownItem>
          )}
        </TagDropdown>
      )}
    </div>
  );
}

// ─── Confirmation page preview modal ─────────────────────────────────────────

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const ModalBox = styled.div`
  background: #fff;
  border-radius: 12px;
  max-width: 540px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

function ConfirmationPreviewModal({ message, onClose }) {
  return (
    <ModalOverlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalBox>
        <ModalHeader>
          <strong style={{ fontSize: '0.9rem' }}>Confirmation page preview</strong>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </ModalHeader>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1.5rem 1.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>✅</div>
          <h2 style={{ margin: '0 0 0.4rem', fontSize: '1.2rem', color: '#111' }}>You're registered!</h2>
          <p style={{ color: '#666', margin: '0 0 0.75rem', fontSize: '0.9rem' }}>
            A confirmation email has been sent to your email address.
          </p>
          {message && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem 1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#111',
              textAlign: 'left',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {message || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No message yet</span>}
            </div>
          )}
          {!message && (
            <p style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              (Your custom message will appear here)
            </p>
          )}
        </div>
      </ModalBox>
    </ModalOverlay>
  );
}

// ─── Component constants ──────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  location: '',
  max_participants: '',
  max_qty: 5,
  is_active: true,
  registration_open: true,
  registration_required: true,
  waitlist_enabled: false,
  price_incl_tax: '0.00',
  confirmed_email_template: DEFAULT_EMAIL_TEMPLATE,
  post_registration_message: '',
  tags: [],
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
  const [showPreview, setShowPreview] = useState(false);
  const [existingTags, setExistingTags] = useState([]);

  const [imageLibrary, setImageLibrary] = useState([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageDrag, setImageDrag] = useState(false);
  const imageInputRef = useRef(null);

  useEffect(() => {
    consoleEventService.listImages()
      .then(imgs => setImageLibrary(Array.isArray(imgs) ? imgs : []))
      .catch(() => {});
    consoleEventService.listTags()
      .then(tags => setExistingTags(Array.isArray(tags) ? tags : []))
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
          registration_open: event.registration_open ?? true,
          registration_required: event.registration_required ?? true,
          waitlist_enabled: event.waitlist_enabled ?? false,
          price_incl_tax: event.price_incl_tax || '0.00',
          confirmed_email_template: event.confirmed_email_template || DEFAULT_EMAIL_TEMPLATE,
          post_registration_message: event.post_registration_message || '',
          tags: event.tags || [],
          image_id: event.image_id || null,
          image_url: event.image_url || null,
        });
        setSchemaFields(schemaToFields(event.json_schema));
        setTierEntries(tiersToEntries(event.price_tiers));
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
      registration_open: form.registration_open,
      registration_required: form.registration_required,
      waitlist_enabled: parseFloat(form.price_incl_tax) > 0 ? false : form.waitlist_enabled,
      price_incl_tax: form.price_incl_tax,
      currency: 'SGD',
      json_schema: fieldsToSchema(schemaFields),
      price_tiers: entriesToTiers(tierEntries),
      validate_participant_data: true,
      confirmed_email_template: form.confirmed_email_template.trim() || null,
      post_registration_message: form.post_registration_message.trim() || null,
      tags: form.tags,
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
      <HelpModal title="How to use: Event Form">
        <h3>Overview</h3>
        <p>Use this form to create a new event or edit an existing one.</p>
        <h3>Basic info</h3>
        <ul>
          <li><strong>Title</strong> and <strong>Start Date</strong> are required.</li>
          <li><strong>Description</strong> supports rich text — use the toolbar to add headings, bold, lists, etc.</li>
          <li><strong>Tags</strong> — type a tag and press Enter, or pick from existing ones. Used to filter events on the public page.</li>
          <li><strong>Active</strong> — uncheck to hide the event from the public events page without deleting it.</li>
          <li><strong>Registration required</strong> — uncheck for info-only events with no sign-up form (e.g. drop-in sessions).</li>
          <li><strong>Registration open</strong> — uncheck to pause sign-ups for this event while keeping it visible. Only shown when registration is required.</li>
          <li><strong>Total participants</strong> — leave blank for unlimited capacity.</li>
          <li><strong>Max participants per registration</strong> — the most tickets one person can claim in a single registration.</li>
          <li><strong>Enable waitlist</strong> — only available for free events. When enabled, if a registration would exceed available spots the participant is added to a waitlist and automatically promoted (and notified by email) when a spot opens. Waitlist is not supported for paid events.</li>
        </ul>
        <h3>Registration form fields</h3>
        <p>Add custom questions collected from each participant at sign-up (e.g. T-shirt size, dietary requirements). Supported types: text, number, dropdown, checkbox.</p>
        <h3>Pricing</h3>
        <ul>
          <li>Set the <strong>Base Price</strong> to 0 for a free event.</li>
          <li><strong>Pricing tiers</strong> let you charge different amounts based on a participant's answer to one of your form fields. Rules are checked top-to-bottom — first match wins. Add a catch-all tier last.</li>
          <li>The <strong>Applies when…</strong> condition requires at least one registration form field to be defined first.</li>
        </ul>
        <h3>Confirmation page message</h3>
        <p>Optional text shown to participants on the "You're registered!" screen immediately after signing up. Good for what-to-bring notes, meeting point details, etc.</p>
        <h3>Registration confirmation email</h3>
        <p>Sent automatically when a participant registers for a free event, or when their payment is verified for a paid event. Use the toolbar to format it and insert variables like <code>{'{{first_name}}'}</code> and <code>{'{{event_title}}'}</code> anywhere in the text.</p>
      </HelpModal>

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
              <RichTextEditor
                value={form.description}
                onChange={val => setForm(prev => ({ ...prev, description: val }))}
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
              <Label>Total participants</Label>
              <Input
                type="number"
                min="1"
                value={form.max_participants}
                onChange={set('max_participants')}
                placeholder="Unlimited"
              />
            </Field>
            <Field>
              <Label>Max participants per registration</Label>
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
              <Hint style={{ marginTop: '0.4rem' }}>
                Recommended: <strong>1200 × 800 px</strong> (3:2 landscape), JPG or PNG. Keep the main subject centred — images are cropped to fill. Portrait images will be cropped significantly.
              </Hint>
            </Field>
          </Row>

          <Row>
            <Field>
              <Label>Tags</Label>
              <TagPicker
                tags={form.tags}
                onChange={tags => setForm(prev => ({ ...prev, tags }))}
                existingTags={existingTags}
              />
              <Hint>Press Enter or comma to add a tag. Select from existing tags or create new ones.</Hint>
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

          {form.registration_required && (
            <Row>
              <Field>
                <CheckboxRow>
                  <input type="checkbox" checked={form.registration_open} onChange={set('registration_open')} />
                  Registration open
                </CheckboxRow>
                <Hint>Uncheck to close registration while keeping the event visible. Useful for pausing sign-ups for a specific event.</Hint>
              </Field>
            </Row>
          )}
          {form.registration_required && (() => {
            const isPaidEvent = parseFloat(form.price_incl_tax || '0') > 0;
            return (
              <Row>
                <Field>
                  <CheckboxRow style={isPaidEvent ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                    <input
                      type="checkbox"
                      checked={!isPaidEvent && form.waitlist_enabled}
                      onChange={isPaidEvent ? undefined : set('waitlist_enabled')}
                      disabled={isPaidEvent}
                    />
                    Enable waitlist
                  </CheckboxRow>
                  <Hint>
                    {isPaidEvent
                      ? 'Waitlist is only available for free events. Set the base price to 0 to enable this option.'
                      : 'When enabled and the event is full, or when a registration requests more spots than are available, participants are added to a waitlist and notified by email when spots open up.'}
                  </Hint>
                </Field>
              </Row>
            );
          })()}
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

          {parseFloat(form.price_incl_tax) > 0 && (
            <>
              <Label style={{ display: 'block', marginBottom: '0.5rem', marginTop: '0.25rem' }}>
                Pricing Tiers
              </Label>
              <Hint style={{ marginBottom: '0.75rem' }}>
                Optional. Add tiers with different prices based on participant data.
                The base price above is used when no tiers are defined.
              </Hint>
              <TierBuilder tiers={tierEntries} onChange={setTierEntries} schemaFields={schemaFields} />
            </>
          )}
        </Section>}

        {/* Confirmation message */}
        {form.registration_required && (
          <Section>
            <SectionTitle>Confirmation Page Message</SectionTitle>
            <Hint style={{ marginBottom: '0.875rem' }}>
              Shown to participants on the "You're registered!" page after signing up. Use this for any event-specific instructions, what to bring, location tips, etc.
            </Hint>
            <Row>
              <Field>
                <Textarea
                  rows={5}
                  style={{ fontFamily: 'inherit' }}
                  value={form.post_registration_message}
                  onChange={set('post_registration_message')}
                  placeholder="e.g. Please meet at the main entrance at 7:45am. Bring water and wear comfortable shoes."
                />
              </Field>
            </Row>
            <SecondaryButton
              type="button"
              style={{ fontSize: '0.82rem', padding: '0.3rem 0.75rem' }}
              onClick={() => setShowPreview(true)}
            >
              Preview confirmation page
            </SecondaryButton>
          </Section>
        )}

        {/* Confirmation email */}
        {form.registration_required && (
          <Section>
            <SectionTitle>Registration Confirmation Email</SectionTitle>
            <Hint style={{ marginBottom: '0.875rem' }}>
              Sent when a participant registers (free events) or when their payment is verified (paid events).
              Use the toolbar to format content. You can insert these variables anywhere in the text:{' '}
              <code>{'{{first_name}}'}</code>, <code>{'{{last_name}}'}</code>, <code>{'{{event_title}}'}</code>,{' '}
              <code>{'{{event_date}}'}</code>, <code>{'{{event_location}}'}</code>, <code>{'{{amount}}'}</code>,{' '}
              <code>{'{{currency}}'}</code>, <code>{'{{registration_reference}}'}</code>, <code>{'{{participant_details}}'}</code>.
            </Hint>
            <Row>
              <Field>
                <RichTextEditor
                  value={form.confirmed_email_template}
                  onChange={val => setForm(prev => ({ ...prev, confirmed_email_template: val }))}
                />
              </Field>
            </Row>
          </Section>
        )}

        <ButtonRow>
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Changes'}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={() => navigate(backPath)}>
            Cancel
          </SecondaryButton>
        </ButtonRow>
      </form>

      {showPreview && (
        <ConfirmationPreviewModal
          message={form.post_registration_message}
          onClose={() => setShowPreview(false)}
        />
      )}
    </Page>
  );
}
