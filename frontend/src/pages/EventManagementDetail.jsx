import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';
import HelpModal from '../components/HelpModal';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 980px;
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
  align-items: center;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
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

// ─── Table ───────────────────────────────────────────────────────────────────

const TableCard = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1.25rem;
`;

const TableScroll = styled.div`
  overflow-x: auto;
`;

const TableCardHeader = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fafafa;
`;

const TableCardTitle = styled.div`
  font-weight: 600;
  font-size: 0.875rem;
`;

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
  ${p => p.$mobileHide && '@media (max-width: 640px) { display: none; }'}
`;

const Td = styled.td`
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
  ${p => p.$mobileHide && '@media (max-width: 640px) { display: none; }'}
`;

const Tr = styled.tr`
  background: ${p => p.$sub ? '#fafbfc' : '#fff'};
  &:last-child td { border-bottom: none; }
  &:hover { background: ${p => p.$sub ? '#f3f6f9' : '#fafafa'}; }
  ${p => p.$clickable && '@media (max-width: 640px) { cursor: pointer; &:active { background: #eef2f7; } }'}
`;

// ─── Badges & buttons ────────────────────────────────────────────────────────

const Badge = styled.span`
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
  background: ${p =>
    p.$v === 'green' ? '#dcfce7' :
    p.$v === 'red' ? '#fee2e2' :
    p.$v === 'yellow' ? '#fef9c3' :
    p.$v === 'blue' ? '#dbeafe' :
    p.$v === 'purple' ? '#ede9fe' :
    '#f3f4f6'};
  color: ${p =>
    p.$v === 'green' ? '#15803d' :
    p.$v === 'red' ? '#b91c1c' :
    p.$v === 'yellow' ? '#854d0e' :
    p.$v === 'blue' ? '#1d4ed8' :
    p.$v === 'purple' ? '#6d28d9' :
    '#374151'};
`;

const Btn = styled.button`
  padding: 0.28rem 0.6rem;
  border-radius: 5px;
  font-size: 0.77rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
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

const DangerBtn = styled(Btn)`
  background: #fee2e2;
  border-color: #fca5a5;
  color: #b91c1c;
  &:hover:not(:disabled) { background: #fecaca; }
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
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

// ─── Mobile modal ─────────────────────────────────────────────────────────────

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  @media (min-width: 641px) {
    align-items: center;
    justify-content: center;
  }
`;

const ModalDialog = styled.div`
  background: #fff;
  width: 100%;
  max-height: 90vh;
  border-radius: 16px 16px 0 0;
  overflow-y: auto;
  @media (min-width: 641px) {
    width: 480px;
    max-height: 85vh;
    border-radius: 12px;
  }
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
`;

const ModalTitle = styled.div`
  font-weight: 700;
  font-size: 1rem;
`;

const ModalSubtitle = styled.div`
  font-size: 0.78rem;
  color: var(--text-secondary);
  margin-top: 0.15rem;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--text-secondary);
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
`;

const ModalBody = styled.div`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

const ModalRow = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
`;

const ModalLabel = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
  min-width: 72px;
  padding-top: 0.15rem;
`;

const ModalValue = styled.div`
  font-size: 0.875rem;
  flex: 1;
`;

const ModalDivider = styled.div`
  height: 1px;
  background: #f3f4f6;
  margin: 0.1rem 0;
`;

const ModalFooter = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
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

function paymentStatusBadge(booking) {
  if (!booking.payment) return null;
  const s = booking.payment.status;
  if (s === 'paid') return <Badge $v="green">Paid</Badge>;
  if (s === 'pending') return <Badge $v="yellow">Pending payment</Badge>;
  if (s === 'cancelled') return <Badge $v="red">Payment cancelled</Badge>;
  return null;
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

// ─── Extra info renderer ──────────────────────────────────────────────────────

function renderExtra(extra, schemaProps) {
  if (!extra || (Array.isArray(extra) ? extra.length === 0 : Object.keys(extra).length === 0)) return null;
  const items = Array.isArray(extra) ? extra[0] : extra;
  if (!items || Object.keys(items).length === 0) return null;
  return (
    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
      {Object.entries(items)
        .filter(([k]) => !k.startsWith('_'))
        .map(([k, v]) => (
          <span key={k}>{schemaProps?.[k]?.title || k}: {String(v)}  </span>
        ))}
    </div>
  );
}

// ─── Sub-participant row ──────────────────────────────────────────────────────

function SubParticipantRow({ index, slotData, mainEmail, mainPhone, schemaProps }) {
  const name = slotData?._name || `Participant ${index + 2}`;
  const email = slotData?._email || mainEmail;
  const phone = slotData?._phone || mainPhone;
  const extra = slotData ? Object.fromEntries(Object.entries(slotData).filter(([k]) => !k.startsWith('_'))) : {};

  return (
    <Tr $sub>
      <Td>
        <div style={{ paddingLeft: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>└</span>
          <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{name}</span>
        </div>
        {Object.keys(extra).length > 0 && (
          <div style={{ paddingLeft: '2.5rem' }}>{renderExtra(extra, schemaProps)}</div>
        )}
      </Td>
      <Td $mobileHide style={{ fontSize: '0.82rem', color: '#6b7280' }}>{email}</Td>
      <Td style={{ fontSize: '0.82rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{phone || '—'}</Td>
      <Td $mobileHide></Td>
      <Td $mobileHide></Td>
      <Td $mobileHide></Td>
      <Td></Td>
      <Td $mobileHide></Td>
      <Td $mobileHide></Td>
    </Tr>
  );
}

// ─── Mobile booking modal ─────────────────────────────────────────────────────

function BookingModal({ booking, eventId, schemaProps, onClose, onToggleAttendance, onVerify, onRemove, onNotesSaved, verifying, togglingAttendance, removing }) {
  const reg = booking.payment;
  const hasPendingPayment = reg?.status === 'pending';
  const isCancelled = booking.is_cancelled;
  const slots = Array.isArray(booking.extra_json) ? booking.extra_json : [];
  const extraJsx = renderExtra(slots[0], schemaProps);

  return (
    <ModalOverlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <ModalDialog>
        <ModalHeader>
          <div>
            <ModalTitle>
              {booking.first_name} {booking.last_name}
              {booking.quantity > 1 && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.85rem' }}> +{booking.quantity - 1}</span>}
            </ModalTitle>
            <ModalSubtitle>Registered {fmtDate(booking.registered_at)}</ModalSubtitle>
          </div>
          <CloseBtn onClick={onClose} aria-label="Close">×</CloseBtn>
        </ModalHeader>

        <ModalBody>
          <ModalRow>
            <ModalLabel>Email</ModalLabel>
            <ModalValue>
              <a href={`mailto:${booking.email}`} style={{ color: 'var(--link-text)' }}>{booking.email}</a>
            </ModalValue>
          </ModalRow>
          <ModalRow>
            <ModalLabel>Phone</ModalLabel>
            <ModalValue>
              {booking.phone_number
                ? <a href={`tel:${booking.phone_number}`} style={{ color: 'var(--link-text)' }}>{booking.phone_number}</a>
                : '—'}
            </ModalValue>
          </ModalRow>
          {booking.emergency_contact_name && (
            <ModalRow>
              <ModalLabel>Emergency</ModalLabel>
              <ModalValue style={{ fontSize: '0.82rem' }}>
                {booking.emergency_contact_name} {booking.emergency_contact_phone || ''}
              </ModalValue>
            </ModalRow>
          )}
          {extraJsx && (
            <ModalRow>
              <ModalLabel>Extra</ModalLabel>
              <ModalValue>{extraJsx}</ModalValue>
            </ModalRow>
          )}

          <ModalDivider />

          <ModalRow>
            <ModalLabel>Status</ModalLabel>
            <ModalValue>
              {isCancelled
                ? <Badge $v="red">Removed</Badge>
                : booking.is_confirmed
                  ? <Badge $v="green">Confirmed</Badge>
                  : reg
                    ? paymentStatusBadge(booking)
                    : <Badge $v="blue">Free — confirmed</Badge>
              }
              {reg?.is_group && (
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>Group: {reg.group_reference}</div>
              )}
            </ModalValue>
          </ModalRow>
          {reg && (
            <ModalRow>
              <ModalLabel>Amount</ModalLabel>
              <ModalValue>
                {parseFloat(reg.amount) > 0
                  ? `${reg.currency} ${parseFloat(reg.amount_total).toFixed(2)}`
                  : 'Free'}
                {parseFloat(reg.donation_amount) > 0 && (
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>incl. {parseFloat(reg.donation_amount).toFixed(2)} donation</div>
                )}
              </ModalValue>
            </ModalRow>
          )}
          {hasPendingPayment && (
            <ModalRow>
              <ModalLabel>Proof</ModalLabel>
              <ModalValue>
                {reg.payment_proof_url ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <img
                      src={reg.payment_proof_url}
                      alt="proof"
                      style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', cursor: 'pointer' }}
                      onClick={() => window.open(reg.payment_proof_url, '_blank')}
                    />
                    <a href={reg.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.77rem', color: 'var(--link-text)' }}>View full size</a>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>No proof uploaded</span>
                )}
              </ModalValue>
            </ModalRow>
          )}
          {reg?.status === 'paid' && (
            <ModalRow>
              <ModalLabel>Verified</ModalLabel>
              <ModalValue style={{ fontSize: '0.82rem', color: '#15803d' }}>{fmt(reg.payment_verified_on)}</ModalValue>
            </ModalRow>
          )}

          <ModalDivider />

          <ModalRow>
            <ModalLabel>Attended</ModalLabel>
            <ModalValue>
              {!isCancelled ? (
                <GreenBtn
                  style={!booking.attended ? { background: '#f9fafb', borderColor: '#d1d5db', color: '#374151' } : {}}
                  onClick={() => onToggleAttendance(booking)}
                  disabled={togglingAttendance === booking.ep_id}
                >
                  {togglingAttendance === booking.ep_id ? '…' : booking.attended ? '✓ Attended' : 'Mark attended'}
                </GreenBtn>
              ) : '—'}
            </ModalValue>
          </ModalRow>
          <ModalRow>
            <ModalLabel>Notes</ModalLabel>
            <ModalValue>
              {!isCancelled ? (
                <NotesCell
                  epId={booking.ep_id}
                  eventId={eventId}
                  initialNotes={booking.notes}
                  onSaved={v => onNotesSaved(booking.ep_id, v)}
                />
              ) : '—'}
            </ModalValue>
          </ModalRow>
        </ModalBody>

        <ModalFooter>
          {hasPendingPayment && (
            <GreenBtn
              onClick={() => onVerify(booking)}
              disabled={verifying === booking.ep_id}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem' }}
            >
              {verifying === booking.ep_id ? 'Verifying…' : 'Verify payment'}
            </GreenBtn>
          )}
          {!isCancelled && (
            <DangerBtn
              onClick={() => onRemove(booking)}
              disabled={removing === booking.ep_id}
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem' }}
            >
              {removing === booking.ep_id ? '…' : 'Remove participant'}
            </DangerBtn>
          )}
          <SecondaryBtn
            onClick={onClose}
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.84rem', marginLeft: 'auto' }}
          >
            Close
          </SecondaryBtn>
        </ModalFooter>
      </ModalDialog>
    </ModalOverlay>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventManagementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(null);
  const [togglingAttendance, setTogglingAttendance] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [togglingReg, setTogglingReg] = useState(false);
  const [selectedEpId, setSelectedEpId] = useState(null);
  const [promoting, setPromoting] = useState(null);

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

  const handleToggleAttendance = async (booking) => {
    setTogglingAttendance(booking.ep_id);
    try {
      const updated = await consoleEventService.toggleAttendance(id, booking.ep_id);
      setEvent(prev => ({
        ...prev,
        bookings: prev.bookings.map(b =>
          b.ep_id === booking.ep_id ? { ...b, attended: updated.attended } : b
        ),
      }));
    } catch {
      toast.error('Failed to update attendance');
    } finally {
      setTogglingAttendance(null);
    }
  };

  const handleVerify = async (booking) => {
    const reg = booking.payment;
    if (!reg) return;
    const label = reg.is_group ? `group ${reg.group_reference}` : reg.reference;
    if (!window.confirm(`Verify payment for ${booking.first_name} ${booking.last_name} (${label})?`)) return;
    setVerifying(booking.ep_id);
    try {
      if (reg.is_group) {
        await consoleEventService.verifyGroup(reg.group_id);
      } else {
        await consoleEventService.verifyRegistration(reg.id);
      }
      toast.success('Payment verified');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to verify payment');
    } finally {
      setVerifying(null);
    }
  };

  const handleRemove = async (booking) => {
    if (!window.confirm(`Remove ${booking.first_name} ${booking.last_name} from this event? This cannot be undone.`)) return;
    setRemoving(booking.ep_id);
    try {
      await consoleEventService.removeParticipant(id, booking.ep_id);
      toast.success('Participant removed');
      setSelectedEpId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to remove participant');
    } finally {
      setRemoving(null);
    }
  };

  const handlePromote = async (booking) => {
    if (!window.confirm(`Promote ${booking.first_name} ${booking.last_name} from the waitlist?`)) return;
    setPromoting(booking.ep_id);
    try {
      await consoleEventService.promoteFromWaitlist(id, booking.ep_id);
      toast.success('Participant promoted from waitlist');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to promote participant');
    } finally {
      setPromoting(null);
    }
  };

  const handleNotesSaved = (epId, value) => {
    setEvent(prev => ({
      ...prev,
      bookings: prev.bookings.map(b =>
        b.ep_id === epId ? { ...b, notes: value } : b
      ),
    }));
  };

  const handleToggleRegistrationOpen = async () => {
    setTogglingReg(true);
    try {
      await consoleEventService.updateEvent(id, { registration_open: !event.registration_open });
      setEvent(prev => ({ ...prev, registration_open: !prev.registration_open }));
      toast.success(event.registration_open ? 'Registration closed' : 'Registration opened');
    } catch {
      toast.error('Failed to update registration status');
    } finally {
      setTogglingReg(false);
    }
  };

  if (loading) return <Page><LoadingText>Loading…</LoadingText></Page>;
  if (!event) return <Page><LoadingText>Event not found.</LoadingText></Page>;

  const bookings = event.bookings || [];
  const active = bookings.filter(b => !b.is_cancelled && !b.is_waitlisted);
  const confirmed = active.filter(b => b.is_confirmed);
  const pending = active.filter(b => !b.is_confirmed);
  const waitlisted = bookings.filter(b => b.is_waitlisted && !b.is_cancelled);
  const cancelled = bookings.filter(b => b.is_cancelled);
  const awaitingVerification = active.filter(b => b.payment?.status === 'pending');

  const schemaProps = event.json_schema?.properties || {};
  const selectedBooking = selectedEpId ? (bookings.find(b => b.ep_id === selectedEpId) ?? null) : null;

  const renderBookingRow = (booking) => {
    const isCancelled = booking.is_cancelled;
    const reg = booking.payment;
    const hasPendingPayment = reg?.status === 'pending';
    const slots = Array.isArray(booking.extra_json) ? booking.extra_json : [];

    return (
      <React.Fragment key={booking.ep_id}>
        <Tr
          $clickable
          style={{ opacity: isCancelled ? 0.55 : 1 }}
          onClick={() => setSelectedEpId(booking.ep_id)}
        >
          <Td>
            <div style={{ fontWeight: 500 }}>
              {booking.first_name} {booking.last_name}
              {booking.quantity > 1 && (
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.3rem' }}>+{booking.quantity - 1}</span>
              )}
            </div>
            <div style={{ fontSize: '0.73rem', color: '#9ca3af' }}>
              {fmtDate(booking.registered_at)}
              {booking.emergency_contact_name && ` · EC: ${booking.emergency_contact_name} ${booking.emergency_contact_phone || ''}`}
            </div>
            {renderExtra(slots[0], schemaProps)}
          </Td>
          <Td $mobileHide style={{ fontSize: '0.82rem' }}>{booking.email}</Td>
          <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{booking.phone_number || '—'}</Td>
          <Td $mobileHide>
            {isCancelled
              ? <Badge $v="red">Removed</Badge>
              : booking.is_confirmed
                ? <Badge $v="green">Confirmed</Badge>
                : reg
                  ? paymentStatusBadge(booking)
                  : <Badge $v="blue">Free — confirmed</Badge>
            }
            {reg?.is_group && (
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.2rem' }}>
                Group: {reg.group_reference}
              </div>
            )}
          </Td>
          <Td $mobileHide style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
            {reg && parseFloat(reg.amount) > 0 ? (
              <span>
                {reg.currency} {parseFloat(reg.amount_total).toFixed(2)}
                {parseFloat(reg.donation_amount) > 0 && (
                  <div style={{ fontSize: '0.71rem', color: '#6b7280' }}>
                    incl. {parseFloat(reg.donation_amount).toFixed(2)} donation
                  </div>
                )}
              </span>
            ) : reg ? 'Free' : '—'}
          </Td>
          <Td $mobileHide>
            {hasPendingPayment && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {reg.payment_proof_url && (
                  <a href={reg.payment_proof_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.77rem', color: 'var(--link-text)' }}>
                    View proof
                  </a>
                )}
                {reg.payment_proof_url ? (
                  <img
                    src={reg.payment_proof_url}
                    alt="proof"
                    style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 4, border: '1px solid #e5e7eb', cursor: 'pointer' }}
                    onClick={() => window.open(reg.payment_proof_url, '_blank')}
                  />
                ) : (
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>No proof</span>
                )}
                <GreenBtn
                  onClick={e => { e.stopPropagation(); handleVerify(booking); }}
                  disabled={verifying === booking.ep_id}
                >
                  {verifying === booking.ep_id ? 'Verifying…' : 'Verify payment'}
                </GreenBtn>
              </div>
            )}
            {reg?.status === 'paid' && (
              <span style={{ fontSize: '0.75rem', color: '#15803d' }}>
                Verified {fmt(reg.payment_verified_on)}
              </span>
            )}
          </Td>
          <Td>
            {!isCancelled && (
              <GreenBtn
                style={!booking.attended ? { background: '#f9fafb', borderColor: '#d1d5db', color: '#374151' } : {}}
                onClick={e => { e.stopPropagation(); handleToggleAttendance(booking); }}
                disabled={togglingAttendance === booking.ep_id}
              >
                {togglingAttendance === booking.ep_id ? '…' : booking.attended ? '✓ Attended' : 'Mark'}
              </GreenBtn>
            )}
          </Td>
          <Td $mobileHide style={{ minWidth: 130 }}>
            {!isCancelled && (
              <NotesCell
                epId={booking.ep_id}
                eventId={id}
                initialNotes={booking.notes}
                onSaved={v => handleNotesSaved(booking.ep_id, v)}
              />
            )}
          </Td>
          <Td $mobileHide>
            {!isCancelled && (
              <DangerBtn
                onClick={e => { e.stopPropagation(); handleRemove(booking); }}
                disabled={removing === booking.ep_id}
              >
                {removing === booking.ep_id ? '…' : 'Remove'}
              </DangerBtn>
            )}
          </Td>
        </Tr>
        {/* Sub-participant rows for qty>1 */}
        {!isCancelled && booking.quantity > 1 && slots.slice(1).map((slot, i) => (
          <SubParticipantRow
            key={`${booking.ep_id}_sub_${i}`}
            index={i}
            slotData={slot}
            mainEmail={booking.email}
            mainPhone={booking.phone_number}
            schemaProps={schemaProps}
          />
        ))}
      </React.Fragment>
    );
  };

  const bookingTableHeaders = (
    <tr>
      <Th>Participant</Th>
      <Th $mobileHide>Email</Th>
      <Th>Phone</Th>
      <Th $mobileHide>Status</Th>
      <Th $mobileHide>Amount</Th>
      <Th $mobileHide>Payment</Th>
      <Th>Attended</Th>
      <Th $mobileHide>Notes</Th>
      <Th $mobileHide></Th>
    </tr>
  );

  return (
    <Page>
      <HelpModal title="How to use: Event Detail">
        <h3>Overview</h3>
        <p>This page shows a full breakdown of one event — stats, attendees, and payment records. Tags are shown in the event header alongside the active/inactive status.</p>
        <h3>Participants</h3>
        <ul>
          <li>All bookings are listed in one table. Participants 2+ are shown as indented sub-rows under the main contact.</li>
          <li>Click <strong>Mark</strong> (or ✓ Attended) to record physical attendance.</li>
          <li>Click the notes cell to add or edit a free-text note for any participant.</li>
          <li>Click <strong>Remove</strong> to cancel a participant's spot.</li>
        </ul>
        <h3>Payment verification</h3>
        <ul>
          <li>Free-event registrations are confirmed automatically and shown as <strong>Free — confirmed</strong> — no verification needed.</li>
          <li>Pending payments show a proof thumbnail (if uploaded) and a <strong>Verify payment</strong> button.</li>
          <li>Verifying confirms the participant's spot and sends them a confirmation email.</li>
          <li>Group payments are verified once — all participants in the group are confirmed together.</li>
        </ul>
        <h3>Registration open/closed</h3>
        <p>Use the <strong>Close registration</strong> / <strong>Open registration</strong> button to pause or resume sign-ups for this specific event without deactivating it.</p>
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
            <Badge $v={event.is_active ? 'green' : 'red'}>
              {event.is_active ? 'Active' : 'Inactive'}
            </Badge>
            {event.registration_required && (
              <Badge $v={event.is_registration_open ? 'blue' : 'yellow'}>
                Registration {event.is_registration_open ? 'open' : 'closed'}
              </Badge>
            )}
            {event.tags?.map(t => (
              <Badge key={t} $v="purple">{t}</Badge>
            ))}
          </MetaLine>
        </TitleBlock>
        <Actions>
          {event.registration_required && (
            <SecondaryButton
              onClick={handleToggleRegistrationOpen}
              disabled={togglingReg}
              style={event.registration_open
                ? { borderColor: '#fca5a5', color: '#b91c1c' }
                : { borderColor: '#86efac', color: '#15803d' }
              }
            >
              {togglingReg ? '…' : event.registration_open ? 'Close registration' : 'Open registration'}
            </SecondaryButton>
          )}
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
          <StatLabel>Total bookings</StatLabel>
        </StatCard>
        {event.max_participants && (
          <StatCard>
            <StatNum>{Math.max(0, event.max_participants - event.stats.confirmed)}</StatNum>
            <StatLabel>Spots left</StatLabel>
          </StatCard>
        )}
        {event.waitlist_enabled && (
          <StatCard>
            <StatNum $color="#6d28d9">{waitlisted.length}</StatNum>
            <StatLabel>On waitlist</StatLabel>
          </StatCard>
        )}
        {awaitingVerification.length > 0 && (
          <StatCard>
            <StatNum $color="#dc2626">{awaitingVerification.length}</StatNum>
            <StatLabel>Awaiting verification</StatLabel>
          </StatCard>
        )}
      </StatsRow>

      {/* ── Confirmed participants ───────────────────────────────────────────── */}
      {confirmed.length > 0 && (
        <TableCard>
          <TableCardHeader>
            <TableCardTitle>Confirmed ({confirmed.length})</TableCardTitle>
          </TableCardHeader>
          <TableScroll>
            <Table>
              <thead>{bookingTableHeaders}</thead>
              <tbody>{confirmed.map(renderBookingRow)}</tbody>
            </Table>
          </TableScroll>
        </TableCard>
      )}

      {/* ── Pending ─────────────────────────────────────────────────────────── */}
      {pending.length > 0 && (
        <TableCard>
          <TableCardHeader>
            <TableCardTitle>Pending ({pending.length})</TableCardTitle>
          </TableCardHeader>
          <TableScroll>
            <Table>
              <thead>{bookingTableHeaders}</thead>
              <tbody>{pending.map(renderBookingRow)}</tbody>
            </Table>
          </TableScroll>
        </TableCard>
      )}

      {/* ── Waitlist ────────────────────────────────────────────────────────── */}
      {event.waitlist_enabled && waitlisted.length > 0 && (
        <TableCard>
          <TableCardHeader>
            <TableCardTitle style={{ color: '#6d28d9' }}>Waitlist ({waitlisted.length})</TableCardTitle>
          </TableCardHeader>
          <TableScroll>
            <Table>
              <thead>
                <tr>
                  <Th>Participant</Th>
                  <Th $mobileHide>Email</Th>
                  <Th>Phone</Th>
                  <Th $mobileHide>Qty</Th>
                  <Th $mobileHide>Joined</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {waitlisted.map((booking, idx) => (
                  <Tr key={booking.ep_id}>
                    <Td>
                      <div style={{ fontWeight: 500 }}>
                        <Badge $v="purple" style={{ marginRight: '0.4rem' }}>#{idx + 1}</Badge>
                        {booking.first_name} {booking.last_name}
                        {booking.quantity > 1 && (
                          <span style={{ fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.3rem' }}>+{booking.quantity - 1}</span>
                        )}
                      </div>
                    </Td>
                    <Td $mobileHide style={{ fontSize: '0.82rem' }}>{booking.email}</Td>
                    <Td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{booking.phone_number || '—'}</Td>
                    <Td $mobileHide style={{ fontSize: '0.82rem' }}>{booking.quantity}</Td>
                    <Td $mobileHide style={{ fontSize: '0.82rem', color: '#6b7280' }}>{fmtDate(booking.registered_at)}</Td>
                    <Td>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <GreenBtn
                          onClick={() => handlePromote(booking)}
                          disabled={promoting === booking.ep_id}
                        >
                          {promoting === booking.ep_id ? '…' : 'Promote'}
                        </GreenBtn>
                        <DangerBtn
                          onClick={() => handleRemove(booking)}
                          disabled={removing === booking.ep_id}
                        >
                          {removing === booking.ep_id ? '…' : 'Remove'}
                        </DangerBtn>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        </TableCard>
      )}

      {/* ── Cancelled ───────────────────────────────────────────────────────── */}
      {cancelled.length > 0 && (
        <TableCard>
          <TableCardHeader>
            <TableCardTitle style={{ color: '#9ca3af' }}>Removed ({cancelled.length})</TableCardTitle>
          </TableCardHeader>
          <TableScroll>
            <Table>
              <thead>{bookingTableHeaders}</thead>
              <tbody>{cancelled.map(renderBookingRow)}</tbody>
            </Table>
          </TableScroll>
        </TableCard>
      )}

      {bookings.length === 0 && (
        <TableCard>
          <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No participants yet.
          </div>
        </TableCard>
      )}

      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          eventId={id}
          schemaProps={schemaProps}
          onClose={() => setSelectedEpId(null)}
          onToggleAttendance={handleToggleAttendance}
          onVerify={handleVerify}
          onRemove={handleRemove}
          onNotesSaved={handleNotesSaved}
          verifying={verifying}
          togglingAttendance={togglingAttendance}
          removing={removing}
        />
      )}
    </Page>
  );
}
