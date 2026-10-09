import React, { useState } from 'react';
import styled from 'styled-components';
import toast from 'react-hot-toast';

// Shared participant display pieces for the guide link page and the event group page.

export const ExtraList = styled.div`
  font-size: 0.75rem;
  color: #4b5563;
  margin-top: 0.25rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.75rem;
`;

const ExtraLabel = styled.span`
  color: #9ca3af;
`;

export const AttendBtn = styled.button`
  padding: 0.25rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid ${p => p.$attended ? '#86efac' : '#d1d5db'};
  background: ${p => p.$attended ? '#dcfce7' : '#f9fafb'};
  color: ${p => p.$attended ? '#15803d' : '#374151'};
  &:disabled { opacity: 0.5; cursor: not-allowed; }
  &:hover:not(:disabled) { opacity: 0.8; }
`;

// ─── Notes cell ───────────────────────────────────────────────────────────────

// Click-to-edit notes. `onSave(value)` persists the note and may throw.
export function NotesCell({ initialNotes, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(value);
      setEditing(false);
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{ cursor: 'text', color: value ? 'inherit' : '#9ca3af', fontSize: '0.8rem' }}
        title="Click to edit notes"
      >
        {value || 'Add note…'}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <textarea
        autoFocus
        rows={2}
        value={value}
        onChange={e => setValue(e.target.value)}
        style={{ fontSize: '0.8rem', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical', width: '100%', boxSizing: 'border-box', minWidth: 140 }}
      />
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <AttendBtn $attended onClick={save} disabled={saving}>Save</AttendBtn>
        <AttendBtn onClick={() => { setEditing(false); setValue(initialNotes || ''); }}>Cancel</AttendBtn>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const unslugify = (s) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

function fmtValue(v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (Array.isArray(v)) return v.join(', ');
  if (v && typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Renders every non-internal field of one extra_json slot as "Label: value".
export function ExtraInfo({ slot, schemaProps, extraItems = [] }) {
  const fields = Object.entries(slot || {})
    .filter(([k, v]) => !k.startsWith('_') && v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [unslugify(schemaProps?.[k]?.title || k), fmtValue(v)]);
  const items = [...extraItems, ...fields];
  if (items.length === 0) return null;
  return (
    <ExtraList>
      {items.map(([label, value]) => (
        <span key={label}><ExtraLabel>{label}:</ExtraLabel> {value}</span>
      ))}
    </ExtraList>
  );
}

// extra_json is a list with one slot per person; slot 0 is the main registrant.
export function getSlots(booking) {
  if (Array.isArray(booking.extra_json)) return booking.extra_json;
  if (booking.extra_json && typeof booking.extra_json === 'object') return [booking.extra_json];
  return [];
}

// Additional people in a multi-person registration (everyone after the main registrant).
export function getSubParticipants(booking) {
  const slots = getSlots(booking);
  const count = Math.max((booking.quantity || 1) - 1, 0);
  return Array.from({ length: count }, (_, i) => {
    const slot = slots[i + 1] || {};
    return {
      name: slot._name || `Participant ${i + 2}`,
      email: slot._email || booking.email,
      phone: slot._phone || booking.phone_number,
      slot,
    };
  });
}

export function emergencyContactItems(booking) {
  return booking.emergency_contact_name || booking.emergency_contact_phone
    ? [['Emergency contact', `${booking.emergency_contact_name || ''} ${booking.emergency_contact_phone || ''}`.trim()]]
    : [];
}

export function matchesQuery(booking, q) {
  return `${booking.first_name} ${booking.last_name}`.toLowerCase().includes(q) ||
    (booking.email || '').toLowerCase().includes(q) ||
    (booking.phone_number || '').includes(q) ||
    getSubParticipants(booking).some(sp =>
      sp.name.toLowerCase().includes(q) ||
      (sp.email || '').toLowerCase().includes(q) ||
      (sp.phone || '').includes(q)
    );
}

// Attendance is tracked per registration, so headcounts sum each registration's party size.
export const headcount = (list) => list.reduce((n, b) => n + (b.quantity || 1), 0);
