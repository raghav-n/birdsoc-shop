import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Card, Badge, Button } from '../styles/GlobalStyles';
import { eventService } from '../services/misc';
import BannerGrid from '../components/BannerGrid';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { Calendar, MapPin, Users, ChevronDown, ChevronUp } from 'lucide-react';

const EventsContainer = styled.div`
  max-width: 1100px;
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

const EventsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const EventCard = styled(Card)`
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const EventCardImage = styled.img`
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  display: block;
`;

const EventCardImagePlaceholder = styled.div`
  width: 100%;
  aspect-ratio: 3 / 2;
  background: linear-gradient(135deg, #e0e7ef 0%, #f1f5f9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 2rem;
`;

const EventCardBody = styled.div`
  padding: 1.25rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const EventTitle = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  color: var(--dark);
`;

const EventMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  font-size: 0.85rem;
  color: #666;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const EventDescription = styled.p`
  margin: 0;
  color: #555;
  font-size: 0.85rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
`;

const EventFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: auto;
`;

const Price = styled.span`
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--dark);
`;

const SpotsTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: ${p => p.$critical ? '#fee2e2' : p.$low ? '#fef9c3' : '#f0fdf4'};
  color: ${p => p.$critical ? '#b91c1c' : p.$low ? '#854d0e' : '#15803d'};
  border: 1px solid ${p => p.$critical ? '#fca5a5' : p.$low ? '#fde68a' : '#86efac'};
`;

const TagFilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const TagFilterBtn = styled.button`
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

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #666;
`;

const PastSection = styled.div`
  margin-top: 3rem;
`;

const PastSectionToggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  font-weight: 600;
  color: #374151;
  padding: 0;
  margin-bottom: 1.25rem;
  &:hover { color: #111; }
`;

const PastEventCard = styled(Card)`
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  opacity: 0.82;
  @media (max-width: 480px) { flex-direction: column; }
`;

const PastEventImage = styled.img`
  width: 120px;
  height: 90px;
  object-fit: cover;
  flex-shrink: 0;
  @media (max-width: 480px) { width: 100%; height: 120px; }
`;

const PastEventImagePlaceholder = styled.div`
  width: 120px;
  height: 90px;
  background: linear-gradient(135deg, #e0e7ef 0%, #f1f5f9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 1.5rem;
  flex-shrink: 0;
  @media (max-width: 480px) { width: 100%; height: 80px; }
`;

const PastEventBody = styled.div`
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
`;

const PastEventTitle = styled.div`
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PastEventMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.75rem;
  font-size: 0.8rem;
  color: #777;
`;

const PastGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const stripHtml = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || div.innerText || '';
};

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

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pastLoading, setPastLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    eventService.getEvents()
      .then(data => setEvents(Array.isArray(data) ? data : data.results || []))
      .catch(() => setError('Failed to load events. Please try again later.'))
      .finally(() => setLoading(false));

    eventService.getPastEvents()
      .then(data => setPastEvents(Array.isArray(data) ? data : data.results || []))
      .catch(() => {})
      .finally(() => setPastLoading(false));
  }, []);

  if (loading) return <Loading text="Loading events..." />;
  if (error) return <EventsContainer><Alert variant="error">{error}</Alert></EventsContainer>;

  const allTags = [...new Set(events.flatMap(e => e.tags || []))].sort();
  const visibleEvents = selectedTag
    ? events.filter(e => (e.tags || []).includes(selectedTag))
    : events;

  return (
    <EventsContainer>
      <BannerGrid type="event" />

      <EventsHeader>
        <EventsTitle>Events</EventsTitle>
        <EventsSubtitle>Upcoming events from Bird Society of Singapore</EventsSubtitle>
      </EventsHeader>

      {allTags.length > 0 && (
        <TagFilterRow>
          <TagFilterBtn $active={!selectedTag} onClick={() => setSelectedTag(null)}>All</TagFilterBtn>
          {allTags.map(tag => (
            <TagFilterBtn
              key={tag}
              $active={selectedTag === tag}
              onClick={() => setSelectedTag(t => t === tag ? null : tag)}
            >
              {tag}
            </TagFilterBtn>
          ))}
        </TagFilterRow>
      )}

      {visibleEvents.length === 0 ? (
        <EmptyState>
          <h3>No upcoming events{selectedTag ? ` tagged "${selectedTag}"` : ''}</h3>
          <p>{selectedTag ? <span>Try a different tag or <button onClick={() => setSelectedTag(null)} style={{ background: 'none', border: 'none', color: '#6d28d9', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>view all events</button>.</span> : 'Check back later for new events.'}</p>
        </EmptyState>
      ) : (
        <EventsGrid>
          {visibleEvents.map(event => {
            const spotsLeft = event.max_participants
              ? event.max_participants - (event.participant_count || 0)
              : null;

            return (
              <EventCard key={event.id}>
                {event.image_url ? (
                  <EventCardImage src={event.image_url} alt={event.title} />
                ) : (
                  <EventCardImagePlaceholder>🐦</EventCardImagePlaceholder>
                )}

                <EventCardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <EventTitle>{event.title}</EventTitle>
                    {event.is_full
                      ? <Badge variant="danger" style={{ flexShrink: 0 }}>Full</Badge>
                      : spotsLeft !== null && (
                        <SpotsTag
                          $critical={spotsLeft <= 3}
                          $low={spotsLeft <= 8 && spotsLeft > 3}
                          style={{ flexShrink: 0 }}
                        >
                          <Users size={11} />
                          {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                        </SpotsTag>
                      )
                    }
                  </div>

                  <EventMeta>
                    {event.start_date && (
                      <MetaItem>
                        <Calendar size={14} />
                        {formatDate(event.start_date)}
                      </MetaItem>
                    )}
                    {event.location && (
                      <MetaItem>
                        <MapPin size={14} />
                        {event.location}
                      </MetaItem>
                    )}
                  </EventMeta>

                  {event.description && (
                    <EventDescription>{stripHtml(event.description)}</EventDescription>
                  )}

                  <EventFooter>
                    <Price>
                      {parseFloat(event.price_incl_tax) > 0
                        ? `$${parseFloat(event.price_incl_tax).toFixed(2)}`
                        : 'Free'}
                    </Price>
                    <Link to={`/events/${event.id}`}>
                      <Button size="small">
                        {event.is_full || event.registration_required === false ? 'View Details' : 'Register'}
                      </Button>
                    </Link>
                  </EventFooter>
                </EventCardBody>
              </EventCard>
            );
          })}
        </EventsGrid>
      )}

      {/* Past events section */}
      {!pastLoading && pastEvents.length > 0 && (
        <PastSection>
          <PastSectionToggle onClick={() => setShowPast(v => !v)}>
            {showPast ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            Past events ({pastEvents.length})
          </PastSectionToggle>

          {showPast && (
            <PastGrid>
              {pastEvents.map(event => (
                <PastEventCard key={event.id}>
                  {event.image_url
                    ? <PastEventImage src={event.image_url} alt={event.title} />
                    : <PastEventImagePlaceholder>🐦</PastEventImagePlaceholder>
                  }
                  <PastEventBody>
                    <PastEventTitle>{event.title}</PastEventTitle>
                    <PastEventMeta>
                      {event.start_date && (
                        <MetaItem>
                          <Calendar size={12} />
                          {formatDateShort(event.start_date)}
                        </MetaItem>
                      )}
                      {event.location && (
                        <MetaItem>
                          <MapPin size={12} />
                          {event.location}
                        </MetaItem>
                      )}
                    </PastEventMeta>
                  </PastEventBody>
                </PastEventCard>
              ))}
            </PastGrid>
          )}
        </PastSection>
      )}
    </EventsContainer>
  );
};

export default Events;
