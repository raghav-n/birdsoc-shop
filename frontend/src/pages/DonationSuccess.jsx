import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Heart, ArrowRight } from 'lucide-react';
import { Button, Card } from '../styles/GlobalStyles';

const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 3rem 1rem;
  text-align: center;
`;

const IconWrap = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1.25rem;
  color: var(--success);
`;

const Title = styled.h1`
  font-size: 2.2rem;
  margin-bottom: 0.75rem;
`;

const Subtitle = styled.p`
  font-size: 1.1rem;
  color: #666;
  line-height: 1.7;
  margin-bottom: 2rem;
`;

const SummaryCard = styled(Card)`
  padding: 1.5rem 2rem;
  margin-bottom: 2rem;
  text-align: left;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const RowLabel = styled.span`
  color: #888;
  font-size: 0.95rem;
`;

const RowValue = styled.span`
  font-weight: 600;
  color: var(--dark);
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;

  @media (min-width: 480px) {
    flex-direction: row;
    justify-content: center;
  }
`;

const DonationSuccess = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { name, amount, reference } = location.state || {};

  // If someone lands here directly without state, redirect to donate
  if (!name) {
    navigate('/donate', { replace: true });
    return null;
  }

  return (
    <Container>
      <IconWrap>
        <Heart size={72} fill="currentColor" />
      </IconWrap>

      <Title>Thank you, {name}!</Title>

      <Subtitle>
        Your support helps us continue our work.
      </Subtitle>

      <SummaryCard>
        <Row>
          <RowLabel>Donor</RowLabel>
          <RowValue>{name}</RowValue>
        </Row>
        <Row>
          <RowLabel>Amount</RowLabel>
          <RowValue>${parseFloat(amount).toFixed(2)}</RowValue>
        </Row>
        <Row>
          <RowLabel>Reference</RowLabel>
          <RowValue style={{ fontFamily: 'monospace' }}>{reference}</RowValue>
        </Row>
      </SummaryCard>

      <Actions>
        <Button as={Link} to="/products" size="large">
          Visit our shop
          <ArrowRight size={16} />
        </Button>
        <Button as={Link} to="/donate" variant="secondary" size="large">
          Donate again
        </Button>
      </Actions>
    </Container>
  );
};

export default DonationSuccess;
