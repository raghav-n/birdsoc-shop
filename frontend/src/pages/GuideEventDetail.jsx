import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { guideService } from '../services/consoleEvents';
import {
  AttendBtn, NotesCell, ExtraInfo, getSlots, getSubParticipants,
  emergencyContactItems, matchesQuery, headcount,
  checkpointMark, checkpointCount, CheckpointButton, CheckpointStatus,
} from '../components/ParticipantInfo';

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
  background: ${p => p.$sub ? '#fafafa' : '#fff'};
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

  // Grouped events: this page marks the group's second checkpoint, per person.
  const handleToggleCheckpoint = async (booking, slot) => {
    setToggling(`${booking.ep_id}:${slot}`);
    try {
      const updated = await guideService.toggleCheckpoint(token, booking.ep_id, slot);
      setEvent(prev => ({
        ...prev,
        bookings: prev.bookings.map(b =>
          b.ep_id === booking.ep_id ? { ...b, checkpoints: updated.checkpoints, attended: updated.attended } : b
        ),
      }));
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setToggling(null);
    }
  };

  const handleNotesSave = async (epId, value) => {
    await guideService.updateNotes(token, epId, value);
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
  const schemaProps = event.json_schema?.properties || {};
  const confirmedCount = headcount(confirmed);
  const labels = event.group?.checkpoint_labels;
  const attendedCount = labels ? checkpointCount(confirmed, 2) : headcount(confirmed.filter(b => b.attended));

  // Grouped events show group check-in read-only above this site's own mark.
  const checkpointCell = (b, slot) => (
    <>
      <CheckpointStatus label={labels[0]} mark={checkpointMark(b, slot, 1)} />
      <CheckpointButton
        mark={checkpointMark(b, slot, 2)}
        busy={toggling === `${b.ep_id}:${slot}`}
        onClick={() => handleToggleCheckpoint(b, slot)}
      />
    </>
  );

  const q = query.trim().toLowerCase();
  const visible = q ? confirmed.filter(b => matchesQuery(b, q)) : confirmed;

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
          <StatNum $color="#15803d">{confirmedCount}</StatNum>
          <StatLabel>Confirmed</StatLabel>
        </StatCard>
        {labels && (
          <StatCard>
            <StatNum $color="#1d4ed8">{checkpointCount(confirmed, 1)}</StatNum>
            <StatLabel>{labels[0]}</StatLabel>
          </StatCard>
        )}
        <StatCard>
          <StatNum $color={labels ? '#0f766e' : '#1d4ed8'}>{attendedCount}</StatNum>
          <StatLabel>{labels ? labels[1] : 'Attended'}</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum>{confirmedCount - attendedCount}</StatNum>
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
          Participants ({headcount(visible)}{q ? ` of ${confirmedCount}` : ''})
          {confirmedCount !== confirmed.length && (
            <span style={{ fontWeight: 400, color: '#6b7280' }}>
              {' '}· {q ? visible.length : confirmed.length} registrations
            </span>
          )}
        </TableCardHeader>
        <TableScroll>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>{labels ? labels[1] : 'Attended'}</Th>
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
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{b.email}</div>
                    <ExtraInfo
                      slot={getSlots(b)[0]}
                      schemaProps={schemaProps}
                      extraItems={emergencyContactItems(b)}
                    />
                  </Td>
                  <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {b.phone_number || '—'}
                  </Td>
                  <Td>
                    {labels ? checkpointCell(b, 0) : <AttendBtn
                      $attended={b.attended}
                      onClick={() => handleToggleAttendance(b)}
                      disabled={toggling === b.ep_id}
                    >
                      {toggling === b.ep_id ? '…' : b.attended ? '✓ Attended' : 'Mark'}
                    </AttendBtn>}
                  </Td>
                  <Td style={{ minWidth: 140 }}>
                    <NotesCell
                      initialNotes={b.notes}
                      onSave={v => handleNotesSave(b.ep_id, v)}
                    />
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
                        {sp.email !== b.email && (
                          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sp.email}</div>
                        )}
                        <ExtraInfo slot={sp.slot} schemaProps={schemaProps} />
                      </div>
                    </Td>
                    <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#6b7280' }}>
                      {sp.phone || '—'}
                    </Td>
                    <Td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {labels ? checkpointCell(b, i + 1) : b.attended ? '✓ with group' : ''}
                    </Td>
                    <Td></Td>
                  </Tr>
                ))}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      </TableCard>
    </Page>
  );
}
