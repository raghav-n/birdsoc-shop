import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';
import {
  AttendBtn, NotesCell, ExtraInfo, getSlots, getSubParticipants,
  emergencyContactItems, matchesQuery, headcount,
} from '../components/ParticipantInfo';

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function EventGroupDetail() {
  const { id } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [toggling, setToggling] = useState(null);
  const [query, setQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState(null);
  const [sortBy, setSortBy] = useState('site');

  const load = useCallback(async () => {
    try {
      setGroup(await consoleEventService.getGroup(id));
    } catch (err) {
      if (err?.response?.status === 404) setNotFound(true);
      else toast.error('Failed to load event group');
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const handleToggleAttendance = async (b) => {
    setToggling(b.ep_id);
    try {
      const updated = await consoleEventService.toggleAttendance(b.event.id, b.ep_id);
      patchBooking(b.event.id, b.ep_id, { attended: updated.attended });
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setToggling(null);
    }
  };

  const handleNotesSave = async (b, value) => {
    await consoleEventService.updateParticipant(b.event.id, b.ep_id, { notes: value });
    patchBooking(b.event.id, b.ep_id, { notes: value });
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;
  if (notFound) return <Page><NotFoundBox>Event group not found.</NotFoundBox></Page>;
  if (!group) return <Page><NotFoundBox>Failed to load event group.</NotFoundBox></Page>;

  const events = group.events || [];
  // One flat list across every site; each booking remembers which event it belongs to.
  const allConfirmed = events.flatMap(ev =>
    (ev.bookings || []).filter(isConfirmed).map(b => ({ ...b, event: ev }))
  );
  const siteConfirmed = siteFilter ? allConfirmed.filter(b => b.event.id === siteFilter) : allConfirmed;

  const confirmedCount = headcount(siteConfirmed);
  const attendedCount = headcount(siteConfirmed.filter(b => b.attended));

  const q = query.trim().toLowerCase();
  const visible = (q ? siteConfirmed.filter(b => matchesQuery(b, q)) : siteConfirmed).slice();
  if (sortBy === 'name') visible.sort((a, b) => fullName(a).localeCompare(fullName(b)));
  if (sortBy === 'recent') visible.sort((a, b) => new Date(b.registered_at) - new Date(a.registered_at));

  const dates = events.map(ev => ev.start_date).filter(Boolean).sort();

  return (
    <Page>
      <Header>
        <BackLink to="/console/events?view=groups">← Event Management</BackLink>
        <div><GroupBadge>Event group · {events.length} {events.length === 1 ? 'event' : 'events'}</GroupBadge></div>
        <Title>{group.name}</Title>
        <MetaLine>
          {dates.length > 0 && (
            <span>{fmt(dates[0])}{dates.length > 1 && dates[dates.length - 1] !== dates[0] ? ` – ${fmt(dates[dates.length - 1])}` : ''}</span>
          )}
          {!group.is_active && <span style={{ color: '#b91c1c' }}>Inactive</span>}
        </MetaLine>
      </Header>

      <StatsRow>
        <StatCard>
          <StatNum $color="#15803d">{confirmedCount}</StatNum>
          <StatLabel>Confirmed</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum $color="#1d4ed8">{attendedCount}</StatNum>
          <StatLabel>Attended</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum>{confirmedCount - attendedCount}</StatNum>
          <StatLabel>Not yet marked</StatLabel>
        </StatCard>
        {(group.allocations || []).filter(a => a.is_active).map(a => (
          <StatCard key={a.id}>
            <StatNum $color="#6d28d9">{a.total_slots - a.remaining}/{a.total_slots}</StatNum>
            <StatLabel>{a.name} claimed</StatLabel>
          </StatCard>
        ))}
      </StatsRow>

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
      </ControlBar>

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
                <Th>Attended</Th>
                <Th style={{ minWidth: 140 }}>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <Tr>
                  <Td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: '1.5rem' }}>
                    {q ? 'No participants match your search.' : 'No confirmed participants yet.'}
                  </Td>
                </Tr>
              ) : visible.map(b => {
                const schemaProps = b.event.json_schema?.properties || {};
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
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{b.email}</div>
                        <ExtraInfo
                          slot={getSlots(b)[0]}
                          schemaProps={schemaProps}
                          extraItems={emergencyContactItems(b)}
                        />
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>
                        <SiteLink to={`/console/events/${b.event.id}`}>{b.event.title}</SiteLink>
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
                            {sp.email !== b.email && (
                              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sp.email}</div>
                            )}
                            <ExtraInfo slot={sp.slot} schemaProps={schemaProps} />
                          </div>
                        </Td>
                        <Td style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          {b.event.title}
                        </Td>
                        <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', color: '#6b7280' }}>
                          {sp.phone || '—'}
                        </Td>
                        <Td style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                          {b.attended ? '✓ with group' : ''}
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
