import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import CollectionQrScanner from '../components/CollectionQrScanner';
import { buildOrderLookupPath } from '../utils/collectionQr';
import HelpModal from '../components/HelpModal';

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
  margin-bottom: 1rem;
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

const SectionTitle = styled.h2`
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
`;

const Section = styled.div`
  margin-bottom: 2rem;
`;

const Console = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleScannedLookup = ({ number, accessId }) => {
    navigate(buildOrderLookupPath({ number, accessId }));
    toast.success(`Opened order ${number}`);
  };

  const canMerchandise = user?.is_superuser || user?.groups?.includes('Merchandise');
  const canEvents = user?.is_superuser || user?.groups?.includes('Events');

  return (
    <Page>
      <HelpModal title="How to use: Console">
        <h3>Overview</h3>
        <p>The Console is the staff hub. The tools shown depend on your group membership.</p>
        <h3>Merch tools</h3>
        <ul>
          <li><strong>Onsite Purchase</strong> — process in-person sales at the booth and generate a PayNow QR code for the customer.</li>
          <li><strong>Order Lookup</strong> — search for an online order by order number or customer name, then mark it as collected when the customer picks up.</li>
          <li><strong>Analytics</strong> — sales dashboard with revenue, cost, and profit breakdowns (superusers only).</li>
        </ul>
        <h3>QR scanner</h3>
        <p>Use <strong>Scan collection QR</strong> to scan a customer's QR code and jump straight to their order in Order Lookup.</p>
        <h3>Events tools</h3>
        <ul>
          <li><strong>Event Management</strong> — create and manage events, verify payments, and track attendance.</li>
        </ul>
      </HelpModal>

      <Title>Console</Title>
      <Subtitle>Logged in as {user?.email}</Subtitle>

      {canMerchandise && (
        <Section>
          <SectionTitle>Merch</SectionTitle>
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
          <CollectionQrScanner
            title="Scan collection QR"
            buttonLabel="Scan QR code"
            onScan={handleScannedLookup}
          />
        </Section>
      )}

      {canEvents && (
        <Section>
          <SectionTitle>Events</SectionTitle>
          <CardGrid>
            <Card to="/console/events">
              <CardTitle>Event management</CardTitle>
              <CardDescription>Create events, manage registrations and attendance</CardDescription>
            </Card>
          </CardGrid>
        </Section>
      )}
    </Page>
  );
};

export default Console;
