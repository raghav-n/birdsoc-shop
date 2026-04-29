import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';
import HelpModal from '../components/HelpModal';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 920px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin: 0.3rem 0 1.5rem;
  flex-wrap: wrap;
`;

const TitleBlock = styled.div``;

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

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
`;

// ─── Stats ───────────────────────────────────────────────────────────────────

const StatsRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
`;

const StatCard = styled.div`
  flex: 1;
  min-width: 100px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  text-align: center;
`;

const StatNum = styled.div`
  font-size: 1.6rem;
  font-weight: 700;
  color: ${p => p.$color || 'var(--text-primary)'};
  line-height: 1.2;
`;

const StatLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  margin-top: 0.2rem;
`;

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TabBar = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1.25rem;
`;

const Tab = styled.button`
  background: none;
  border: none;
  padding: 0.6rem 1.1rem;
  font-size: 0.875rem;
  font-weight: ${p => p.$active ? '600' : '400'};
  color: ${p => p.$active ? 'var(--link-text)' : 'var(--text-secondary)'};
  border-bottom: 2px solid ${p => p.$active ? 'var(--link-text)' : 'transparent'};
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s;
  &:hover { color: var(--text-primary); }
`;

// ─── Participants table ───────────────────────────────────────────────────────

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
`;

const Th = styled.th`
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
`;

const Tr = styled.tr`
  &:last-child td { border-bottom: none; }
  &:hover { background: #fafafa; }
`;

const TableCard = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.25rem;
`;

const TableCardHeader = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TableCardTitle = styled.div`
  font-weight: 600;
  font-size: 0.875rem;
`;

const EmptyRow = styled.tr`
  td {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }
`;

// ─── Badges & buttons ────────────────────────────────────────────────────────

const Badge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${p =>
    p.$variant === 'green' ? '#dcfce7' :
    p.$variant === 'red' ? '#fee2e2' :
    p.$variant === 'yellow' ? '#fef9c3' :
    p.$variant === 'blue' ? '#dbeafe' :
    '#f3f4f6'};
  color: ${p =>
    p.$variant === 'green' ? '#15803d' :
    p.$variant === 'red' ? '#b91c1c' :
    p.$variant === 'yellow' ? '#854d0e' :
    p.$variant === 'blue' ? '#1d4ed8' :
    '#374151'};
  white-space: nowrap;
`;

const Btn = styled.button`
  padding: 0.3rem 0.65rem;
  border-radius: 5px;
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
  white-space: nowrap;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryBtn = styled(Btn)`
  background: var(--link-text);
  color: #fff;
  &:hover:not(:disabled) { opacity: 0.85; }
`;

const SecondaryBtn = styled(Btn)`
  background: #fff;
  border-color: #d1d5db;
  color: var(--text-primary);
  &:hover:not(:disabled) { background: #f9fafb; }
`;

const GreenBtn = styled(Btn)`
  background: #dcfce7;
  border-color: #86efac;
  color: #15803d;
  &:hover:not(:disabled) { background: #bbf7d0; }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.15s;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryButton = styled(Button)`
  background: #fff;
  border-color: #d1d5db;
  color: var(--text-primary);
  &:hover:not(:disabled) { background: #f9fafb; }
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 3rem;
  color: var(--text-secondary);
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function statusBadge(s) {
  if (s === 'paid') return <Badge $variant="green">Paid</Badge>;
  if (s === 'pending') return <Badge $variant="yellow">Pending</Badge>;
  if (s === 'cancelled') return <Badge $variant="red">Cancelled</Badge>;
  return <Badge>{s}</Badge>;
}

// ─── Notes editor (inline) ───────────────────────────────────────────────────

function NotesCell({ epId, eventId, initialNotes, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await consoleEventService.updateParticipant(eventId, epId, { notes: value });
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
        style={{ fontSize: '0.8rem', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: '4px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
      />
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        <GreenBtn onClick={save} disabled={saving}>Save</GreenBtn>
        <SecondaryBtn onClick={() => { setEditing(false); setValue(initialNotes || ''); }}>Cancel</SecondaryBtn>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const TABS = ['Participants', 'Registrations', 'Group Registrations'];

export default function EventManagementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);
  const [verifying, setVerifying] = useState(null);
  const [togglingAttendance, setTogglingAttendance] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await consoleEventService.getEvent(id);
      setEvent(data);
    } catch {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleToggleAttendance = async (ep) => {
    setTogglingAttendance(ep.ep_id);
    try {
      const updated = await consoleEventService.toggleAttendance(id, ep.ep_id);
      setEvent(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.ep_id === ep.ep_id ? { ...p, attended: updated.attended } : p
        ),
      }));
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setTogglingAttendance(null);
    }
  };

  const handleVerifyRegistration = async (reg) => {
    if (!window.confirm(`Verify payment for ${reg.participant.first_name} ${reg.participant.last_name} (${reg.reference})?`)) return;
    setVerifying(reg.id);
    try {
      await consoleEventService.verifyRegistration(reg.id);
      toast.success('Payment verified');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to verify payment');
    } finally {
      setVerifying(null);
    }
  };

  const handleVerifyGroup = async (grp) => {
    if (!window.confirm(`Verify payment for group ${grp.reference}?`)) return;
    setVerifying(`g${grp.id}`);
    try {
      await consoleEventService.verifyGroup(grp.id);
      toast.success('Group payment verified');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to verify group payment');
    } finally {
      setVerifying(null);
    }
  };

  const handleNotesSaved = (epId, value) => {
    setEvent(prev => ({
      ...prev,
      participants: prev.participants.map(p =>
        p.ep_id === epId ? { ...p, notes: value } : p
      ),
    }));
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;
  if (!event) return <Page><LoadingText>Event not found.</LoadingText></Page>;

  const confirmed = event.participants?.filter(p => p.is_confirmed && !p.is_cancelled) || [];
  const pending = event.participants?.filter(p => !p.is_confirmed && !p.is_cancelled) || [];
  const cancelled = event.participants?.filter(p => p.is_cancelled) || [];
  const pendingRegs = event.registrations?.filter(r => r.status === 'pending') || [];
  const paidRegs = event.registrations?.filter(r => r.status === 'paid') || [];
  const pendingGroups = event.groups?.filter(g => g.status === 'pending') || [];

  const tabBadge = (n) => n > 0 ? ` (${n})` : '';

  return (
    <Page>
      <HelpModal title="How to use: Event Detail">
        <h3>Overview</h3>
        <p>This page shows a full breakdown of one event — stats, attendees, and payment records.</p>
        <h3>Stats row</h3>
        <ul>
          <li><strong>Confirmed</strong> — paid registrants whose spot is secured.</li>
          <li><strong>Pending</strong> — registrants awaiting payment verification.</li>
          <li><strong>Spots left</strong> — only shown when a max capacity is set.</li>
          <li><strong>Awaiting verification</strong> — payment proofs that need your review.</li>
        </ul>
        <h3>Participants tab</h3>
        <ul>
          <li>Lists all confirmed, pending, and cancelled participants.</li>
          <li>Click <strong>Mark</strong> (or ✓ Attended) in the Attended column to record physical attendance on the day.</li>
          <li>Click the notes cell to add or edit a free-text note for any participant.</li>
        </ul>
        <h3>Registrations tab</h3>
        <ul>
          <li>Shows individual payment records. Pending ones include a <strong>View proof</strong> link.</li>
          <li>Click <strong>Verify payment</strong> after confirming the proof to move the registration to Paid and confirm the participant.</li>
        </ul>
        <h3>Group Registrations tab</h3>
        <ul>
          <li>Groups are submitted by a single payer covering multiple participants.</li>
          <li>Verify the group payment once — all participants in the group are confirmed together.</li>
        </ul>
      </HelpModal>

      <BackLink to="/console/events">← Events</BackLink>

      <HeaderRow>
        <TitleBlock>
          <Title>{event.title}</Title>
          <MetaLine>
            <span>{fmt(event.start_date)}{event.end_date ? ` – ${fmt(event.end_date)}` : ''}</span>
            {event.location && <span>📍 {event.location}</span>}
            {parseFloat(event.price_incl_tax) > 0 && (
              <span>{event.currency} {parseFloat(event.price_incl_tax).toFixed(2)}</span>
            )}
            <Badge $variant={event.is_active ? 'green' : 'red'}>
              {event.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </MetaLine>
        </TitleBlock>
        <Actions>
          <SecondaryButton onClick={() => navigate(`/console/events/${id}/edit`)}>
            Edit event
          </SecondaryButton>
        </Actions>
      </HeaderRow>

      {/* Stats */}
      <StatsRow>
        <StatCard>
          <StatNum $color="#15803d">{event.stats.confirmed}</StatNum>
          <StatLabel>Confirmed</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum $color="#854d0e">{event.stats.pending}</StatNum>
          <StatLabel>Pending</StatLabel>
        </StatCard>
        <StatCard>
          <StatNum>{event.stats.total_unique}</StatNum>
          <StatLabel>Total registrations</StatLabel>
        </StatCard>
        {event.max_participants && (
          <StatCard>
            <StatNum>{event.max_participants - event.stats.confirmed}</StatNum>
            <StatLabel>Spots left</StatLabel>
          </StatCard>
        )}
        {pendingRegs.length + pendingGroups.length > 0 && (
          <StatCard>
            <StatNum $color="#dc2626">{pendingRegs.length + pendingGroups.length}</StatNum>
            <StatLabel>Awaiting payment verification</StatLabel>
          </StatCard>
        )}
      </StatsRow>

      {/* Tabs */}
      <TabBar>
        {TABS.map((t, i) => (
          <Tab key={t} $active={tab === i} onClick={() => setTab(i)}>
            {t}
            {i === 0 ? tabBadge(event.participants?.length || 0) :
             i === 1 ? tabBadge(event.registrations?.length || 0) :
                       tabBadge(event.groups?.length || 0)}
          </Tab>
        ))}
      </TabBar>

      {/* Tab 0: Participants */}
      {tab === 0 && (
        <>
          {confirmed.length > 0 && (
            <TableCard>
              <TableCardHeader>
                <TableCardTitle>Confirmed ({confirmed.length})</TableCardTitle>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Phone</Th>
                    <Th>Qty</Th>
                    <Th>Attended</Th>
                    <Th>Notes</Th>
                    <Th>Extra</Th>
                  </tr>
                </thead>
                <tbody>
                  {confirmed.map(p => (
                    <Tr key={p.ep_id}>
                      <Td>
                        <div style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {p.is_main_contact ? 'main contact' : 'additional'}
                        </div>
                      </Td>
                      <Td>{p.email}</Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{p.phone_number || '—'}</Td>
                      <Td>{p.quantity}</Td>
                      <Td>
                        <GreenBtn
                          style={!p.attended ? { background: '#f9fafb', borderColor: '#d1d5db', color: '#374151' } : {}}
                          onClick={() => handleToggleAttendance(p)}
                          disabled={togglingAttendance === p.ep_id}
                        >
                          {togglingAttendance === p.ep_id ? '…' : p.attended ? '✓ Attended' : 'Mark'}
                        </GreenBtn>
                      </Td>
                      <Td style={{ minWidth: 140 }}>
                        <NotesCell
                          epId={p.ep_id}
                          eventId={id}
                          initialNotes={p.notes}
                          onSaved={(v) => handleNotesSaved(p.ep_id, v)}
                        />
                      </Td>
                      <Td>
                        {p.extra_json ? (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', wordBreak: 'break-all' }}>
                            {Object.entries(p.extra_json).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </span>
                        ) : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}

          {pending.length > 0 && (
            <TableCard>
              <TableCardHeader>
                <TableCardTitle>Pending confirmation ({pending.length})</TableCardTitle>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Registered</Th>
                    <Th>Qty</Th>
                    <Th>Extra</Th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <Tr key={p.ep_id}>
                      <Td style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</Td>
                      <Td>{p.email}</Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.registered_at)}</Td>
                      <Td>{p.quantity}</Td>
                      <Td>
                        {p.extra_json ? (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                            {Object.entries(p.extra_json).map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </span>
                        ) : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}

          {cancelled.length > 0 && (
            <TableCard>
              <TableCardHeader>
                <TableCardTitle style={{ color: '#9ca3af' }}>Cancelled ({cancelled.length})</TableCardTitle>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Qty</Th>
                  </tr>
                </thead>
                <tbody>
                  {cancelled.map(p => (
                    <Tr key={p.ep_id} style={{ opacity: 0.6 }}>
                      <Td>{p.first_name} {p.last_name}</Td>
                      <Td>{p.email}</Td>
                      <Td>{p.quantity}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}

          {!event.participants?.length && (
            <TableCard>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                No participants yet.
              </div>
            </TableCard>
          )}
        </>
      )}

      {/* Tab 1: Individual Registrations */}
      {tab === 1 && (
        <>
          {pendingRegs.length > 0 && (
            <TableCard>
              <TableCardHeader>
                <TableCardTitle>Awaiting payment verification ({pendingRegs.length})</TableCardTitle>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Participant</Th>
                    <Th>Amount</Th>
                    <Th>Proof</Th>
                    <Th>Registered</Th>
                    <Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRegs.map(reg => (
                    <Tr key={reg.id}>
                      <Td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{reg.reference}</Td>
                      <Td>
                        <div style={{ fontWeight: 500 }}>{reg.participant.first_name} {reg.participant.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{reg.participant.email}</div>
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>
                        {reg.currency} {parseFloat(reg.amount_with_donation).toFixed(2)}
                        {parseFloat(reg.donation_amount) > 0 && (
                          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                            incl. {reg.currency} {parseFloat(reg.donation_amount).toFixed(2)} donation
                          </div>
                        )}
                      </Td>
                      <Td>
                        {reg.payment_proof_url ? (
                          <a href={reg.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--link-text)' }}>
                            View proof
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>None uploaded</span>
                        )}
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{fmtDate(reg.created_at)}</Td>
                      <Td>
                        <GreenBtn
                          onClick={() => handleVerifyRegistration(reg)}
                          disabled={verifying === reg.id}
                        >
                          {verifying === reg.id ? 'Verifying…' : 'Verify payment'}
                        </GreenBtn>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}

          {paidRegs.length > 0 && (
            <TableCard>
              <TableCardHeader>
                <TableCardTitle>Paid ({paidRegs.length})</TableCardTitle>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Participant</Th>
                    <Th>Amount</Th>
                    <Th>Verified on</Th>
                  </tr>
                </thead>
                <tbody>
                  {paidRegs.map(reg => (
                    <Tr key={reg.id}>
                      <Td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{reg.reference}</Td>
                      <Td>
                        <div style={{ fontWeight: 500 }}>{reg.participant.first_name} {reg.participant.last_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{reg.participant.email}</div>
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>
                        {reg.currency} {parseFloat(reg.amount_with_donation).toFixed(2)}
                      </Td>
                      <Td style={{ whiteSpace: 'nowrap' }}>{fmt(reg.payment_verified_on)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
          )}

          {!event.registrations?.length && (
            <TableCard>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                No individual registrations yet.
              </div>
            </TableCard>
          )}
        </>
      )}

      {/* Tab 2: Group Registrations */}
      {tab === 2 && (
        <>
          {event.groups?.length === 0 && (
            <TableCard>
              <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
                No group registrations yet.
              </div>
            </TableCard>
          )}

          {event.groups?.map(grp => (
            <TableCard key={grp.id}>
              <TableCardHeader>
                <div>
                  <TableCardTitle style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{grp.reference}</span>
                    {statusBadge(grp.status)}
                  </TableCardTitle>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                    {grp.payer_name || '—'} · {grp.payer_email || '—'} · {grp.payer_phone || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {grp.currency} {parseFloat(grp.amount_total_with_donation).toFixed(2)}
                  </div>
                  {parseFloat(grp.donation_amount) > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                      incl. {grp.currency} {parseFloat(grp.donation_amount).toFixed(2)} donation
                    </div>
                  )}
                  {grp.status === 'pending' && (
                    <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {grp.payment_proof_url && (
                        <SecondaryBtn as="a" href={grp.payment_proof_url} target="_blank" rel="noopener noreferrer">
                          View proof
                        </SecondaryBtn>
                      )}
                      {!grp.payment_proof_url && (
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No proof uploaded</span>
                      )}
                      <GreenBtn
                        onClick={() => handleVerifyGroup(grp)}
                        disabled={verifying === `g${grp.id}`}
                      >
                        {verifying === `g${grp.id}` ? 'Verifying…' : 'Verify payment'}
                      </GreenBtn>
                    </div>
                  )}
                  {grp.status === 'paid' && (
                    <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.2rem' }}>
                      Verified {fmt(grp.payment_verified_on)}
                    </div>
                  )}
                </div>
              </TableCardHeader>
              <Table>
                <thead>
                  <tr>
                    <Th>Participant</Th>
                    <Th>Email</Th>
                    <Th>Qty</Th>
                    <Th>Amount</Th>
                    <Th>Ref</Th>
                  </tr>
                </thead>
                <tbody>
                  {grp.participants.length === 0 ? (
                    <EmptyRow><td colSpan={5}>No participants in this group.</td></EmptyRow>
                  ) : (
                    grp.participants.map(p => (
                      <Tr key={p.registration_id}>
                        <Td style={{ fontWeight: 500 }}>{p.first_name} {p.last_name}</Td>
                        <Td>{p.email}</Td>
                        <Td>{p.quantity}</Td>
                        <Td style={{ whiteSpace: 'nowrap' }}>{grp.currency} {parseFloat(p.amount).toFixed(2)}</Td>
                        <Td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.reference}</Td>
                      </Tr>
                    ))
                  )}
                </tbody>
              </Table>
            </TableCard>
          ))}
        </>
      )}
    </Page>
  );
}
