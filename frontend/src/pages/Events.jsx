import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import {
  BsPage, BsHero, BsHeroInner, BsOverline, BsH1, BsLead,
  BsButton,
  BsSectionLabel, BsSectionLabelOverline, BsSectionLabelSub, BsSectionLabelLink,
} from '../styles/birdsoc';
import { eventService } from '../services/misc';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import EventCard from '../components/EventCard';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.25rem 2rem 4rem;

  @media (max-width: 768px) {
    padding: 1.25rem 1rem 2rem;
  }
`;

const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 3.5rem;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const HeroImage = styled.div`
  border-radius: 14px;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);

  @media (max-width: 900px) {
    display: none;
  }
`;

const StatsRow = styled.div`
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  margin-top: 1.25rem;
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  color: var(--bs-text-dim);
  letter-spacing: 0.3px;
  text-transform: uppercase;
`;

const StatPill = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const StatDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: ${(p) => p.$color || 'var(--bs-accent)'};
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    margin-bottom: 1.25rem;
  }
`;

const ChipRow = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  @media (max-width: 600px) {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin: 0 -1rem;
    padding: 0 1rem 0.25rem;

    &::-webkit-scrollbar { display: none; }
  }
`;

const Chip = styled.button`
  padding: 8px 14px;
  border-radius: 999px;
  background: ${(p) => p.$active ? 'var(--bs-accent)' : 'var(--bs-panel)'};
  color: ${(p) => p.$active ? 'var(--bs-on-accent)' : 'var(--bs-text)'};
  border: ${(p) => p.$active ? 'none' : '1px solid var(--bs-rule-soft)'};
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover { border-color: var(--bs-accent); }
`;

const FeaturedGrid = styled.div`
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.5rem;
  margin-bottom: 1rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 0.9rem;
  }
`;

const Empty = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: var(--bs-text-dim);
`;

const PastSection = styled.div`
  margin-top: 3.5rem;
`;

const PastHead = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid var(--bs-rule-soft);
  padding: 0 0 14px;
  margin-bottom: 1.1rem;
  cursor: pointer;
  color: var(--bs-text);
`;

const PastHeadLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const PastHeadLabel = styled.span`
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const PastList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PastRow = styled.div`
  display: flex;
  gap: 16px;
  align-items: center;
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 10px;
  padding: 8px 14px 8px 8px;
  opacity: 0.85;

  @media (max-width: 600px) {
    padding: 8px;
    gap: 10px;
  }
`;

const PastThumb = styled.div`
  width: 80px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const PastInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const PastTitle = styled.div`
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--bs-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const PastMeta = styled.div`
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  letter-spacing: 0.3px;
  margin-top: 2px;
`;

const RECAP_BTN_HIDE = styled.div`
  @media (max-width: 480px) {
    display: none;
  }
`;

const formatDateShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', {
    day: 'numeric', month: 'short', year: 'numeric',
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

  if (loading) return <BsPage><Container><Loading text="Loading events..." /></Container></BsPage>;
  if (error) return <BsPage><Container><Alert variant="error">{error}</Alert></Container></BsPage>;

  const allTags = [...new Set(events.flatMap(e => e.tags || []))].sort();
  const visibleEvents = selectedTag
    ? events.filter(e => (e.tags || []).includes(selectedTag))
    : events;

  const totalSpots = events.reduce((sum, e) => {
    if (!e.max_participants) return sum;
    return sum + Math.max(0, e.max_participants - (e.participant_count || 0));
  }, 0);

  const featured = visibleEvents.slice(0, 2);
  const rest = visibleEvents.slice(2);
  const showFeatured = visibleEvents.length > 3;

  return (
    <BsPage>
      {/* Hero hidden — may be reinstated later
      <BsHero>
        <BsHeroInner>
          <HeroGrid>
            <div>
              <BsOverline>Events · {events.length} upcoming</BsOverline>
              <BsH1>Go birding<br />with the Society.</BsH1>
              <BsLead>
                Walks, workshops and bioblitzes led by members and partner organisations. Most events are free — paid workshops fund the Society's outreach programmes.
              </BsLead>
              <StatsRow>
                <StatPill><StatDot /> {events.length} upcoming</StatPill>
                <StatPill><StatDot $color="var(--bs-amber-fg)" /> {totalSpots} spots open</StatPill>
                <StatPill><StatDot $color="var(--bs-sky-fg)" /> {pastEvents.length} past walks</StatPill>
              </StatsRow>
            </div>
            <HeroImage />
          </HeroGrid>
        </BsHeroInner>
      </BsHero>
      */}

      <Container>
        {allTags.length > 0 && (
          <ControlsRow>
            <ChipRow>
              <Chip $active={!selectedTag} onClick={() => setSelectedTag(null)}>All</Chip>
              {allTags.map(tag => (
                <Chip
                  key={tag}
                  $active={selectedTag === tag}
                  onClick={() => setSelectedTag(t => t === tag ? null : tag)}
                >
                  {tag}
                </Chip>
              ))}
            </ChipRow>
          </ControlsRow>
        )}

        {visibleEvents.length === 0 ? (
          <Empty>
            <h3 style={{ marginBottom: 8 }}>No upcoming events{selectedTag ? ` tagged "${selectedTag}"` : ''}</h3>
            <p>
              {selectedTag
                ? <>Try a different tag or <BsSectionLabelLink onClick={() => setSelectedTag(null)}>view all events</BsSectionLabelLink>.</>
                : 'Check back later for new events.'}
            </p>
          </Empty>
        ) : (
          <>
            {showFeatured && (
              <div style={{ marginBottom: '2.25rem' }}>
                <BsSectionLabel>
                  <div>
                    <BsSectionLabelOverline>Featured this week</BsSectionLabelOverline>
                    <BsSectionLabelSub>The next two upcoming events.</BsSectionLabelSub>
                  </div>
                </BsSectionLabel>
                <FeaturedGrid>
                  <EventCard event={featured[0]} featured />
                  {featured[1] && <EventCard event={featured[1]} />}
                </FeaturedGrid>
              </div>
            )}

            <BsSectionLabel>
              <div>
                <BsSectionLabelOverline>{showFeatured ? 'More upcoming' : 'Upcoming events'}</BsSectionLabelOverline>
              </div>
            </BsSectionLabel>
            <Grid>
              {(showFeatured ? rest : visibleEvents).map(event => (
                <EventCard key={event.id} event={event} />
              ))}
            </Grid>
          </>
        )}

        {!pastLoading && pastEvents.length > 0 && (
          <PastSection>
            <PastHead onClick={() => setShowPast(v => !v)}>
              <PastHeadLeft>
                {showPast ? <ChevronUp size={16} strokeWidth={1.7} /> : <ChevronDown size={16} strokeWidth={1.7} />}
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>Past events ({pastEvents.length})</span>
              </PastHeadLeft>
              <PastHeadLabel>Read recaps on the blog →</PastHeadLabel>
            </PastHead>

            {showPast && (
              <PastList>
                {pastEvents.map(event => (
                  <PastRow key={event.id}>
                    <PastThumb>
                      {event.image_url && <img src={event.image_url} alt={event.title} />}
                    </PastThumb>
                    <PastInfo>
                      <PastTitle>{event.title}</PastTitle>
                      <PastMeta>
                        {event.start_date && formatDateShort(event.start_date)}
                        {event.location && ` · ${event.location}`}
                      </PastMeta>
                    </PastInfo>
                    {event.blog_url && (
                      <RECAP_BTN_HIDE>
                        <BsButton
                          as="a"
                          href={event.blog_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          $size="sm"
                        >
                          <BookOpen size={12} strokeWidth={1.7} />
                          Read recap
                        </BsButton>
                      </RECAP_BTN_HIDE>
                    )}
                  </PastRow>
                ))}
              </PastList>
            )}
          </PastSection>
        )}
      </Container>
    </BsPage>
  );
};

export default Events;
