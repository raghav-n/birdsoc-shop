import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { consoleEventService } from '../services/consoleEvents';

// ─── Layout ──────────────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 860px;
  margin: 2rem auto;
  padding: 0 1rem 4rem;
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.75rem;
`;

const TitleGroup = styled.div``;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
`;

const BackLink = styled(Link)`
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
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

const DangerButton = styled(Button)`
  background: #fff;
  border-color: #f87171;
  color: #dc2626;
  &:hover:not(:disabled) { background: #fef2f2; }
`;

// ─── Search + toggle bar ──────────────────────────────────────────────────────

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

const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: ${p => p.$closed ? '#fef2f2' : '#f0fdf4'};
  border: 1px solid ${p => p.$closed ? '#fca5a5' : '#86efac'};
  border-radius: 6px;
  padding: 0.4rem 0.75rem;
`;

const ToggleButton = styled.button`
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid ${p => p.$closed ? '#fca5a5' : '#86efac'};
  background: ${p => p.$closed ? '#fee2e2' : '#dcfce7'};
  color: ${p => p.$closed ? '#b91c1c' : '#15803d'};
  &:hover { opacity: 0.8; }
`;

// ─── Event list ───────────────────────────────────────────────────────────────

const Card = styled.div`
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  overflow: hidden;
`;

const CardBody = styled.div`
  padding: 1rem 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
`;

const CardMain = styled.div`
  flex: 1;
  min-width: 0;
`;

const EventTitle = styled(Link)`
  font-weight: 600;
  font-size: 1rem;
  color: var(--text-primary);
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const Meta = styled.div`
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 0.2rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
`;

const MetaItem = styled.span``;

const Badges = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-top: 0.5rem;
`;

const Badge = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: ${p =>
    p.$variant === 'green' ? '#dcfce7' :
    p.$variant === 'red' ? '#fee2e2' :
    p.$variant === 'yellow' ? '#fef9c3' :
    '#f3f4f6'};
  color: ${p =>
    p.$variant === 'green' ? '#15803d' :
    p.$variant === 'red' ? '#b91c1c' :
    p.$variant === 'yellow' ? '#854d0e' :
    '#374151'};
`;

const CardActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary);
  font-size: 0.9rem;
`;

const LoadingText = styled.div`
  text-align: center;
  padding: 2rem;
  color: var(--text-secondary);
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventManagement() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showPast, setShowPast] = useState(false);
  const [registrationClosed, setRegistrationClosed] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const loadEvents = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const data = await consoleEventService.listEvents(q);
      setEvents(data);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadToggleStatus = useCallback(async () => {
    try {
      const data = await consoleEventService.getRegistrationStatus();
      setRegistrationClosed(data.registration_closed);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadEvents();
    loadToggleStatus();
  }, [loadEvents, loadToggleStatus]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadEvents(query), 300);
    return () => clearTimeout(t);
  }, [query, loadEvents]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const data = await consoleEventService.setRegistrationClosed(!registrationClosed);
      setRegistrationClosed(data.registration_closed);
      toast.success(data.registration_closed ? 'Registrations closed' : 'Registrations opened');
    } catch {
      toast.error('Failed to toggle registration status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setDeleting(event.id);
    try {
      await consoleEventService.deleteEvent(event.id);
      toast.success('Event deleted');
      setEvents(prev => prev.filter(e => e.id !== event.id));
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setDeleting(null);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = (event) => event.start_date && new Date(event.start_date) < today;

  const visibleEvents = showPast ? events : events.filter(e => !isPast(e));

  return (
    <Page>
      <HeaderRow>
        <TitleGroup>
          <BackLink to="/console">← Console</BackLink>
          <Title>Event Management</Title>
        </TitleGroup>
        <ButtonRow>
          <PrimaryButton onClick={() => navigate('/console/events/new')}>
            + New Event
          </PrimaryButton>
        </ButtonRow>
      </HeaderRow>

      <ControlBar>
        <SearchInput
          placeholder="Search events…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <SecondaryButton
          style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', whiteSpace: 'nowrap' }}
          onClick={() => setShowPast(p => !p)}
        >
          {showPast ? 'Hide past' : 'Show past'}
        </SecondaryButton>
        <ToggleRow $closed={registrationClosed}>
          <span>Registrations: <strong>{registrationClosed ? 'CLOSED' : 'Open'}</strong></span>
          <ToggleButton
            $closed={registrationClosed}
            onClick={handleToggle}
            disabled={toggling}
          >
            {toggling ? '…' : registrationClosed ? 'Open' : 'Close'}
          </ToggleButton>
        </ToggleRow>
      </ControlBar>

      {loading ? (
        <LoadingText>Loading…</LoadingText>
      ) : visibleEvents.length === 0 ? (
        <EmptyState>
          {query
            ? 'No events match your search.'
            : showPast
            ? 'No events yet.'
            : 'No upcoming events. Use "Show past" to see past events.'}
        </EmptyState>
      ) : (
        visibleEvents.map(event => (
          <Card key={event.id}>
            <CardBody>
              <CardMain>
                <EventTitle to={`/console/events/${event.id}`}>{event.title}</EventTitle>
                <Meta>
                  <MetaItem>{formatDate(event.start_date)}</MetaItem>
                  {event.location && <MetaItem>📍 {event.location}</MetaItem>}
                  <MetaItem>
                    {event.stats.confirmed} confirmed
                    {event.stats.pending > 0 && `, ${event.stats.pending} pending`}
                    {event.max_participants ? ` / ${event.max_participants} max` : ''}
                  </MetaItem>
                  {parseFloat(event.price_incl_tax) > 0 && (
                    <MetaItem>{event.currency} {parseFloat(event.price_incl_tax).toFixed(2)}</MetaItem>
                  )}
                </Meta>
                <Badges>
                  {isPast(event)
                    ? <Badge $variant="yellow">Past</Badge>
                    : <Badge $variant={event.is_active ? 'green' : 'red'}>
                        {event.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                  }
                  {event.price_tiers && <Badge>Price tiers</Badge>}
                </Badges>
              </CardMain>
              <CardActions>
                <SecondaryButton
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => navigate(`/console/events/${event.id}/edit`)}
                >
                  Edit
                </SecondaryButton>
                <DangerButton
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  onClick={() => handleDelete(event)}
                  disabled={deleting === event.id}
                >
                  {deleting === event.id ? '…' : 'Delete'}
                </DangerButton>
              </CardActions>
            </CardBody>
          </Card>
        ))
      )}
    </Page>
  );
}
