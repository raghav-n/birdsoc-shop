import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';

const Page = styled.div`
  max-width: 480px;
  margin: 4rem auto;
  padding: 0 1.5rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
`;

const Subtitle = styled.p`
  color: var(--text-secondary);
  margin-bottom: 2rem;
  font-size: 0.95rem;
`;

const CardGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Card = styled(Link)`
  display: block;
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1.25rem 1.5rem;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:hover {
    border-color: var(--link-text);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
`;

const CardTitle = styled.div`
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
`;

const CardDescription = styled.div`
  font-size: 0.875rem;
  color: var(--text-secondary);
`;

const AnalyticsCard = styled(Card)`
  opacity: ${props => props.disabled ? 0.45 : 1};
  pointer-events: ${props => props.disabled ? 'none' : 'auto'};
`;

const Console = () => {
  const { user } = useAuth();

  return (
    <Page>
      <Title>Console</Title>
      <Subtitle>Logged in as {user?.email}</Subtitle>

      <CardGrid>
        <Card to="/console/onsite-purchase">
          <CardTitle>Onsite purchase</CardTitle>
          <CardDescription>Process in-person sales at the booth</CardDescription>
        </Card>

        <Card to="/console/order-lookup">
          <CardTitle>Order lookup</CardTitle>
          <CardDescription>Search and mark orders as collected</CardDescription>
        </Card>

        {user?.is_superuser && (
          <Card to="/console/analytics">
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Sales dashboard and revenue breakdown</CardDescription>
          </Card>
        )}
      </CardGrid>
    </Page>
  );
};

export default Console;
