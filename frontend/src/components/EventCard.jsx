import React from 'react';
import DOMPurify from 'dompurify';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, ArrowRight } from 'lucide-react';
import { BsButton, BsPill } from '../styles/birdsoc';

const Card = styled.article`
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--bs-accent);
  }

  &:focus-visible {
    outline: 2px solid var(--bs-accent);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    border-radius: 12px;
  }
`;

const CardImage = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: ${(p) => p.$featured ? '16 / 9' : '3 / 2'};
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
`;

const CardOverlayTL = styled.div`
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const DatePlate = styled.div`
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: var(--bs-body);
  border-radius: 10px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--bs-rule-soft);
`;

const DatePlateMonth = styled.div`
  font-size: 9px;
  font-weight: 700;
  color: var(--bs-accent);
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const DatePlateDay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: -0.4px;
  line-height: 1;
`;

const DatePlateDivider = styled.div`
  width: 1px;
  height: 28px;
  background: var(--bs-rule-soft);
`;

const DatePlateTime = styled.div`
  font-family: var(--bs-mono);
  font-size: 11px;
  color: var(--bs-text-dim);
  letter-spacing: 0.3px;
`;

const CardBody = styled.div`
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
`;

const CardTopRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
`;

const CardTitle = styled.h3`
  font-size: ${(p) => p.$featured ? '1.15rem' : '1.05rem'};
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 1.25;
  color: var(--bs-text);
  margin: 0;
  flex: 1;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--bs-text-dim);
`;

const CardDesc = styled.p`
  font-size: 0.81rem;
  color: var(--bs-text-dim);
  line-height: 1.55;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const CardFoot = styled.div`
  margin-top: auto;
  padding-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const CardPrice = styled.div`
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: ${(p) => p.$free ? 'var(--bs-accent)' : 'var(--bs-text)'};
`;

const SpotsBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: ${(p) => p.$tone === 'coral' ? 'var(--bs-coral-soft)' : p.$tone === 'amber' ? 'var(--bs-amber-soft)' : 'var(--bs-accent-soft)'};
  color: ${(p) => p.$tone === 'coral' ? 'var(--bs-coral-fg)' : p.$tone === 'amber' ? 'var(--bs-amber-fg)' : 'var(--bs-accent-dim)'};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
`;

const stripHtml = (html) => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || div.innerText || '';
};

const formatTimeShort = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-SG', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase().replace(' ', '');
};

const getDateParts = (dateStr) => {
  const d = new Date(dateStr);
  return {
    month: d.toLocaleString('en-SG', { month: 'short' }).toUpperCase(),
    day: d.getDate(),
    time: formatTimeShort(dateStr),
  };
};

const eventToneFromTag = (tag) => {
  if (!tag) return 'sage';
  const t = tag.toLowerCase();
  if (t.includes('workshop')) return 'amber';
  if (t.includes('member')) return 'coral';
  if (t.includes('citizen')) return 'sky';
  return 'sage';
};

const EventCard = ({ event, featured }) => {
  const navigate = useNavigate();
  const spotsLeft = event.max_participants
    ? event.max_participants - (event.participant_count || 0)
    : null;
  const isFull = event.is_full || spotsLeft === 0;
  const dp = event.start_date ? getDateParts(event.start_date) : null;
  const endDp = event.end_date ? getDateParts(event.end_date) : null;
  const isMultiDay = dp && endDp && (
    new Date(event.start_date).toDateString() !== new Date(event.end_date).toDateString()
  );
  const primaryTag = event.tags?.[0];
  const isFree = !event.price_incl_tax || parseFloat(event.price_incl_tax) <= 0;

  const ctaLabel = event.registration_required === false
    ? 'View Details'
    : event.is_lottery
      ? (event.lottery_drawn_at ? 'View Details' : 'Enter lottery')
      : isFull
        ? 'View Details'
        : 'Register';

  let badge = null;
  if (event.is_lottery) {
    badge = <BsPill $tone="sky">{event.lottery_drawn_at ? 'Lottery drawn' : 'Lottery'}</BsPill>;
  } else if (isFull) {
    badge = <SpotsBadge $tone="coral"><Users size={11} strokeWidth={1.7} /> Full</SpotsBadge>;
  } else if (spotsLeft !== null) {
    const tone = spotsLeft <= 3 ? 'amber' : 'sage';
    badge = (
      <SpotsBadge $tone={tone}>
        <Users size={11} strokeWidth={1.7} />
        {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
      </SpotsBadge>
    );
  }

  const goToEvent = () => navigate(`/events/${event.id}`);

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={goToEvent}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToEvent();
        }
      }}
    >
      <CardImage $featured={featured}>
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} />
        ) : null}
        {primaryTag && (
          <CardOverlayTL>
            <BsPill $tone={eventToneFromTag(primaryTag)}>{primaryTag}</BsPill>
          </CardOverlayTL>
        )}
        {dp && (
          <DatePlate>
            <div style={{ width: 30, textAlign: 'center' }}>
              <DatePlateMonth>{dp.month}</DatePlateMonth>
              <DatePlateDay>{dp.day}</DatePlateDay>
            </div>
            <DatePlateDivider />
            {isMultiDay ? (
              <div style={{ width: 30, textAlign: 'center' }}>
                <DatePlateMonth>{endDp.month}</DatePlateMonth>
                <DatePlateDay>{endDp.day}</DatePlateDay>
              </div>
            ) : (
              <DatePlateTime>{dp.time}</DatePlateTime>
            )}
          </DatePlate>
        )}
      </CardImage>

      <CardBody>
        <CardTopRow>
          <CardTitle $featured={featured}>{event.title}</CardTitle>
          {badge}
        </CardTopRow>

        {event.location && (
          <CardMeta>
            <MapPin size={12} strokeWidth={1.7} />
            {event.location}
          </CardMeta>
        )}

        {event.description && (
          <CardDesc>{stripHtml(event.description)}</CardDesc>
        )}

        <CardFoot>
          <CardPrice $free={isFree}>
            {isFree ? 'Free' : `$${parseFloat(event.price_incl_tax).toFixed(2)}`}
          </CardPrice>
          <BsButton
            type="button"
            $size="sm"
            $primary={!isFull && ctaLabel !== 'View Details'}
            onClick={(e) => {
              e.stopPropagation();
              goToEvent();
            }}
          >
            {ctaLabel}
            <ArrowRight size={12} strokeWidth={1.7} />
          </BsButton>
        </CardFoot>
      </CardBody>
    </Card>
  );
};

export default EventCard;
