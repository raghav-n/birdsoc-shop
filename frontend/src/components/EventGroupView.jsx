import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { Copy, RefreshCw, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import {
  NotesCell, ExtraInfo, getSlots, getSubParticipants,
  emergencyContactItems, matchesQuery, headcount,
  checkpointMark, checkpointCount, CheckpointButton,
} from './ParticipantInfo';

// Event group participant list, shared by the console page and the group guide link.
// `api` adapts the data calls to either backend; console-only actions are optional on it.

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 1100px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const Header = styled.div`
  margin-bottom: 1.5rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const GroupBadge = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  background: #ede9fe;
  color: #6d28d9;
  border: 1px solid #ddd6fe;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  margin: 0.5rem 0;
`;

const Title = styled.h1`
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0 0 0.3rem;
`;

const MetaLine = styled.div`
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  flex: 1;
  min-width: 90px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  text-align: center;
`;

const StatNum = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${p => p.$color || 'var(--text-primary)'};
  line-height: 1.2;
`;

const StatLabel = styled.div`
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-top: 0.2rem;
`;

const SiteFilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const SiteFilterBtn = styled.button`
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid ${p => p.$active ? '#6d28d9' : '#d1d5db'};
  background: ${p => p.$active ? '#ede9fe' : '#fff'};
  color: ${p => p.$active ? '#6d28d9' : '#374151'};
  &:hover { border-color: #6d28d9; color: #6d28d9; }
`;

const ControlBar = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 1rem;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 200px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
`;

const SortSelect = styled.select`
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.85rem;
  background: #fff;
`;

const TableCard = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.25rem;
`;

const TableCardHeader = styled.div`
  padding: 0.65rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  font-weight: 600;
  font-size: 0.875rem;
`;

const TableScroll = styled.div`overflow-x: auto;`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.84rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 0.45rem 0.75rem;
  font-size: 0.73rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
`;

const Tr = styled.tr`
  background: ${p => p.$sub ? '#fafafa' : '#fff'};
  &:last-child td { border-bottom: none; }
`;

const SiteLink = styled(Link)`
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.82rem;
  &:hover { text-decoration: underline; }
`;

const AllocationBadge = styled.span`
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
  margin-left: 0.4rem;
  vertical-align: middle;
`;

const GuideBadge = styled(GroupBadge)`
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
`;

const Panel = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem 0.75rem;
  flex-wrap: wrap;
`;

const PanelLabel = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  flex-shrink: 0;
`;

const GuideLinkUrl = styled.span`
  flex: 1;
  font-size: 0.8rem;
  font-family: monospace;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

const SmallBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
  &:hover:not(:disabled) { border-color: #6d28d9; color: #6d28d9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryBtn = styled(SmallBtn)`
  padding: 0.45rem 0.85rem;
  font-size: 0.85rem;
  border-color: #6d28d9;
  background: #6d28d9;
  color: #fff;
  &:hover:not(:disabled) { background: #5b21b6; color: #fff; }
`;

const FieldChip = styled(SiteFilterBtn)`
  font-size: 0.78rem;
  padding: 0.2rem 0.7rem;
`;

const AddForm = styled.form`
  background: #fff;
  border: 1px solid #ddd6fe;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  align-items: end;
`;

const FormField = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
`;

const FormInput = styled.input`
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 400;
  color: var(--text-primary);
  &:focus { outline: none; border-color: #6d28d9; }
`;

const FormSelect = styled.select`
  padding: 0.45rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.88rem;
  font-weight: 400;
  background: #fff;
  color: var(--text-primary);
`;

const QuickInput = styled.input`
  width: 110px;
  padding: 0.25rem 0.4rem;
  border: 1px solid ${p => p.$empty ? '#fcd34d' : '#d1d5db'};
  border-radius: 5px;
  font-size: 0.8rem;
  &:focus { outline: none; border-color: #6d28d9; }
`;

const QuickSelect = styled.select`
  padding: 0.25rem 0.4rem;
  border: 1px solid ${p => p.$empty ? '#fcd34d' : '#d1d5db'};
  background: ${p => p.$empty ? '#fffbeb' : '#fff'};
  border-radius: 5px;
  font-size: 0.8rem;
  &:disabled { opacity: 0.5; }
`;

const AccordionToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1rem;
  border: none;
  background: #fafafa;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--text-primary);
  cursor: pointer;
  text-align: left;
  &:hover { background: #f3f4f6; }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
`;

const NotFoundBox = styled.div`
  text-align: center;
  padding: 3rem;
  color: #dc2626;
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const isConfirmed = (b) => !b.is_cancelled && !b.is_waitlisted && b.is_confirmed;
const fullName = (b) => `${b.first_name} ${b.last_name}`.trim();
const unslugify = (s) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());

// Long question titles ("Will you be driving?") make poor column headers.
const fieldLabel = (opt) => (opt.title && opt.title.length <= 24 ? opt.title : unslugify(opt.key));

const isEmpty = (v) => v === undefined || v === null || v === '';

// ─── Quick-edit control ──────────────────────────────────────────────────────

// One editable extra-info value. Selects save on change; text saves on blur/Enter.
function QuickEditControl({ option, value, onSave }) {
  const [draft, setDraft] = useState(isEmpty(value) ? '' : String(value));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(isEmpty(value) ? '' : String(value)); }, [value]);

  const save = async (next) => {
    setSaving(true);
    try {
      await onSave(next);
    } catch (err) {
      toast.error(err?.response?.data?.detail || `Failed to save ${fieldLabel(option).toLowerCase()}`);
      setDraft(isEmpty(value) ? '' : String(value));
    } finally {
      setSaving(false);
    }
  };

  if (option.enum || option.type === 'boolean') {
    const choices = option.enum
      ? option.enum.map(v => [String(v), v])
      : [['true', true], ['false', false]];
    return (
      <QuickSelect
        value={draft}
        $empty={draft === ''}
        disabled={saving}
        onChange={e => {
          const raw = e.target.value;
          setDraft(raw);
          const match = choices.find(([k]) => k === raw);
          save(match ? match[1] : null);
        }}
      >
        <option value="">—</option>
        {choices.map(([k, v]) => (
          <option key={k} value={k}>{v === true ? 'Yes' : v === false ? 'No' : k}</option>
        ))}
      </QuickSelect>
    );
  }

  const commit = () => {
    const current = isEmpty(value) ? '' : String(value);
    if (draft.trim() === current) return;
    save(draft.trim() === '' ? null : draft.trim());
  };
  return (
    <QuickInput
      type={option.type === 'number' || option.type === 'integer' ? 'number' : 'text'}
      value={draft}
      $empty={draft === ''}
      disabled={saving}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

// ─── Driving summary ─────────────────────────────────────────────────────────

// Counts answers to the driving question per site. A party registering together
// counts once, using the lead registrant's (slot 0) answer.
function DrivingSummary({ option, events, bookings }) {
  const [open, setOpen] = useState(false);
  const answers = option.enum || ['Yes', 'No', 'Unsure'];
  const tally = (list) => {
    const counts = Object.fromEntries(answers.map(a => [a, 0]));
    let unanswered = 0;
    list.forEach(b => {
      const v = getSlots(b)[0]?.[option.key];
      if (!isEmpty(v) && v in counts) counts[v]++;
      else unanswered++;
    });
    return { counts, unanswered };
  };
  const rows = events.map(ev => {
    const list = bookings.filter(b => b.event.id === ev.id);
    const drivers = list.filter(b => getSlots(b)[0]?.[option.key] === 'Yes').map(fullName);
    return { ev, ...tally(list), drivers };
  });
  const total = tally(bookings);

  return (
    <TableCard>
      <AccordionToggle type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        {option.title || 'Driving'}
        {answers.includes('Yes') && (
          <span style={{ fontWeight: 400, color: '#6b7280' }}>
            · {total.counts.Yes} driving across {bookings.length} {bookings.length === 1 ? 'registration' : 'registrations'}
          </span>
        )}
      </AccordionToggle>
      {open && (
        <TableScroll style={{ borderTop: '1px solid #e5e7eb' }}>
          <Table>
            <thead>
              <tr>
                <Th>Event</Th>
                {answers.map(a => <Th key={a}>{a}</Th>)}
                <Th>No answer</Th>
                {answers.includes('Yes') && <Th>Driving</Th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ ev, counts, unanswered, drivers }) => (
                <Tr key={ev.id}>
                  <Td style={{ whiteSpace: 'nowrap' }}>{ev.title}</Td>
                  {answers.map(a => <Td key={a}>{counts[a]}</Td>)}
                  <Td style={{ color: unanswered ? '#b45309' : undefined }}>{unanswered}</Td>
                  {answers.includes('Yes') && (
                    <Td style={{ fontSize: '0.8rem', color: '#4b5563' }}>{drivers.join(', ') || '—'}</Td>
                  )}
                </Tr>
              ))}
              {rows.length > 1 && (
                <Tr $sub>
                  <Td style={{ fontWeight: 600 }}>Total</Td>
                  {answers.map(a => <Td key={a} style={{ fontWeight: 600 }}>{total.counts[a]}</Td>)}
                  <Td style={{ fontWeight: 600 }}>{total.unanswered}</Td>
                  {answers.includes('Yes') && <Td></Td>}
                </Tr>
              )}
            </tbody>
          </Table>
          <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', color: '#6b7280', borderTop: '1px solid #f3f4f6' }}>
            Counted per registration; parties use the lead registrant's answer.
          </div>
        </TableScroll>
      )}
    </TableCard>
  );
}

// ─── Add participant form ────────────────────────────────────────────────────

function AddParticipantForm({ events, defaultEventId, quickOptions, onSubmit, onCancel }) {
  const [eventId, setEventId] = useState(defaultEventId || (events.length === 1 ? events[0].id : ''));
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [extra, setExtra] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!eventId) { toast.error('Choose an event'); return; }
    setSaving(true);
    try {
      await onSubmit({
        event_id: Number(eventId),
        name: name.trim(),
        phone_number: phone.trim(),
        email: email.trim(),
        extra,
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add participant');
      setSaving(false);
    }
  };

  return (
    <AddForm onSubmit={submit}>
      <FormField>
        Event
        <FormSelect value={eventId} onChange={e => setEventId(e.target.value)} required>
          <option value="">Choose…</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
        </FormSelect>
      </FormField>
      <FormField>
        Full name
        <FormInput value={name} onChange={e => setName(e.target.value)} required autoFocus />
      </FormField>
      <FormField>
        Contact number
        <FormInput type="tel" value={phone} onChange={e => setPhone(e.target.value)} required maxLength={20} />
      </FormField>
      <FormField>
        Email (optional)
        <FormInput type="email" value={email} onChange={e => setEmail(e.target.value)} />
      </FormField>
      {quickOptions.map(opt => (
        <FormField key={opt.key}>
          {fieldLabel(opt)} (optional)
          {opt.enum || opt.type === 'boolean' ? (
            <FormSelect
              value={isEmpty(extra[opt.key]) ? '' : String(extra[opt.key])}
              onChange={e => {
                const raw = e.target.value;
                const v = raw === '' ? null : opt.enum ? opt.enum.find(x => String(x) === raw) : raw === 'true';
                setExtra(prev => ({ ...prev, [opt.key]: v }));
              }}
            >
              <option value="">—</option>
              {(opt.enum || [true, false]).map(v => (
                <option key={String(v)} value={String(v)}>{v === true ? 'Yes' : v === false ? 'No' : v}</option>
              ))}
            </FormSelect>
          ) : (
            <FormInput
              type={opt.type === 'number' || opt.type === 'integer' ? 'number' : 'text'}
              value={extra[opt.key] ?? ''}
              onChange={e => setExtra(prev => ({ ...prev, [opt.key]: e.target.value }))}
            />
          )}
        </FormField>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <PrimaryBtn type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add'}</PrimaryBtn>
        <SmallBtn type="button" onClick={onCancel} style={{ padding: '0.45rem 0.85rem' }}>Cancel</SmallBtn>
      </div>
    </AddForm>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * `api` shape:
 *   load() → group
 *   toggleCheckpoint(booking, slot) → { checkpoints, attended }   (marks checkpoint 1)
 *   saveNotes(booking, value)
 *   setExtraField(booking, { slot, key, value }) → { extra_json }
 *   addParticipant(payload) → group
 *   updateGroup?(data) → { quick_edit_fields, checkpoint_labels }   (console only)
 *   regenerateGuideToken?() → { guide_token }            (console only)
 */
export default function EventGroupView({ api, mode = 'console' }) {
  const isGuide = mode === 'guide';
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState(null);
  const [sortBy, setSortBy] = useState('site');
  const [adding, setAdding] = useState(false);
  const [savingFields, setSavingFields] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroup(await api.load());
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else toast.error('Failed to load event group');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  const patchBooking = (eventId, epId, changes) => {
    setGroup(prev => ({
      ...prev,
      events: prev.events.map(ev => ev.id !== eventId ? ev : {
        ...ev,
        bookings: ev.bookings.map(b => b.ep_id === epId ? { ...b, ...changes } : b),
      }),
    }));
  };

  const handleToggleCheckpoint = async (b, slot) => {
    setToggling(`${b.ep_id}:${slot}`);
    try {
      const updated = await api.toggleCheckpoint(b, slot);
      patchBooking(b.event.id, b.ep_id, { checkpoints: updated.checkpoints, attended: updated.attended });
    } catch {
      toast.error('Failed to update check-in');
    } finally {
      setToggling(null);
    }
  };

  const handleNotesSave = async (b, value) => {
    await api.saveNotes(b, value);
    patchBooking(b.event.id, b.ep_id, { notes: value });
  };

  const handleExtraSave = async (b, slot, key, value) => {
    const updated = await api.setExtraField(b, { slot, key, value });
    patchBooking(b.event.id, b.ep_id, { extra_json: updated.extra_json });
  };

  const handleAdd = async (payload) => {
    setGroup(await api.addParticipant(payload));
    setAdding(false);
    toast.success(`Added ${payload.name}`);
  };

  const toggleQuickField = async (key) => {
    const current = group.quick_edit_fields || [];
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    setSavingFields(true);
    try {
      const res = await api.updateGroup({ quick_edit_fields: next });
      setGroup(prev => ({ ...prev, quick_edit_fields: res.quick_edit_fields }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update quick-edit fields');
    } finally {
      setSavingFields(false);
    }
  };

  const saveCheckpointLabel = async (index, value) => {
    const labels = [...group.checkpoint_labels];
    if (!value.trim() || value.trim() === labels[index]) return;
    labels[index] = value.trim();
    try {
      const res = await api.updateGroup({ checkpoint_labels: labels });
      setGroup(prev => ({ ...prev, checkpoint_labels: res.checkpoint_labels }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to rename checkpoint');
    }
  };

  const handleRegenerate = async () => {
    if (!window.confirm('This will invalidate the current guide link. Continue?')) return;
    setRegenerating(true);
    try {
      const res = await api.regenerateGuideToken();
      setGroup(prev => ({ ...prev, guide_token: res.guide_token }));
      toast.success('Guide link regenerated');
    } catch {
      toast.error('Failed to regenerate guide link');
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;
  if (notFound) {
    return (
      <Page>
        <NotFoundBox>{isGuide ? 'This guide link is invalid or has expired.' : 'Event group not found.'}</NotFoundBox>
      </Page>
    );
  }
  if (!group) return <Page><NotFoundBox>Failed to load event group.</NotFoundBox></Page>;

  const events = group.events || [];
  const fieldOptions = group.field_options || [];
  const quickOptions = (group.quick_edit_fields || [])
    .map(k => fieldOptions.find(o => o.key === k))
    .filter(Boolean);
  const quickKeys = quickOptions.map(o => o.key);
  const drivingOption = fieldOptions.find(o => o.key === 'driving');
  const colCount = 5 + quickOptions.length;

  // One flat list across every site; each booking remembers which event it belongs to.
  const allConfirmed = events.flatMap(ev =>
    (ev.bookings || []).filter(isConfirmed).map(b => ({ ...b, event: ev }))
  );
  const siteConfirmed = siteFilter ? allConfirmed.filter(b => b.event.id === siteFilter) : allConfirmed;

  const confirmedCount = headcount(siteConfirmed);
  const [checkInLabel, siteLabel] = group.checkpoint_labels || ['Check-in', 'At site'];
  const attendedCount = checkpointCount(siteConfirmed, 1);

  const q = query.trim().toLowerCase();
  const visible = (q ? siteConfirmed.filter(b => matchesQuery(b, q)) : siteConfirmed).slice();
  if (sortBy === 'name') visible.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  if (sortBy === 'recent') visible.sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));

  const dates = events.map(ev => ev.start_date).filter(Boolean).sort();
  const guideUrl = group.guide_token ? `${window.location.origin}/event-group/${group.guide_token}` : null;

  return (
    <Page>
      <Header>
        {!isGuide && <BackLink to="/console/events?view=groups">← Event Management</BackLink>}
        <div>
          {isGuide && <GuideBadge>Guide access</GuideBadge>}{' '}
          <GroupBadge>Event group · {events.length} {events.length === 1 ? 'event' : 'events'}</GroupBadge>
        </div>
        <Title>{group.name}</Title>
        <MetaLine>
          {dates.length > 0 && (
            <span>{fmt(dates[0])}{dates.length > 1 && dates[dates.length - 1] !== dates[0] ? ` – ${fmt(dates[dates.length - 1])}` : ''}</span>
          )}
          {!group.is_active && <span style={{ color: '#b91c1c' }}>Inactive</span>}
        </MetaLine>
      </Header>

      {!isGuide && guideUrl && (
        <Panel>
          <PanelLabel>Guide link</PanelLabel>
          <GuideLinkUrl title={guideUrl}>{guideUrl}</GuideLinkUrl>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <SmallBtn onClick={() => { navigator.clipboard.writeText(guideUrl); toast.success('Copied!'); }}>
              <Copy size={13} /> Copy
            </SmallBtn>
            <SmallBtn
              onClick={handleRegenerate}
              disabled={regenerating}
              title="Invalidates the current link and issues a new one"
            >
              <RefreshCw size={13} /> Regenerate
            </SmallBtn>
          </div>
        </Panel>
      )}

      {!isGuide && fieldOptions.length > 0 && (
        <Panel>
          <PanelLabel title="Shown as editable columns here and on the guide link">Quick-edit fields</PanelLabel>
          {fieldOptions.map(opt => (
            <FieldChip
              key={opt.key}
              type="button"
              title={opt.title}
              $active={quickKeys.includes(opt.key)}
              disabled={savingFields}
              onClick={() => toggleQuickField(opt.key)}
            >
              {quickKeys.includes(opt.key) ? '✓ ' : ''}{fieldLabel(opt)}
            </FieldChip>
          ))}
        </Panel>
      )}

      {!isGuide && (
        <Panel>
          <PanelLabel title="Checkpoint 1 is marked here; checkpoint 2 on each event's own page">Checkpoints</PanelLabel>
          {[checkInLabel, siteLabel].map((label, i) => (
            <label key={`${i}:${label}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: '#6b7280' }}>
              {i + 1}.
              <QuickInput
                defaultValue={label}
                aria-label={`Checkpoint ${i + 1} name`}
                style={{ width: 130 }}
                onBlur={e => saveCheckpointLabel(i, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              {i === 0 ? <span>(this page)</span> : <span>(event pages)</span>}
            </label>
          ))}
        </Panel>
      )}

      <StatsRow>
        <StatCard>
          <StatNum $color="#15803d">{confirmedCount}</StatNum>
          <StatLabel>Confirmed</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum $color="#1d4ed8">{attendedCount}</StatNum>
          <StatLabel>{checkInLabel}</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum>{confirmedCount - attendedCount}</StatNum>
          <StatLabel>Not yet marked</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum $color="#0f766e">{checkpointCount(siteConfirmed, 2)}</StatNum>
          <StatLabel>{siteLabel}</StatLabel>
        </StatCard>
        {(group.allocations || []).filter(a => a.is_active).map(a => (
          <StatCard key={a.id}>
            <StatNum $color="#6d28d9">{a.total_slots - a.remaining}/{a.total_slots}</StatNum>
            <StatLabel>{a.name} claimed</StatLabel>
          </StatCard>
        ))}
      </StatsRow>

      {drivingOption && allConfirmed.length > 0 && (
        <DrivingSummary option={drivingOption} events={events} bookings={allConfirmed} />
      )}

      <SiteFilterRow>
        <SiteFilterBtn $active={!siteFilter} onClick={() => setSiteFilter(null)}>
          All ({headcount(allConfirmed)})
        </SiteFilterBtn>
        {events.map(ev => (
          <SiteFilterBtn
            key={ev.id}
            $active={siteFilter === ev.id}
            onClick={() => setSiteFilter(s => s === ev.id ? null : ev.id)}
          >
            {ev.title} ({headcount(allConfirmed.filter(b => b.event.id === ev.id))}
            {ev.max_participants ? `/${ev.max_participants}` : ''})
          </SiteFilterBtn>
        ))}
      </SiteFilterRow>

      <ControlBar>
        <SearchInput
          placeholder="Search by name, email or phone…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <SortSelect value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="site">Sort by event</option>
          <option value="name">Sort by name</option>
          <option value="recent">Most recent first</option>
        </SortSelect>
        {!adding && (
          <PrimaryBtn type="button" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add participant
          </PrimaryBtn>
        )}
      </ControlBar>

      {adding && (
        <AddParticipantForm
          events={events}
          defaultEventId={siteFilter}
          quickOptions={quickOptions}
          onSubmit={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      <TableCard>
        <TableCardHeader>
          Participants ({headcount(visible)}{q ? ` of ${confirmedCount}` : ''})
          {confirmedCount !== siteConfirmed.length && (
            <span style={{ fontWeight: 400, color: '#6b7280' }}>
              {' '}· {q ? visible.length : siteConfirmed.length} registrations
            </span>
          )}
        </TableCardHeader>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Event</Th>
                <Th>Phone</Th>
                {quickOptions.map(opt => <Th key={opt.key} title={opt.title}>{fieldLabel(opt)}</Th>)}
                <Th>{checkInLabel}</Th>
                <Th style={{ minWidth: 140 }}>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <Tr>
                  <Td colSpan={colCount} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                    {q ? 'No participants match your search.' : 'No confirmed participants yet.'}
                  </Td>
                </Tr>
              ) : visible.map(b => {
                const schemaProps = b.event.json_schema?.properties || {};
                const slots = getSlots(b);
                return (
                  <React.Fragment key={b.ep_id}>
                    <Tr>
                      <Td>
                        <div style={{ fontWeight: 500 }}>
                          {b.first_name} {b.last_name}
                          {b.quantity > 1 && (
                            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400, marginLeft: '0.3rem' }}>
                              +{b.quantity - 1}
                            </span>
                          )}
                          {b.allocation && <AllocationBadge>{b.allocation}</AllocationBadge>}
                        </div>
                        {b.email && <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{b.email}</div>}
                        <ExtraInfo
                          slot={slots[0]}
                          schemaProps={schemaProps}
                          extraItems={emergencyContactItems(b)}
                          hideKeys={quickKeys}
                        />
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>
                        {isGuide
                          ? <span style={{ fontSize: '0.82rem' }}>{b.event.title}</span>
                          : <SiteLink to={`/console/events/${b.event.id}`}>{b.event.title}</SiteLink>}
                      </Td>
                      <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                        {b.phone_number || '—'}
                      </Td>
                      {quickOptions.map(opt => (
                        <Td key={opt.key}>
                          <QuickEditControl
                            option={opt}
                            value={slots[0]?.[opt.key]}
                            onSave={v => handleExtraSave(b, 0, opt.key, v)}
                          />
                        </Td>
                      ))}
                      <Td>
                        <CheckpointButton
                          mark={checkpointMark(b, 0, 1)}
                          busy={toggling === `${b.ep_id}:0`}
                          onClick={() => handleToggleCheckpoint(b, 0)}
                        />
                      </Td>
                      <Td style={{ minWidth: 140 }}>
                        <NotesCell initialNotes={b.notes} onSave={v => handleNotesSave(b, v)} />
                      </Td>
                    </Tr>
                    {getSubParticipants(b).map((sp, i) => (
                      <Tr $sub key={`${b.ep_id}_sub_${i}`}>
                        <Td>
                          <div style={{ paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>└</span>
                            <span style={{ fontWeight: 500, fontSize: '0.84rem' }}>{sp.name}</span>
                          </div>
                          <div style={{ paddingLeft: '2.4rem' }}>
                            {sp.email && sp.email !== b.email && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sp.email}</div>
                            )}
                            <ExtraInfo slot={sp.slot} schemaProps={schemaProps} hideKeys={quickKeys} />
                          </div>
                        </Td>
                        <Td style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {b.event.title}
                        </Td>
                        <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#6b7280' }}>
                          {sp.phone || '—'}
                        </Td>
                        {quickOptions.map(opt => (
                          <Td key={opt.key}>
                            <QuickEditControl
                              option={opt}
                              value={sp.slot?.[opt.key]}
                              onSave={v => handleExtraSave(b, i + 1, opt.key, v)}
                            />
                          </Td>
                        ))}
                        <Td>
                          <CheckpointButton
                            mark={checkpointMark(b, i + 1, 1)}
                            busy={toggling === `${b.ep_id}:${i + 1}`}
                            onClick={() => handleToggleCheckpoint(b, i + 1)}
                          />
                        </Td>
                        <Td></Td>
                      </Tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </TableScroll>
      </TableCard>
    </Page>
  );
}
