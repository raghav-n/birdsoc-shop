import React from 'react';
import styled from 'styled-components';
import SafeHtml from './SafeHtml';
import { renderOfferDescription, containsHTML, sanitizeText } from '../utils/safeContent';

const OfferCard = styled.div`
  background: white;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  padding: 1.5rem;
  margin-bottom: 1rem;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const OfferTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: var(--dark);
  font-size: 1.25rem;
`;

const OfferDetail = styled.div`
  margin-bottom: 0.75rem;
`;

const OfferLabel = styled.span`
  font-weight: 600;
  color: var(--dark);
  display: inline-block;
  min-width: 100px;
`;

const OfferValue = styled.div`
  margin-top: 0.25rem;
  color: #666;
  line-height: 1.4;
`;

const OfferStatus = styled.span`
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
  
  ${props => {
    switch (props.status) {
      case 'active':
        return `
          background: rgba(34, 197, 94, 0.1);
          color: #059669;
        `;
      case 'expired':
        return `
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
        `;
      case 'upcoming':
        return `
          background: rgba(59, 130, 246, 0.1);
          color: #2563eb;
        `;
      default:
        return `
          background: rgba(107, 114, 128, 0.1);
          color: #6b7280;
        `;
    }
  }}
`;

const OfferItem = ({ 
  offer, 
  showDetails = true,
  className = '' 
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatus = (offer) => {
    const now = new Date();
    const startDate = offer.start_datetime ? new Date(offer.start_datetime) : null;
    const endDate = offer.end_datetime ? new Date(offer.end_datetime) : null;

    if (endDate && now > endDate) return 'expired';
    if (startDate && now < startDate) return 'upcoming';
    return 'active';
  };

  const renderDescription = (description) => {
    if (!description) return 'No description available';
    
    if (containsHTML(description)) {
      return (
        <SafeHtml 
          html={renderOfferDescription(description)}
          tag="div"
          allowedTags={['strong', 'b', 'em', 'i', 'u', 'span', 'p', 'br', 'a']}
          allowedAttributes={{
            a: ['href', 'target', 'rel'],
            '*': []
          }}
        />
      );
    }
    
    return description;
  };

  return (
    <OfferCard className={className}>
      <OfferTitle>
        {sanitizeText(offer.name)}
        <OfferStatus status={getStatus(offer)} style={{ marginLeft: '1rem' }}>
          {getStatus(offer)}
        </OfferStatus>
      </OfferTitle>

      {showDetails && (
        <>
          <OfferDetail>
            <OfferLabel>Benefit:</OfferLabel>
            <OfferValue>
              {renderDescription(offer.benefit_description || offer.benefit?.description)}
            </OfferValue>
          </OfferDetail>

          <OfferDetail>
            <OfferLabel>Condition:</OfferLabel>
            <OfferValue>
              {renderDescription(offer.condition_description || offer.condition?.description)}
            </OfferValue>
          </OfferDetail>

          <OfferDetail>
            <OfferLabel>Valid Period:</OfferLabel>
            <OfferValue>
              {formatDate(offer.start_datetime)} - {formatDate(offer.end_datetime)}
            </OfferValue>
          </OfferDetail>

          {offer.total_discount && (
            <OfferDetail>
              <OfferLabel>Total Uses:</OfferLabel>
              <OfferValue>
                {offer.num_applications || 0} / {offer.max_global_applications || 'Unlimited'}
              </OfferValue>
            </OfferDetail>
          )}
        </>
      )}
    </OfferCard>
  );
};

export default OfferItem;
