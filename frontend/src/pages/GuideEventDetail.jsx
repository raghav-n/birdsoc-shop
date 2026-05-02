import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { guideService } from '../services/consoleEvents';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 860px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const Header = styled.div`
  margin-bottom: 1.5rem;
`;

const GuideBadge = styled.span`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  padding: 0.15rem 0.6rem;
  margin-bottom: 0.5rem;
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

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
  outline: none;
  margin-bottom: 1rem;
  &:focus { border-color: var(--link-text); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
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
  background: #fff;
  &:last-child td { border-bottom: none; }
`;

const Badge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${p =>
    p.$v === 'green' ? '#dcfce7' :
    p.$v === 'yellow' ? '#fef9c3' :
    p.$v === 'blue' ? '#dbeafe' :
    '#f3f4f6'};
  color: ${p =>
    p.$v === 'green' ? '#15803d' :
    p.$v === 'yellow' ? '#854d0e' :
    p.$v === 'blue' ? '#1d4ed8' :
    '#374151'};
`;

const AttendBtn = styled.button`
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

// ─── Notes cell ───────────────────────────────────────────────────────────────

function GuideNotesCell({ token, epId, initialNotes, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await guideService.updateNotes(token, epId, value);
      onSaved(value);
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

function fmt(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuideEventDetail() {
  const { token } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await guideService.getEvent(token);
      setEvent(data);
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const handleToggleAttendance = async (booking) => {
    setToggling(booking.ep_id);
    try {
      const updated = await guideService.toggleAttendance(token, booking.ep_id);
      setEvent(prev => ({
        ...prev,
        bookings: prev.bookings.map(b =>
          b.ep_id === booking.ep_id ? { ...b, attended: updated.attended } : b
        ),
      }));
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setToggling(null);
    }
  };

  const handleNotesSaved = (epId, value) => {
    setEvent(prev => ({
      ...prev,
      bookings: prev.bookings.map(b => b.ep_id === epId ? { ...b, notes: value } : b),
    }));
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;
  if (notFound) return <Page><NotFoundBox>This guide link is invalid or has expired.</NotFoundBox></Page>;
  if (!event) return <Page><NotFoundBox>Event not found.</NotFoundBox></Page>;

  const bookings = event.bookings || [];
  const confirmed = bookings.filter(b => !b.is_cancelled && !b.is_waitlisted && b.is_confirmed);
  const attendedCount = confirmed.filter(b => b.attended).length;

  const q = query.trim().toLowerCase();
  const visible = q
    ? confirmed.filter(b =>
        `${b.first_name} ${b.last_name}`.toLowerCase().includes(q) ||
        (b.email || '').toLowerCase().includes(q) ||
        (b.phone_number || '').includes(q)
      )
    : confirmed;

  return (
    <Page>
      <Header>
        <GuideBadge>Guide access</GuideBadge>
        <Title>{event.title}</Title>
        <MetaLine>
          <span>{fmt(event.start_date)}{event.end_date ? ` – ${fmt(event.end_date)}` : ''}</span>
          {event.location && <span>📍 {event.location}</span>}
        </MetaLine>
      </Header>

      <StatsRow>
        <StatCard>
          <StatNum $color="#15803d">{confirmed.length}</StatNum>
          <StatLabel>Confirmed</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum $color="#1d4ed8">{attendedCount}</StatNum>
          <StatLabel>Attended</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum>{confirmed.length - attendedCount}</StatNum>
          <StatLabel>Not yet marked</StatLabel>
        </StatCard>
      </StatsRow>

      <SearchInput
        placeholder="Search by name, email or phone…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      <TableCard>
        <TableCardHeader>
          Participants ({visible.length}{q ? ` of ${confirmed.length}` : ''})
        </TableCardHeader>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Attended</Th>
                <Th style={{ minWidth: 140 }}>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <Tr>
                  <Td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                    {q ? 'No participants match your search.' : 'No confirmed participants yet.'}
                  </Td>
                </Tr>
              ) : visible.map(b => (
                <Tr key={b.ep_id}>
                  <Td>
                    <div style={{ fontWeight: 500 }}>{b.first_name} {b.last_name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{b.email}</div>
                  </Td>
                  <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {b.phone_number || '—'}
                  </Td>
                  <Td>
                    <AttendBtn
                      $attended={b.attended}
                      onClick={() => handleToggleAttendance(b)}
                      disabled={toggling === b.ep_id}
                    >
                      {toggling === b.ep_id ? '…' : b.attended ? '✓ Attended' : 'Mark'}
                    </AttendBtn>
                  </Td>
                  <Td style={{ minWidth: 140 }}>
                    <GuideNotesCell
                      token={token}
                      epId={b.ep_id}
                      initialNotes={b.notes}
                      onSaved={v => handleNotesSaved(b.ep_id, v)}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </TableCard>
    </Page>
  );
}
