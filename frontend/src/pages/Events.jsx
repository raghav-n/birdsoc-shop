import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Card, Badge, Button } from '../styles/GlobalStyles';
import { eventService } from '../services/misc';
import BannerGrid from '../components/BannerGrid';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { Calendar, MapPin, Users } from 'lucide-react';

const EventsContainer = styled.div`
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
`;

const EventsHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const EventsTitle = styled.h1`
  font-size: 2rem;
  color: var(--dark);
  margin-bottom: 0.5rem;
`;

const EventsSubtitle = styled.p`
  color: #666;
  margin: 0;
`;

const EventCard = styled(Card)`
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const EventTitle = styled.h2`
  margin: 0;
  font-size: 1.4rem;
  color: var(--dark);
`;

const EventMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  font-size: 0.9rem;
  color: #666;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const EventDescription = styled.p`
  margin: 0;
  color: var(--dark);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const EventFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
`;

const Price = styled.span`
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--dark);
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #666;
`;

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await eventService.getEvents();
        setEvents(Array.isArray(data) ? data : data.results || []);
      } catch {
        setError('Failed to load events. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  if (loading) return <Loading text="Loading events..." />;
  if (error) return <EventsContainer><Alert variant="error">{error}</Alert></EventsContainer>;

  return (
    <EventsContainer>
      <BannerGrid type="event" />

      <EventsHeader>
        <EventsTitle>Events</EventsTitle>
        <EventsSubtitle>Upcoming events from Bird Society of Singapore</EventsSubtitle>
      </EventsHeader>

      {events.length === 0 ? (
        <EmptyState>
          <h3>No upcoming events</h3>
          <p>Check back later for new events.</p>
        </EmptyState>
      ) : (
        events.map(event => {
          const spotsLeft = event.max_participants
            ? event.max_participants - (event.participant_count || 0)
            : null;

          return (
            <EventCard key={event.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <EventTitle>{event.title}</EventTitle>
                {event.is_full && <Badge variant="danger">Full</Badge>}
              </div>

              <EventMeta>
                {event.start_date && (
                  <MetaItem>
                    <Calendar size={16} />
                    {formatDate(event.start_date)}
                  </MetaItem>
                )}
                {event.location && (
                  <MetaItem>
                    <MapPin size={16} />
                    {event.location}
                  </MetaItem>
                )}
                {spotsLeft !== null && !event.is_full && (
                  <MetaItem>
                    <Users size={16} />
                    {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} remaining
                  </MetaItem>
                )}
              </EventMeta>

              {event.description && (
                <EventDescription>{event.description}</EventDescription>
              )}

              <EventFooter>
                <Price>
                  {parseFloat(event.price_incl_tax) > 0
                    ? `$${parseFloat(event.price_incl_tax).toFixed(2)}`
                    : 'Free'}
                </Price>
                <Link to={`/events/${event.id}`}>
                  <Button size="small">
                    {event.is_full ? 'View Details' : 'Register'}
                  </Button>
                </Link>
              </EventFooter>
            </EventCard>
          );
        })
      )}
    </EventsContainer>
  );
};

export default Events;
