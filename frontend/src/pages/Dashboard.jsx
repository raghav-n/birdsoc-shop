import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart2, AlertCircle } from 'lucide-react';
import { dashboardService } from '../services/dashboard';
import { Card } from '../styles/GlobalStyles';
import Loading from '../components/Loading';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const PageTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--dark);
`;

const PageSubtitle = styled.p`
  color: #666;
  margin-bottom: 2rem;
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
`;

const StatCard = styled(Card)`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.$bg || '#f0f4ff'};
  color: ${props => props.$color || 'var(--link-text)'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${props => props.$color || 'var(--dark)'};
  line-height: 1.1;
`;

const StatSub = styled.div`
  font-size: 0.8rem;
  color: #999;
`;

const Section = styled.div`
  margin-bottom: 2.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--dark);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Table = styled.div`
  overflow-x: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
`;

const Th = styled.th`
  text-align: ${props => props.$right ? 'right' : 'left'};
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #eee;
  white-space: nowrap;
  cursor: ${props => props.$sortable ? 'pointer' : 'default'};
  user-select: none;

  &:hover {
    color: ${props => props.$sortable ? 'var(--link-text)' : '#555'};
  }
`;

const Td = styled.td`
  text-align: ${props => props.$right ? 'right' : 'left'};
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  color: ${props => props.$muted ? '#999' : props.$positive ? '#16a34a' : props.$negative ? '#dc2626' : 'inherit'};
  font-weight: ${props => props.$bold ? '600' : 'normal'};
`;

const Tr = styled.tr`
  &:last-child td { border-bottom: none; }
  &:hover td { background: #fafafa; }
`;

const MarginBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const BarTrack = styled.div`
  width: 60px;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  width: ${props => Math.max(0, Math.min(100, props.$pct))}%;
  background: ${props => props.$pct >= 40 ? '#16a34a' : props.$pct >= 20 ? '#d97706' : '#dc2626'};
  border-radius: 3px;
`;

const NoCostBadge = styled.span`
  font-size: 0.75rem;
  color: #999;
  font-style: italic;
`;

const NoCostNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const formatSGD = (val) => {
  if (val == null) return '—';
  return `$${parseFloat(val).toFixed(2)}`;
};

const SORT_KEYS = ['revenue', 'cost', 'profit', 'margin', 'units_sold'];

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    dashboardService.getAnalytics()
      .then(setData)
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading text="Loading dashboard..." />;
  if (error) return <Container><p style={{ color: 'var(--danger)' }}>{error}</p></Container>;

  const { summary, by_product, by_month } = data;
  const hasAnyCost = by_product.some(p => p.cost != null);
  const missingCostCount = by_product.filter(p => p.cost == null).length;

  const handleSort = (key) => {
    if (!SORT_KEYS.includes(key)) return;
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedProducts = [...by_product].sort((a, b) => {
    const av = parseFloat(a[sortKey] ?? -Infinity);
    const bv = parseFloat(b[sortKey] ?? -Infinity);
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const sortIndicator = (key) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <Container>
      <PageTitle>Sales Dashboard</PageTitle>
      <PageSubtitle>All-time revenue, cost, and profit across orders.</PageSubtitle>

      {/* Summary cards */}
      <SummaryGrid>
        <StatCard>
          <StatIcon $bg="#f0f4ff" $color="var(--link-text)"><ShoppingBag size={20} /></StatIcon>
          <StatLabel>Total Orders</StatLabel>
          <StatValue>{summary.total_orders}</StatValue>
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><DollarSign size={20} /></StatIcon>
          <StatLabel>Total Revenue</StatLabel>
          <StatValue>{formatSGD(summary.total_revenue)}</StatValue>
          <StatSub>SGD, incl. tax</StatSub>
        </StatCard>

        <StatCard>
          <StatIcon $bg="#fff7ed" $color="#d97706"><TrendingDown size={20} /></StatIcon>
          <StatLabel>Total Cost</StatLabel>
          <StatValue $color={hasAnyCost ? 'var(--dark)' : '#bbb'}>
            {hasAnyCost ? formatSGD(summary.total_cost) : '—'}
          </StatValue>
          {!hasAnyCost && <StatSub>Enter cost prices to see this</StatSub>}
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><TrendingUp size={20} /></StatIcon>
          <StatLabel>Total Profit</StatLabel>
          <StatValue $color={hasAnyCost ? (parseFloat(summary.total_profit) >= 0 ? '#16a34a' : '#dc2626') : '#bbb'}>
            {hasAnyCost ? formatSGD(summary.total_profit) : '—'}
          </StatValue>
          {hasAnyCost && (
            <StatSub>
              <BarChart2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              {summary.profit_margin}% margin
            </StatSub>
          )}
        </StatCard>
      </SummaryGrid>

      {/* By product */}
      <Section>
        <SectionTitle>By Product</SectionTitle>
        {missingCostCount > 0 && (
          <NoCostNote>
            <AlertCircle size={16} />
            {missingCostCount} product{missingCostCount > 1 ? 's have' : ' has'} no cost price set.
          </NoCostNote>
        )}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <StyledTable>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th $right $sortable onClick={() => handleSort('units_sold')}>Units{sortIndicator('units_sold')}</Th>
                  <Th $right $sortable onClick={() => handleSort('revenue')}>Revenue{sortIndicator('revenue')}</Th>
                  <Th $right $sortable onClick={() => handleSort('cost')}>Cost{sortIndicator('cost')}</Th>
                  <Th $right $sortable onClick={() => handleSort('profit')}>Profit{sortIndicator('profit')}</Th>
                  <Th $right $sortable onClick={() => handleSort('margin')}>Margin{sortIndicator('margin')}</Th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map(p => {
                  const margin = p.margin;
                  const profit = parseFloat(p.profit ?? 0);
                  return (
                    <Tr key={p.product_id}>
                      <Td>{p.title}</Td>
                      <Td $right>{p.units_sold}</Td>
                      <Td $right $bold>{formatSGD(p.revenue)}</Td>
                      <Td $right>{p.cost != null ? formatSGD(p.cost) : <NoCostBadge>no cost</NoCostBadge>}</Td>
                      <Td $right $positive={p.profit != null && profit >= 0} $negative={p.profit != null && profit < 0}>
                        {p.profit != null ? formatSGD(p.profit) : <NoCostBadge>—</NoCostBadge>}
                      </Td>
                      <Td $right>
                        {margin != null ? (
                          <MarginBar>
                            <span style={{ color: margin >= 40 ? '#16a34a' : margin >= 20 ? '#d97706' : '#dc2626' }}>
                              {margin}%
                            </span>
                            <BarTrack>
                              <BarFill $pct={margin} />
                            </BarTrack>
                          </MarginBar>
                        ) : <NoCostBadge>—</NoCostBadge>}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </Table>
        </Card>
      </Section>

      {/* By month */}
      <Section>
        <SectionTitle>By Month</SectionTitle>
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <StyledTable>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th $right>Orders</Th>
                  <Th $right>Revenue</Th>
                  <Th $right>Cost</Th>
                  <Th $right>Profit</Th>
                </tr>
              </thead>
              <tbody>
                {[...by_month].reverse().map(m => {
                  const profit = parseFloat(m.profit);
                  const hasCost = hasAnyCost;
                  return (
                    <Tr key={m.month}>
                      <Td $bold>{m.month}</Td>
                      <Td $right>{m.orders}</Td>
                      <Td $right $bold>{formatSGD(m.revenue)}</Td>
                      <Td $right $muted={!hasCost}>{hasCost ? formatSGD(m.cost) : '—'}</Td>
                      <Td $right $positive={hasCost && profit >= 0} $negative={hasCost && profit < 0}>
                        {hasCost ? formatSGD(m.profit) : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </Table>
        </Card>
      </Section>
    </Container>
  );
};

export default Dashboard;
